-- P1 do piloto Qwen, fechamento — duas peças que faltavam no orçamento:
--
-- 1. Uma reserva ABANDONADA (a chamada nunca voltou — crash, timeout de
--    plataforma além do limite da própria aplicação) nunca era liberada:
--    ficava 'reserved' para sempre, comendo o teto do dia sem que ninguém
--    tivesse recebido resposta nenhuma. `expirar_reservas_de_ia` fecha isso.
--
-- 2. `kill_switch` só era LIDO por quem administra (RLS de `ai_budgets` é
--    owner-only) — mas quem PRECISA saber se está pausado é quem vai
--    disparar a chamada, que pode ser `member`. `kill_switch_ativo` expõe
--    essa leitura, sem expor o resto da linha de orçamento.

-- ─── Expirar reservas abandonadas ──────────────────────────────────────────
--
-- Limiar padrão de 15 minutos: bem acima do maior timeout real do produto
-- (analyze: 90s de conclusão, `maxDuration` de 120s nas duas rotas) — uma
-- reserva mais velha que isso não está "demorando", está abandonada.
--
-- Risco aceito, registrado: se a chamada original ainda estiver viva quando
-- a expiração roda (o que o limiar generoso torna improvável) e só
-- consolidar DEPOIS, `consolidar_execucao_de_ia` vai encontrar `status <>
-- 'reserved'` e não fazer nada — silencioso, pelo mesmo motivo de sempre
-- (idempotência). O custo real dessa execução específica não seria
-- registrado. Para os valores do piloto (~centavos de dólar), esse risco é
-- menor que o risco oposto: uma reserva morta consumindo o teto do dia para
-- sempre.
create or replace function public.expirar_reservas_de_ia(
  p_workspace_id uuid,
  p_mais_velha_que interval default '15 minutes'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  linhas integer;
begin
  -- Duas origens legítimas de chamada: um owner varrendo manualmente (via
  -- produto), ou uma tarefa agendada sem sessão de usuário nenhuma —
  -- `auth.uid()` vem nulo nesse caso, e é aceito como chamada de
  -- infraestrutura confiável, do mesmo jeito que o resto do produto já trata
  -- rotas de manutenção sem ator humano.
  if actor is not null and not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = actor and m.role = 'owner'
  ) then
    raise exception 'only an owner can expire stale reservations' using errcode = '42501';
  end if;

  update public.ai_ledger
     set status = 'released', released_at = now()
   where workspace_id = p_workspace_id
     and status = 'reserved'
     and created_at < now() - p_mais_velha_que;

  get diagnostics linhas = row_count;
  return linhas;
end;
$$;

revoke execute on function public.expirar_reservas_de_ia(uuid, interval) from public, anon;
grant execute on function public.expirar_reservas_de_ia(uuid, interval) to authenticated, service_role;

comment on function public.expirar_reservas_de_ia(uuid, interval) is
  'Libera reservas de IA abandonadas (mais velhas que o limiar) de um '
  'workspace. Chamável por owner (manual) ou por processo sem sessão '
  '(agendado). Idempotente: só afeta linhas ainda "reserved".';

-- ─── Ler o kill switch sem expor o resto de ai_budgets ─────────────────────
--
-- Devolve os DOIS escopos separados — workspace e marca — porque quem chama
-- (decidirExecucao, ver execucao.ts) precisa saber qual dos dois motivos
-- específicos usar na recusa, o mesmo vocabulário que a reserva já usa.
create or replace function public.kill_switch_ativo(
  p_workspace_id uuid,
  p_brand_id uuid
)
returns table (workspace boolean, marca boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = actor
  ) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  return query select
    exists (
      select 1 from public.ai_budgets b
      where b.workspace_id = p_workspace_id and b.brand_id is null and b.kill_switch
    ),
    p_brand_id is not null and exists (
      select 1 from public.ai_budgets b
      where b.workspace_id = p_workspace_id and b.brand_id = p_brand_id and b.kill_switch
    );
end;
$$;

revoke execute on function public.kill_switch_ativo(uuid, uuid) from public, anon;
grant execute on function public.kill_switch_ativo(uuid, uuid) to authenticated;

comment on function public.kill_switch_ativo(uuid, uuid) is
  'Leitura do kill switch (workspace e marca) para quem é member, não só '
  'owner — RLS de ai_budgets é owner-only, mas quem dispara a chamada '
  'precisa saber se está pausado. Não expõe teto, gasto nem mais nada da '
  'linha de orçamento.';
