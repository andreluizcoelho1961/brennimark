-- O importador: como um PDF vira marca.
--
-- Três decisões estão neste arquivo, e todas as três são de segurança.
--
-- 1. O bucket é PRIVADO, e as políticas exigem que a primeira pasta do caminho
--    seja um workspace do qual a pessoa é owner. O PDF sobe com a sessão dela;
--    a chave privilegiada do Supabase não participa deste caminho.
--
-- 2. A publicação é uma função SECURITY INVOKER. Invoker, e não definer, é o
--    ponto: ela roda com os privilégios de quem chama, então a RLS continua
--    valendo dentro dela. Uma definer aqui seria uma porta que ignora as
--    políticas — exatamente o que a documentação de segurança da Data API
--    manda evitar.
--
-- 3. O corpo de uma função é UMA transação. Marca, documentos e registro da
--    importação entram juntos ou não entram: uma falha no meio não pode deixar
--    marca sem conteúdo, que é pior que nenhuma marca.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-imports', 'brand-imports', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

create policy "Owners upload brand imports" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'brand-imports'
    and (storage.foldername(name))[1] in (
      select workspace_members.workspace_id::text from public.workspace_members
      where workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'));

create policy "Members read brand imports" on storage.objects
  for select to authenticated using (
    bucket_id = 'brand-imports'
    and (storage.foldername(name))[1] in (
      select workspace_members.workspace_id::text from public.workspace_members
      where workspace_members.user_id = (select auth.uid())));

-- A procedência da importação: qual arquivo, com que impressão digital,
-- quantas páginas tinha, e o que a extração avisou. Sem isso, "de onde veio
-- esta página" fica sem resposta seis meses depois.
create table public.brand_imports (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  brand_id      uuid,
  storage_path  text not null,
  pdf_sha256    text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  page_count    integer not null check (page_count > 0),
  document_count integer not null check (document_count >= 0),
  report        jsonb not null default '{}'::jsonb check (jsonb_typeof(report) = 'object'),
  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),

  -- Composta, como todo vínculo com marca neste esquema: o registro de uma
  -- conta não pode apontar para a marca de outra. Ver o patch 0.
  constraint brand_imports_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete set null (brand_id)
);

create index brand_imports_workspace_idx on public.brand_imports(workspace_id, created_at desc);
create index brand_imports_brand_workspace_idx on public.brand_imports(brand_id, workspace_id);
create index brand_imports_created_by_idx on public.brand_imports(created_by);

alter table public.brand_imports enable row level security;

create policy "Members read brand imports rows" on public.brand_imports
  for select to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));

revoke all on public.brand_imports from anon, authenticated;
grant select on public.brand_imports to authenticated;

create or replace function public.publish_brand_import(
  p_workspace_id uuid,
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
  p_storage_path text,
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
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- Importar é administrar. A verificação existe aqui além da RLS porque esta
  -- função decide, e uma decisão de autorização precisa ser explícita no lugar
  -- onde é tomada.
  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = p_workspace_id
      and workspace_members.user_id = actor
      and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can import a brand' using errcode = '42501';
  end if;

  if jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) = 0 then
    raise exception 'import must contain at least one document' using errcode = '22023';
  end if;

  if jsonb_array_length(p_documents) > 300 then
    raise exception 'import exceeds the document limit' using errcode = '22023';
  end if;

  -- Extração automática não é aprovação. A regra vive aqui, e não só no
  -- cliente, porque o cliente é do lado de quem chama.
  for documento in select * from jsonb_array_elements(p_documents) loop
    if documento->>'status' is distinct from 'draft' then
      raise exception 'imported content must start as draft' using errcode = '22023';
    end if;
  end loop;

  -- Chave repetida estoura como unique_violation e o cliente a traduz em
  -- conflito. Importar por cima apagaria curadoria — nunca em silêncio.
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
      -- Imagens ficam de fora: uma imagem extraída de PDF é referência de
      -- revisão, não arquivo oficial da marca. Assets oficiais entram pela
      -- biblioteca, com alguém dizendo que aquele é o arquivo certo.
      '[]'::jsonb,
      coalesce(documento->'blocks', '[]'::jsonb),
      ordem, actor
    );
    ordem := ordem + 1;
  end loop;

  insert into public.brand_imports (
    workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count,
    report, created_by
  ) values (
    p_workspace_id, nova_marca, p_storage_path, p_pdf_sha256, p_page_count,
    jsonb_array_length(p_documents), coalesce(p_report, '{}'::jsonb), actor
  );

  return nova_marca;
end;
$$;

revoke execute on function public.publish_brand_import(
  uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
  text, text, integer, jsonb
) from public, anon;

grant execute on function public.publish_brand_import(
  uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb,
  text, text, integer, jsonb
) to authenticated;
