-- Apagar asset e apagar marca também decidem por MARCA.
--
-- ─── O que sobrou da varredura de 15/09 ──────────────────────────────────
--
-- Seis funções ainda perguntavam "é dona da CONTA?". Medindo uma a uma, quatro
-- estão certas assim e duas não:
--
--   expirar_reservas_de_ia   rotina de sistema, não tem marca a consultar
--   handle_new_profile       cadastro, idem
--   publish_brand_import     CRIA a marca — exigir capacidade numa marca que
--                            ainda não existe é impossível; criar é poder da
--                            conta, como a policy de insert em `brands`
--   enqueue_import_cleanup   só age sobre PDF que NÃO virou importação (ela
--                            recusa com 23505 se a importação existir), então
--                            não há marca; é o mesmo critério do "PDF sem
--                            marca é da conta" das policies de Storage
--
--   delete_asset_with_file   ← muda
--   delete_brand_with_files  ← muda
--
-- ─── Por que as duas eram um problema de verdade ─────────────────────────
--
-- Elas são INVOKER, então a RLS continua valendo por baixo e nada vazava. O
-- efeito era o inverso, e pior do que parece:
--
--   RECUSAVA quem tem a capacidade NA MARCA sem ser dono da conta.
--
--   E, para o dono de conta SEM capacidade na marca, `delete_asset_with_file`
--   fazia algo pior que recusar: a verificação por conta passava, a função
--   ENFILEIRAVA o arquivo para exclusão, e só então o `delete` esbarrava na
--   RLS e apagava 0 linhas. Resultado: a linha do asset continua na
--   biblioteca e o ARQUIVO dela é apagado pela drenagem. Um asset que existe
--   na tela e não abre.
--
-- As capacidades espelham as policies que já governam as mesmas tabelas:
-- apagar asset é `editar` (policy de delete de `brand_assets`), apagar a marca
-- é `administrar` (policy de delete de `brands`). `brand_assets.brand_id` é
-- NOT NULL, então não há linha sem marca a tratar.
--
-- Nas duas muda só a verificação; o resto do corpo é o que já estava lá.

CREATE OR REPLACE FUNCTION public.delete_asset_with_file(p_asset_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  actor uuid := (select auth.uid());
  linha public.brand_assets%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  -- A RLS já limita o que este select enxerga; o `not found` cobre tanto
  -- "não existe" quanto "não é seu", e são indistinguíveis de propósito.
  select * into linha from public.brand_assets where id = p_asset_id;
  if linha.id is null then
    raise exception 'asset not found' using errcode = 'P0002';
  end if;

  /*
   * `editar` NA MARCA (16/09/2026), e não `owner` da conta.
   *
   * A verificação vem ANTES de enfileirar de propósito: pela regra antiga, o
   * dono de conta sem capacidade na marca passava aqui, o arquivo ia para a
   * fila, e só então o `delete` abaixo esbarrava na RLS e apagava 0 linhas —
   * deixando o asset na biblioteca com o arquivo apagado pela drenagem.
   */
  if not public.tem_capacidade_na_marca(linha.brand_id, 'editar') then
    raise exception 'only brand editors can delete assets' using errcode = '42501';
  end if;

  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  values (linha.workspace_id, 'brand-assets', linha.storage_path, actor)
  on conflict (workspace_id, bucket_id, storage_path) do nothing;

  delete from public.brand_assets where id = p_asset_id;
end;
$function$;

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

  delete from public.brands where id = p_brand_id;

  return enfileirados;
end;
$function$;
