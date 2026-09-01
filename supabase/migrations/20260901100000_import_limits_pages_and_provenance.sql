-- I1.0 — o contrato da importação: páginas, seções e procedência.
--
-- Três mudanças de contrato, e a primeira é conceitual.
--
-- O LIMITE É DE PÁGINAS NO PDF, NÃO DE DOCUMENTOS. Um manual de 743 páginas
-- não deve virar 743 páginas de manual: isso produz uma navegação que ninguém
-- consegue usar e transforma o produto num visualizador de PDF paginado. As
-- páginas se agrupam em seções revisáveis; o teto de seções é bem menor que o
-- de páginas, e a função recusa mais seções do que páginas de origem.
--
--   páginas no PDF     1 a 1000
--   seções publicadas  1 a 500, e nunca mais que o número de páginas
--
-- PROCEDÊNCIA OBRIGATÓRIA. Se uma seção reúne as páginas 12 a 18, isso precisa
-- estar registrado — senão ninguém consegue voltar ao original para conferir, e
-- um produto cuja promessa é procedência perde justamente isso ao importar. O
-- relatório precisa ter uma entrada por seção.
--
-- Um defeito encontrado pelo próprio teste, e que vale registrar porque é uma
-- armadilha do SQL: `jsonb_typeof(NULL)` devolve NULL, e `NULL <> 'array'` não
-- é verdadeiro — é NULL. Sem o coalesce, um relatório SEM procedência passava
-- direto pela verificação que existe para exigi-la.
alter table public.brand_imports
  add constraint brand_imports_page_count_limit check (page_count between 1 and 1000);

create or replace function public.publish_brand_import(
  p_workspace_id uuid, p_import_id uuid, p_key text, p_name text, p_short_name text,
  p_descriptor text, p_language text, p_metadata jsonb, p_navigation jsonb,
  p_theme jsonb, p_ai jsonb, p_legal jsonb, p_documents jsonb,
  p_pdf_sha256 text, p_page_count integer, p_report jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  nova_marca uuid; documento jsonb; ordem integer := 0; caminho text;
  total_documentos integer; proveniencia jsonb;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = p_workspace_id
      and workspace_members.user_id = actor and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can import a brand' using errcode = '42501';
  end if;

  caminho := p_workspace_id::text || '/' || p_import_id::text || '/' || p_pdf_sha256 || '.pdf';
  if not exists (
    select 1 from storage.objects
    where storage.objects.bucket_id = 'brand-imports' and storage.objects.name = caminho
  ) then
    raise exception 'the imported file was not found in storage' using errcode = 'P0002';
  end if;

  if coalesce(jsonb_typeof(p_documents), 'null') <> 'array' then
    raise exception 'documents must be an array' using errcode = '22023';
  end if;
  total_documentos := jsonb_array_length(p_documents);
  if total_documentos = 0 then
    raise exception 'import must contain at least one document' using errcode = '22023';
  end if;
  if p_page_count is null or p_page_count < 1 or p_page_count > 1000 then
    raise exception 'the pdf must have between 1 and 1000 pages' using errcode = '22023';
  end if;
  if total_documentos > 500 then
    raise exception 'import produced more sections than the limit of 500' using errcode = '22023';
  end if;
  if total_documentos > p_page_count then
    raise exception 'more sections than pages in the source pdf' using errcode = '22023';
  end if;

  proveniencia := p_report -> 'documentos';
  if coalesce(jsonb_typeof(proveniencia), 'null') <> 'array'
    or jsonb_array_length(proveniencia) <> total_documentos then
    raise exception 'every section must record the pages it came from' using errcode = '22023';
  end if;

  for documento in select * from jsonb_array_elements(p_documents) loop
    if documento->>'status' is distinct from 'draft' then
      raise exception 'imported content must start as draft' using errcode = '22023';
    end if;
  end loop;

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
    metadata, navigation, theme, ai, legal)
  values (p_workspace_id, p_key, p_name, p_short_name, p_descriptor, p_language,
    coalesce(p_metadata,'{}'::jsonb), coalesce(p_navigation,'{}'::jsonb),
    p_theme, p_ai, coalesce(p_legal,'{}'::jsonb))
  returning id into nova_marca;

  for documento in select * from jsonb_array_elements(p_documents) loop
    insert into public.brand_documents (workspace_id, brand_id, instance_key, slug,
      group_name, title, status, body, images, blocks, sort_order, updated_by)
    values (p_workspace_id, nova_marca, p_key, documento->>'slug', documento->>'group',
      documento->>'title', 'draft', coalesce(documento->'body','[]'::jsonb), '[]'::jsonb,
      coalesce(documento->'blocks','[]'::jsonb), ordem, actor);
    ordem := ordem + 1;
  end loop;

  insert into public.brand_imports (workspace_id, import_id, brand_id, storage_path,
    pdf_sha256, page_count, document_count, report, created_by)
  values (p_workspace_id, p_import_id, nova_marca, caminho, p_pdf_sha256, p_page_count,
    total_documentos, coalesce(p_report,'{}'::jsonb), actor);

  return nova_marca;
end;
$$;

revoke execute on function public.publish_brand_import(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, text, integer, jsonb) from public, anon;
grant execute on function public.publish_brand_import(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, text, integer, jsonb) to authenticated;
