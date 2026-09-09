-- Grava title_method/title_confidence na publicação, lendo do mesmo
-- documento que já carrega sourcePageRanges (padrão idêntico ao que
-- 20260903180000 já fez para source_pages — ver o comentário da migração
-- 20260904150000 para o motivo).
--
-- `documento->>'confianca'` chega como texto (jsonb ->>); cast explícito
-- para numeric, com NULL seguro se o campo faltar ou não for número —
-- `nullif` evita um erro de cast em vez de rejeitar a importação inteira
-- por um campo que é só metadado de curadoria, não conteúdo.

create or replace function public.publish_brand_import(p_workspace_id uuid, p_import_id uuid, p_key text, p_name text, p_short_name text, p_descriptor text, p_language text, p_metadata jsonb, p_navigation jsonb, p_theme jsonb, p_ai jsonb, p_legal jsonb, p_documents jsonb, p_pdf_sha256 text, p_page_count integer, p_report jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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

  if char_length(p_ai->>'chatRole') > 1000 then
    raise exception 'chatRole must be at most 1000 characters' using errcode = '22001';
  end if;
  if char_length(p_ai->>'analysisRole') > 1000 then
    raise exception 'analysisRole must be at most 1000 characters' using errcode = '22001';
  end if;

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
    metadata, navigation, theme, ai, legal)
  values (p_workspace_id, p_key, p_name, p_short_name, p_descriptor, p_language,
    coalesce(p_metadata, '{}'::jsonb), coalesce(p_navigation, '{}'::jsonb),
    p_theme, p_ai, coalesce(p_legal, '{}'::jsonb))
  returning id into nova_marca;

  for documento in select * from jsonb_array_elements(p_documents) loop
    insert into public.brand_documents (workspace_id, brand_id, instance_key, slug,
      group_name, title, status, body, images, blocks, source_pages,
      title_method, title_confidence, sort_order, updated_by)
    values (p_workspace_id, nova_marca, p_key, documento->>'slug', documento->>'group',
      documento->>'title', 'draft', coalesce(documento->'body','[]'::jsonb), '[]'::jsonb,
      coalesce(documento->'blocks','[]'::jsonb),
      case when jsonb_typeof(documento->'sourcePageRanges') = 'array'
           then documento->'sourcePageRanges' else '[]'::jsonb end,
      nullif(documento->>'metodo', ''),
      nullif(documento->>'confianca', '')::numeric,
      ordem, actor);
    ordem := ordem + 1;
  end loop;

  insert into public.brand_imports (workspace_id, import_id, brand_id, storage_path,
    pdf_sha256, page_count, document_count, report, created_by)
  values (p_workspace_id, p_import_id, nova_marca, caminho, p_pdf_sha256, p_page_count,
    total_documentos, coalesce(p_report, '{}'::jsonb), actor);

  return nova_marca;
end;
$function$;
