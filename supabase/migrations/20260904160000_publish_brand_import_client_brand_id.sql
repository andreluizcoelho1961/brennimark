-- Fase 1g (identidade visual fiel): páginas classificadas como
-- visual-dominante viram imagem da própria página, enviada ao Storage
-- ANTES de a marca existir — mas o padrão de pasta de todo outro arquivo
-- da marca é `workspaceId/brandId/...`, e brandId só nascia dentro desta
-- função, depois do upload já ter acontecido. Decisão do usuário: gerar o
-- id da marca no NAVEGADOR (crypto.randomUUID()), usá-lo para nomear a
-- pasta da imagem, e passar o MESMO id aqui em vez de deixar o banco
-- gerar um novo — um padrão de pasta só, não dois.
--
-- Confirmado antes de aplicar: a policy de storage do bucket
-- `brand-assets` (`Owners can upload brand assets`,
-- 20260721184318_add_brandville_content_admin.sql) verifica só o
-- PRIMEIRO segmento do caminho (workspace_id) contra workspace_members —
-- nunca confere se a marca (segundo segmento) já existe em `brands`.
-- Enviar para `workspaceId/<brandId-ainda-nao-criado>/...` já é permitido
-- pela regra de hoje, sem precisar mudar nenhuma policy.

-- Parâmetro novo = assinatura NOVA para o Postgres (funções são
-- identificadas por nome + tipos de parâmetro). `create or replace` com
-- uma lista de parâmetros diferente cria uma SEGUNDA função em vez de
-- substituir a original — a antiga precisa ser derrubada explicitamente,
-- e o grant refeito na nova, porque grant não migra entre assinaturas.
drop function if exists public.publish_brand_import(
  uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, text, integer, jsonb);

create function public.publish_brand_import(p_workspace_id uuid, p_import_id uuid, p_brand_id uuid, p_key text, p_name text, p_short_name text, p_descriptor text, p_language text, p_metadata jsonb, p_navigation jsonb, p_theme jsonb, p_ai jsonb, p_legal jsonb, p_documents jsonb, p_pdf_sha256 text, p_page_count integer, p_report jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  documento jsonb; ordem integer := 0; caminho text;
  total_documentos integer; proveniencia jsonb;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_brand_id is null then
    raise exception 'brand id is required' using errcode = '22004';
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

  insert into public.brands (id, workspace_id, key, name, short_name, descriptor, language,
    metadata, navigation, theme, ai, legal)
  values (p_brand_id, p_workspace_id, p_key, p_name, p_short_name, p_descriptor, p_language,
    coalesce(p_metadata, '{}'::jsonb), coalesce(p_navigation, '{}'::jsonb),
    p_theme, p_ai, coalesce(p_legal, '{}'::jsonb));

  for documento in select * from jsonb_array_elements(p_documents) loop
    -- Toda imagem referenciada precisa já existir no Storage, na pasta
    -- desta marca — mesma disciplina que já vale para o PDF de origem
    -- (verificado acima): nada se insere referenciando um arquivo que
    -- não está lá.
    if jsonb_typeof(documento->'images') = 'array' then
      if exists (
        select 1 from jsonb_array_elements(documento->'images') as img
        where not exists (
          select 1 from storage.objects
          where storage.objects.bucket_id = 'brand-assets'
            and storage.objects.name = (img->>'src')
            and (storage.foldername(storage.objects.name))[1] = p_workspace_id::text
            and (storage.foldername(storage.objects.name))[2] = p_brand_id::text
        )
      ) then
        raise exception 'an image references a file that is not in storage' using errcode = 'P0002';
      end if;
    end if;

    insert into public.brand_documents (workspace_id, brand_id, instance_key, slug,
      group_name, title, status, body, images, blocks, source_pages,
      title_method, title_confidence, sort_order, updated_by)
    values (p_workspace_id, p_brand_id, p_key, documento->>'slug', documento->>'group',
      documento->>'title', 'draft', coalesce(documento->'body','[]'::jsonb),
      coalesce(documento->'images','[]'::jsonb),
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
  values (p_workspace_id, p_import_id, p_brand_id, caminho, p_pdf_sha256, p_page_count,
    total_documentos, coalesce(p_report, '{}'::jsonb), actor);

  return p_brand_id;
end;
$function$;

revoke execute on function public.publish_brand_import(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, text, integer, jsonb) from public, anon;
grant execute on function public.publish_brand_import(
  uuid, uuid, uuid, text, text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, text, integer, jsonb) to authenticated;
