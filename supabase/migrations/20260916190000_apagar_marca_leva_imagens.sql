-- Apagar a marca leva também as imagens de página e as miniaturas.
--
-- ─── O buraco, medido ────────────────────────────────────────────────────
--
-- `delete_brand_with_files` enfileirava três coisas: o PDF da importação, os
-- arquivos da biblioteca (`brand_assets`) e a evidência das análises. As
-- imagens de página NÃO entravam — elas não são linha de tabela, vivem dentro
-- de `brand_documents.images`, em JSON.
--
-- Medido em produção em 16/09/2026: o bucket `brand-assets` tem 28 objetos, e
-- os 28 são imagens de página referenciadas por documentos. Nenhum deles seria
-- enfileirado ao apagar a marca. Ficariam para sempre, ocupando espaço pago,
-- sem nenhuma linha que os mencione — invisíveis até para a conta de bytes que
-- o Passo C vai fazer.
--
-- É defeito anterior ao acesso por marca; só ficou visível ao repassar os
-- consumidores do Storage.
--
-- ─── O que entra agora ───────────────────────────────────────────────────
--
-- 1. `brand_documents.images[].src` — o caminho de cada imagem de página.
--    Caminho que começa com "/" é arquivo estático de `public/`, não do
--    Storage: fica de fora, senão a drenagem tentaria apagar para sempre um
--    objeto que nunca existiu ali.
-- 2. `brand_source_pages.miniatura_path` — hoje nulo em toda linha de produção
--    (a renderização saiu na ADR-0006), mas o campo existe e volta a ser
--    preenchido se as miniaturas voltarem. Enfileirar agora é mais barato que
--    lembrar depois.
--
-- Os dois no bucket `brand-assets`, que é onde o importador os escrevia.
--
-- O resto da função é o que já estava lá.

CREATE OR REPLACE FUNCTION public.delete_brand_with_files(p_brand_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  conta uuid;
  enfileirados integer := 0;
  parcial integer;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select workspace_id into conta from public.brands where id = p_brand_id;
  if conta is null then
    raise exception 'brand not found' using errcode = 'P0002';
  end if;

  -- `administrar` NA MARCA (16/09/2026), o mesmo que a policy de delete de
  -- `brands` exige. Antes: `owner` da conta.
  if not public.tem_capacidade_na_marca(p_brand_id, 'administrar') then
    raise exception 'only brand administrators can delete a brand' using errcode = '42501';
  end if;

  -- Os três buckets, um por vez, na MESMA transação do delete. Enfileirar
  -- depois de apagar seria enfileirar a partir de linhas que já não existem;
  -- enfileirar em outra transação deixaria a janela em que a marca sumiu e a
  -- fila ainda não sabe dos arquivos.

  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  select conta, 'brand-imports', brand_imports.storage_path, actor
  from public.brand_imports
  where brand_imports.brand_id = p_brand_id
  on conflict (workspace_id, bucket_id, storage_path) do nothing;
  get diagnostics parcial = row_count;
  enfileirados := enfileirados + parcial;

  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  select conta, 'brand-assets', brand_assets.storage_path, actor
  from public.brand_assets
  where brand_assets.brand_id = p_brand_id
  on conflict (workspace_id, bucket_id, storage_path) do nothing;
  get diagnostics parcial = row_count;
  enfileirados := enfileirados + parcial;

  -- `image_path` é opcional: nem toda análise guarda a peça. O filtro de nulo
  -- evita enfileirar um caminho vazio, que a drenagem tentaria apagar para
  -- sempre sem nunca conseguir.
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  select conta, 'analysis-evidence', analysis_runs.image_path, actor
  from public.analysis_runs
  where analysis_runs.brand_id = p_brand_id
    and analysis_runs.image_path is not null
    and analysis_runs.image_path <> ''
  on conflict (workspace_id, bucket_id, storage_path) do nothing;
  get diagnostics parcial = row_count;
  enfileirados := enfileirados + parcial;


  /*
   * As imagens de página, que vivem em JSON e não em linha própria.
   *
   * `jsonb_array_elements` sobre um array vazio não devolve nada, então
   * documento sem imagem não gera pendência. O filtro do "/" deixa de fora o
   * caminho estático de `public/`.
   */
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  select distinct conta, 'brand-assets', imagem->>'src', actor
  from public.brand_documents d,
       jsonb_array_elements(coalesce(d.images, '[]'::jsonb)) as imagem
  where d.brand_id = p_brand_id
    and nullif(imagem->>'src', '') is not null
    and left(imagem->>'src', 1) <> '/'
  on conflict (workspace_id, bucket_id, storage_path) do nothing;
  get diagnostics parcial = row_count;
  enfileirados := enfileirados + parcial;

  -- As miniaturas do manifesto. Nulas em toda linha de produção hoje; o campo
  -- existe e volta a ser usado se a renderização voltar (ADR-0006 §5).
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  select distinct conta, 'brand-assets', p.miniatura_path, actor
  from public.brand_source_pages p
  where p.brand_id = p_brand_id
    and nullif(p.miniatura_path, '') is not null
    and left(p.miniatura_path, 1) <> '/'
  on conflict (workspace_id, bucket_id, storage_path) do nothing;
  get diagnostics parcial = row_count;
  enfileirados := enfileirados + parcial;

  delete from public.brands where id = p_brand_id;

  return enfileirados;
end;
$function$;
