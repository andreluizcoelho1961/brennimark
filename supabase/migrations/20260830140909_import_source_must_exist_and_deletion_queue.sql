-- O ciclo de vida do arquivo importado.
--
-- Quatro correções, e todas nascem da mesma raiz: o banco confiava no cliente
-- sobre um objeto que vive fora dele.
--
-- 1. A PROCEDÊNCIA PRECISA EXISTIR. A função conferia o FORMATO do caminho e
--    não se havia arquivo lá. E, como brand_imports passou a aceitar INSERT do
--    papel autenticado, um owner podia gravar uma procedência falsa direto pela
--    Data API, sem passar pela função. A garantia mudou de lugar: agora vive na
--    política de inserção, que é fronteira inevitável, e a função a repete.
--
-- 2. O CAMINHO PASSOU A SER EXCLUSIVO DA IMPORTAÇÃO. Ele era conta + hash, e
--    duas marcas da mesma conta que importassem o mesmo PDF compartilhavam o
--    objeto: apagar a primeira levava o arquivo da segunda. Havia ainda uma
--    corrida — uma tentativa criava o objeto, outra o referenciava, e a
--    primeira falhava e o removia. Objeto exclusivo resolve os três casos sem
--    contagem de referência. Deduplicar pode vir depois, com referência
--    transacional; nunca por coincidência de caminho.
--
-- 3. A EXCLUSÃO GANHOU FILA DURÁVEL. Remover o arquivo antes do banco evitava
--    órfão e trocava por outra inconsistência: Storage bem-sucedido com banco
--    falhando deixava a marca viva sem a própria fonte. Agora uma transação
--    apaga a marca e registra os arquivos a remover; a fila não tem vínculo com
--    a marca, então sobrevive à cascata. Falha do Storage deixa exclusão
--    PENDENTE e repetível, não inconsistência invisível.
--
-- 4. O DELETE DIRETO EM brand_imports SAIU. Ele permitia apagar a linha de
--    procedência sem apagar o PDF — outro caminho para órfão. Quem remove a
--    linha é a cascata da marca.
revoke delete on public.brand_imports from authenticated;
drop policy "Owners delete import records" on public.brand_imports;

alter table public.brand_imports
  add column import_id uuid not null default gen_random_uuid();

alter table public.brand_imports
  add constraint brand_imports_workspace_import_key unique (workspace_id, import_id);

drop policy "Owners record their own imports" on public.brand_imports;

-- A fronteira inevitável: nenhuma procedência entra sem arquivo por trás.
create policy "Owners record imports backed by a real file" on public.brand_imports
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and workspace_id in (
      select workspace_members.workspace_id from public.workspace_members
      where workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner')
    and storage_path = workspace_id::text || '/' || import_id::text || '/' || pdf_sha256 || '.pdf'
    and exists (
      select 1 from storage.objects
      where storage.objects.bucket_id = 'brand-imports'
        and storage.objects.name = brand_imports.storage_path));

-- A fila sobrevive à cascata de propósito: ela existe justamente para o que
-- resta depois que a marca deixou de existir.
create table public.brand_deletions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  storage_path text not null,
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  unique (workspace_id, storage_path)
);

create index brand_deletions_workspace_idx on public.brand_deletions(workspace_id, requested_at);
create index brand_deletions_requested_by_idx on public.brand_deletions(requested_by);

alter table public.brand_deletions enable row level security;

create policy "Owners see pending deletions" on public.brand_deletions
  for select to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Owners close pending deletions" on public.brand_deletions
  for delete to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Owners enqueue their own deletions" on public.brand_deletions
  for insert to authenticated with check (
    requested_by = (select auth.uid())
    and workspace_id in (
      select workspace_members.workspace_id from public.workspace_members
      where workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'));

revoke all on public.brand_deletions from anon, authenticated;
grant select, insert, delete on public.brand_deletions to authenticated;

create or replace function public.delete_brand_with_files(p_brand_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  conta uuid;
  enfileirados integer;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select workspace_id into conta from public.brands where id = p_brand_id;
  if conta is null then
    raise exception 'brand not found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = conta
      and workspace_members.user_id = actor
      and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can delete a brand' using errcode = '42501';
  end if;

  insert into public.brand_deletions (workspace_id, storage_path, requested_by)
  select conta, brand_imports.storage_path, actor
  from public.brand_imports
  where brand_imports.brand_id = p_brand_id
  on conflict (workspace_id, storage_path) do nothing;

  get diagnostics enfileirados = row_count;

  delete from public.brands where id = p_brand_id;

  return enfileirados;
end;
$$;

revoke execute on function public.delete_brand_with_files(uuid) from public, anon;
grant execute on function public.delete_brand_with_files(uuid) to authenticated;

-- A função de publicação deixa de receber o caminho: ela o reconstrói e
-- confere. Caminho vindo do cliente é procedência que o cliente escolhe.
drop function if exists public.publish_brand_import(
  uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
  text, text, integer, jsonb);

create or replace function public.publish_brand_import(
  p_workspace_id uuid,
  p_import_id uuid,
  p_key text,
  p_name text,
  p_short_name text,
  p_descriptor text,
  p_language text,
  p_metadata jsonb,
  p_navigation jsonb,
  p_theme jsonb,
  p_ai jsonb,
  p_legal jsonb,
  p_documents jsonb,
  p_pdf_sha256 text,
  p_page_count integer,
  p_report jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  nova_marca uuid;
  documento jsonb;
  ordem integer := 0;
  caminho text;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = p_workspace_id
      and workspace_members.user_id = actor
      and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can import a brand' using errcode = '42501';
  end if;

  caminho := p_workspace_id::text || '/' || p_import_id::text || '/' || p_pdf_sha256 || '.pdf';

  if not exists (
    select 1 from storage.objects
    where storage.objects.bucket_id = 'brand-imports'
      and storage.objects.name = caminho
  ) then
    raise exception 'the imported file was not found in storage' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) = 0 then
    raise exception 'import must contain at least one document' using errcode = '22023';
  end if;

  if jsonb_array_length(p_documents) > 300 then
    raise exception 'import exceeds the document limit' using errcode = '22023';
  end if;

  for documento in select * from jsonb_array_elements(p_documents) loop
    if documento->>'status' is distinct from 'draft' then
      raise exception 'imported content must start as draft' using errcode = '22023';
    end if;
  end loop;

  insert into public.brands (
    workspace_id, key, name, short_name, descriptor, language,
    metadata, navigation, theme, ai, legal
  ) values (
    p_workspace_id, p_key, p_name, p_short_name, p_descriptor, p_language,
    coalesce(p_metadata, '{}'::jsonb), coalesce(p_navigation, '{}'::jsonb),
    p_theme, p_ai, coalesce(p_legal, '{}'::jsonb)
  )
  returning id into nova_marca;

  for documento in select * from jsonb_array_elements(p_documents) loop
    insert into public.brand_documents (
      workspace_id, brand_id, instance_key, slug, group_name, title, status,
      body, images, blocks, sort_order, updated_by
    ) values (
      p_workspace_id, nova_marca, p_key,
      documento->>'slug', documento->>'group', documento->>'title', 'draft',
      coalesce(documento->'body', '[]'::jsonb),
      '[]'::jsonb,
      coalesce(documento->'blocks', '[]'::jsonb),
      ordem, actor
    );
    ordem := ordem + 1;
  end loop;

  insert into public.brand_imports (
    workspace_id, import_id, brand_id, storage_path, pdf_sha256, page_count,
    document_count, report, created_by
  ) values (
    p_workspace_id, p_import_id, nova_marca, caminho, p_pdf_sha256, p_page_count,
    jsonb_array_length(p_documents), coalesce(p_report, '{}'::jsonb), actor
  );

  return nova_marca;
end;
$$;

revoke execute on function public.publish_brand_import(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, text, integer, jsonb
) from public, anon;

grant execute on function public.publish_brand_import(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, text, integer, jsonb
) to authenticated;
