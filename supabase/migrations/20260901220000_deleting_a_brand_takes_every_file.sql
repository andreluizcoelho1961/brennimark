-- M2.2 — apagar uma marca leva TODOS os arquivos dela, e a fila sobrevive à
-- falha do Storage.
--
-- `delete_brand_with_files` enfileirava só os PDFs de importação. Assets da
-- biblioteca e evidências de análise ficavam no Storage para sempre, sem
-- nenhuma linha no banco apontando para eles: invisíveis, impagáveis, e ainda
-- assinaláveis por quem descobrisse o caminho. A cascata do banco não alcança
-- o Storage — é preciso enfileirar antes de apagar.

-- A fila precisa de UPDATE para contabilizar tentativa. Sem isso, a drenagem
-- não consegue registrar que tentou, e uma falha permanente é repetida
-- identicamente a cada abertura da administração, para sempre, sem deixar
-- rastro de que existe.
create policy "Owners record deletion attempts" on public.brand_deletions
  for update to authenticated
  using (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = brand_deletions.workspace_id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members m
      where m.workspace_id = brand_deletions.workspace_id
        and m.user_id = (select auth.uid())
        and m.role = 'owner'
    )
  );

grant update on public.brand_deletions to authenticated;

create or replace function public.delete_brand_with_files(p_brand_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
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

  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = conta
      and workspace_members.user_id = actor
      and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can delete a brand' using errcode = '42501';
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
$$;

revoke execute on function public.delete_brand_with_files(uuid) from public, anon;
grant execute on function public.delete_brand_with_files(uuid) to authenticated;

/**
 * Apagar UM asset: a linha sai e o arquivo entra na fila, juntos.
 *
 * A ordem importa e as duas alternativas são piores. Apagar o arquivo primeiro
 * e a linha depois deixa, se a segunda falhar, um registro apontando para
 * arquivo que não existe — a biblioteca lista um asset que não abre. Apagar a
 * linha primeiro e o arquivo depois deixa, se a segunda falhar, um arquivo sem
 * nenhum registro: invisível para sempre, e ninguém sabe que está pagando por
 * ele.
 *
 * Aqui as duas escritas de banco são uma transação só, e o Storage é tentado
 * DEPOIS. Falhando o Storage, a linha da fila continua lá e a drenagem tenta
 * de novo. Em nenhum instante existe arquivo sem registro.
 */
create or replace function public.delete_asset_with_file(p_asset_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
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

  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = linha.workspace_id
      and workspace_members.user_id = actor
      and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can delete assets' using errcode = '42501';
  end if;

  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  values (linha.workspace_id, 'brand-assets', linha.storage_path, actor)
  on conflict (workspace_id, bucket_id, storage_path) do nothing;

  delete from public.brand_assets where id = p_asset_id;
end;
$$;

revoke execute on function public.delete_asset_with_file(uuid) from public, anon;
grant execute on function public.delete_asset_with_file(uuid) to authenticated;
