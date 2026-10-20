-- Conta só para leitura não apaga nada — 20/10/2026 (revisão de 18/10, achado 1).
--
-- A regra de cobrança (docs/plan/cobranca.md): atraso há mais de 7 dias, ou
-- cancelada, deixa a conta SÓ PARA LEITURA, e "nada é apagado". A migration
-- `cobranca_vida` (01/10) barrou INSERT e UPDATE nas tabelas de conteúdo, mas
-- não DELETE: remover cor, asset, rascunho, marca ou arquivo seguia aceito, pela
-- interface e por qualquer chamada direta ao banco ou ao Storage.
--
-- O que esta migration faz:
--
--   1. DELETE passa a ser barrado, no banco, nas tabelas de CONTEÚDO da marca
--      (gatilho `cobranca_so_leitura_exclusao`). As RPCs `delete_asset_with_file`
--      e `delete_brand_with_files` são SECURITY INVOKER: o gatilho as alcança e
--      a transação inteira desfaz, inclusive o que tinham posto na fila.
--   2. O Storage ganha uma policy RESTRICTIVE de DELETE: as policies
--      permissivas de sempre continuam valendo e esta se soma a elas, com E. Sem ela,
--      apagar o arquivo direto pela API do Storage deixava a linha do banco de pé
--      apontando para um arquivo que sumiu.
--   3. Lacuna vizinha, mesma causa: `regras_do_logo`, `regras_de_grid`,
--      `tipografia_da_marca` e `analysis_runs` não tinham a trava de INSERT/UPDATE.
--
-- O que NÃO é barrado, de propósito:
--
--   * revogar link de entrega (UPDATE de `revogado_em`) e administrar pessoas e
--     concessões: proteger a conta não é editá-la;
--   * download e registros de acesso (tabelas de registro, fora desta trava);
--   * conversas do Vini: são da pessoa que as escreveu, não da marca;
--   * a fila de exclusão do Storage (`brand_deletions`) e o arquivo órfão cuja
--     marca já não existe: é limpeza de uma exclusão que foi permitida;
--   * a EXCLUSÃO AOS 12 MESES (`cobranca_concluir_exclusao`): a conta cancelada
--     é apagada de propósito, em cascata. Reconhecida pelo estado
--     `exclusao_iniciada_em`, que só existe depois das três travas (12 meses,
--     aviso há 30 dias, cancelada) — ver `exclusao_aos_12_meses`.
--
-- Achado no caminho: a mesma exclusão aos 12 meses apaga logins, e a chave
-- `created_by ... on delete set null` faz UPDATE nas tabelas travadas — o que o
-- gatilho de UPDATE, sem a exceção acima, recusaria. As duas funções de
-- escrita ganham a mesma exceção.
--
-- Reversibilidade: só gatilhos, funções e uma policy; nenhum dado muda.
-- `drop trigger` e `drop policy` desfazem.

-- ─── 1. A exceção da exclusão aos 12 meses ────────────────────────────────

create function private.exclusao_da_conta_em_curso(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1 from public.assinaturas a
     where a.workspace_id = p_workspace_id
       and a.situacao = 'cancelada'
       and a.exclusao_iniciada_em is not null
  );
$$;

revoke all on function private.exclusao_da_conta_em_curso(uuid) from public, anon, authenticated;

-- ─── 2. Escrita: a exceção entra nas duas funções que já existiam ─────────

create or replace function private.barrar_escrita_por_cobranca()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if private.acesso_pela_cobranca(new.workspace_id) = 'so_leitura'
     and not private.exclusao_da_conta_em_curso(new.workspace_id) then
    raise exception 'conta só para leitura: a assinatura está em atraso ou cancelada'
      using errcode = '42501', hint = 'cobranca_conta_so_leitura';
  end if;
  return new;
end;
$$;

create or replace function private.marca_nova_pela_cobranca()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  maximo integer;
  existentes integer;
begin
  if private.acesso_pela_cobranca(new.workspace_id) = 'so_leitura'
     and not private.exclusao_da_conta_em_curso(new.workspace_id) then
    raise exception 'conta só para leitura: a assinatura está em atraso ou cancelada'
      using errcode = '42501', hint = 'cobranca_conta_so_leitura';
  end if;
  if tg_op = 'UPDATE' then
    return new;
  end if;

  select pl.maximo_de_marcas into maximo
    from public.assinaturas a join public.planos pl on pl.codigo = a.plano
   where a.workspace_id = new.workspace_id;
  if maximo is null then
    return new;  -- sem assinatura, ou plano sem limite
  end if;

  -- Duas marcas criadas ao mesmo tempo não passam juntas do limite.
  perform pg_advisory_xact_lock(hashtextextended('marcas:' || new.workspace_id::text, 0));
  select count(*) into existentes from public.brands b where b.workspace_id = new.workspace_id;
  if existentes >= maximo then
    raise exception 'o plano desta conta permite % marcas', maximo
      using errcode = '23514', hint = 'cobranca_limite_de_marcas';
  end if;
  return new;
end;
$$;

-- As quatro tabelas de conteúdo que ficaram sem a trava de escrita.
create trigger cobranca_so_leitura before insert or update on public.regras_do_logo
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.regras_de_grid
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.tipografia_da_marca
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.analysis_runs
  for each row execute function private.barrar_escrita_por_cobranca();

-- ─── 3. Exclusão: o gatilho de DELETE ─────────────────────────────────────

create function private.barrar_exclusao_por_cobranca()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if private.acesso_pela_cobranca(old.workspace_id) = 'so_leitura'
     and not private.exclusao_da_conta_em_curso(old.workspace_id) then
    raise exception 'conta só para leitura: a assinatura está em atraso ou cancelada'
      using errcode = '42501', hint = 'cobranca_conta_so_leitura';
  end if;
  return old;
end;
$$;

revoke all on function private.barrar_exclusao_por_cobranca() from public, anon, authenticated;

create trigger cobranca_so_leitura_exclusao before delete on public.brands
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.brand_imports
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.brand_documents
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.brand_assets
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.brand_asset_items
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.paleta_da_marca
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.tipografia_da_marca
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.regras_do_logo
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.regras_de_grid
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.analysis_runs
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.complementos
  for each row execute function private.barrar_exclusao_por_cobranca();
create trigger cobranca_so_leitura_exclusao before delete on public.rascunhos_de_complemento
  for each row execute function private.barrar_exclusao_por_cobranca();

-- ─── 4. Storage: a policy restritiva ──────────────────────────────────────
--
-- A policy precisa chamar uma função que `authenticated` execute; a decisão
-- mora em `private`, então o intermediário é público e enxuto. Só responde
-- "não" a quem é da conta (a quem não é, as policies de sempre já recusam), e
-- um arquivo cuja marca já não existe passa: é resto de uma exclusão permitida.

create function public.arquivo_pode_ser_apagado(p_conta text, p_marca text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select case
    when p_conta !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then true
    else not (
      private.acesso_pela_cobranca(p_conta::uuid) = 'so_leitura'
      and not private.exclusao_da_conta_em_curso(p_conta::uuid)
      and public.marca_do_caminho_existe(p_marca)
      and (exists (select 1 from public.workspace_members m
                    where m.workspace_id = p_conta::uuid and m.user_id = (select auth.uid()))
           or exists (select 1 from public.brand_members b
                       where b.workspace_id = p_conta::uuid and b.user_id = (select auth.uid())))
    )
  end;
$$;

revoke all on function public.arquivo_pode_ser_apagado(text, text) from public, anon;
grant execute on function public.arquivo_pode_ser_apagado(text, text) to authenticated;

create policy "Conta só para leitura não apaga arquivo da marca" on storage.objects
  as restrictive
  for delete to authenticated
  using (
    bucket_id not in ('brand-assets', 'brand-imports', 'analysis-evidence')
    or public.arquivo_pode_ser_apagado((storage.foldername(objects.name))[1], (storage.foldername(objects.name))[2])
  );
