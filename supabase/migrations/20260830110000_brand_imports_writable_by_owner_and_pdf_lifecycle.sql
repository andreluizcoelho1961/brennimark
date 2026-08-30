-- Correção do importador: a RPC precisava falhar para todo usuário real.
--
-- `publish_brand_import` é SECURITY INVOKER, então roda com os privilégios de
-- quem chama — que é exatamente o que se quer. Mas `brand_imports` concedia
-- apenas SELECT ao papel `authenticated`. Marca e documentos entravam, o
-- último INSERT recebia `permission denied`, e a transação inteira era
-- revertida. O importador não funcionaria para ninguém.
--
-- O defeito passou porque MEU TESTE estava errado, e vale registrar como: ele
-- definia `request.jwt.claims` mas continuava executando como `postgres`. Isso
-- simula `auth.uid()` e não simula os privilégios do papel. Um teste de
-- autorização que roda como superusuário não testa autorização.
--
-- Os testes agora usam `set local role authenticated`, e a falha antiga foi
-- reproduzida para confirmar que eles a pegariam:
--   com os grants antigos: 42501 (permission denied for table brand_imports)
--   marcas deixadas: 0 · documentos deixados: 0
grant insert, delete on public.brand_imports to authenticated;

-- Quem registra a importação é quem a fez, na conta que administra.
create policy "Owners record their own imports" on public.brand_imports
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and workspace_id in (
      select workspace_members.workspace_id from public.workspace_members
      where workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'));

create policy "Owners delete import records" on public.brand_imports
  for delete to authenticated using (
    workspace_id in (
      select workspace_members.workspace_id from public.workspace_members
      where workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'));

-- Achado no caminho: TRUNCATE sobrevivera nos grants padrão do Supabase.
-- Ele ignora a RLS — uma linha só apagaria o conteúdo de todas as contas.
revoke truncate on public.brand_documents from authenticated;

-- Apagar a marca leva o registro da importação junto. SET NULL deixava a
-- procedência de um manual que não existe mais, com o caminho de um PDF que
-- ninguém consegue mais alcançar para remover.
alter table public.brand_imports
  drop constraint brand_imports_brand_workspace_fkey;

alter table public.brand_imports
  add constraint brand_imports_brand_workspace_fkey
  foreign key (brand_id, workspace_id)
  references public.brands(id, workspace_id) on delete cascade;

-- Remover o PDF é parte de apagar a marca. Sem esta política, o arquivo com o
-- manual inteiro sobreviveria à exclusão.
create policy "Owners delete brand imports" on storage.objects
  for delete to authenticated using (
    bucket_id = 'brand-imports'
    and (storage.foldername(name))[1] in (
      select workspace_members.workspace_id::text from public.workspace_members
      where workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'));

-- A função ganha uma verificação a mais: o caminho declarado tem que ser o
-- caminho canônico desta conta para este arquivo. Sem isso, o registro poderia
-- apontar para o PDF de outra conta — a política do Storage impediria a
-- LEITURA, mas o banco guardaria uma procedência mentirosa.
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

  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = p_workspace_id
      and workspace_members.user_id = actor
      and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can import a brand' using errcode = '42501';
  end if;

  if p_storage_path is null
    or p_storage_path <> (p_workspace_id::text || '/' || p_pdf_sha256 || '.pdf') then
    raise exception 'storage path does not belong to this workspace' using errcode = '22023';
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
