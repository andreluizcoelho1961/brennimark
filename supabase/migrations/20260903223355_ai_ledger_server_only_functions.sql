-- Achado CRÍTICO da revisão de segurança pós-P2A: `reservar_execucao_de_ia`,
-- `consolidar_execucao_de_ia` e `liberar_reserva_de_ia` são `security
-- definer` + `grant ... to authenticated` — qualquer MEMBRO do workspace
-- pode chamá-las diretamente pela Data API
-- (`/rest/v1/rpc/reservar_execucao_de_ia`), escolhendo `reserved_micros`,
-- moeda, preço, snapshot e tarefa por conta própria. Nada no produto
-- calcula esses números a partir do catálogo antes de aceitá-los — a
-- função confia em QUALQUER valor que o cliente mandar.
--
-- Consequência real: um membro poderia reservar o teto diário inteiro numa
-- chamada direta (sem nunca de fato chamar um provedor), esgotando o
-- orçamento do workspace ou da marca para todo mundo pelo resto do dia —
-- e `consolidar_execucao_de_ia` deixaria fechar uma reserva própria com um
-- `settled_micros` inventado, artificialmente baixo, tornando o ledger uma
-- fonte não confiável do custo real.
--
-- ROLLOUT EM DUAS ETAPAS, SEM JANELA DE INDISPONIBILIDADE — esta migração é
-- só a PRIMEIRA. Ela é PURAMENTE ADITIVA: cria três funções NOVAS
-- (`_server`), server-only desde o nascimento, e NÃO toca nas três funções
-- antigas nem no grant delas. O backend muda para chamar as novas
-- (commit separado, TypeScript), prova via Data API que reserva,
-- liquidação, cancelamento e recusa funcionam pela chave nova — só DEPOIS
-- disso uma SEGUNDA migração revoga e remove as três funções antigas. Se
-- as antigas fossem removidas aqui, qualquer instante entre esta migração
-- e o deploy do backend novo derrubaria toda reserva de IA em produção.
--
-- Sem `auth.uid()` disponível no contexto de service-role (não há JWT de
-- usuário chegando), `p_user_id` é parâmetro explícito e OBRIGATÓRIO — o
-- servidor é quem garante que veio de uma sessão já validada
-- (`supabase.auth.getUser()`, nunca do corpo da requisição), não o banco.
-- A checagem de participação no workspace continua DENTRO da função: o
-- servidor é multi-tenant, e confiar cegamente em "só o servidor chama
-- isto" não bastaria para impedir uma marca de gastar o orçamento de outra
-- por um defeito de autorização em outra camada.
--
-- `kill_switch_ativo` e `expirar_reservas_de_ia` não mudam: nenhuma das
-- duas aceita valor financeiro do chamador, e o risco desta migração é
-- especificamente sobre CONTROLAR DINHEIRO por parâmetro do cliente.

-- ─── Reservar ────────────────────────────────────────────────────────────
create or replace function public.reservar_execucao_de_ia_server(
  p_user_id uuid,
  p_workspace_id uuid,
  p_brand_id uuid,
  p_execution_id uuid,
  p_task text,
  p_reserved_micros bigint,
  p_currency text,
  p_price_snapshot jsonb default null
)
returns table (
  ok boolean,
  motivo text,
  execution_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := p_user_id;
  existente public.ai_ledger%rowtype;
  gasto_workspace bigint;
  gasto_marca bigint;
  teto record;
begin
  if actor is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  if not exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = actor
  ) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;

  select * into existente from public.ai_ledger l where l.execution_id = p_execution_id;
  if existente.id is not null then
    return query select true, 'ja_reservado'::text, existente.execution_id, existente.status;
    return;
  end if;

  if exists (
    select 1 from public.ai_budgets b
    where b.workspace_id = p_workspace_id and b.brand_id is null and b.kill_switch
  ) then
    return query select false, 'kill_switch_workspace'::text, p_execution_id, null::text;
    return;
  end if;
  if p_brand_id is not null and exists (
    select 1 from public.ai_budgets b
    where b.workspace_id = p_workspace_id and b.brand_id = p_brand_id and b.kill_switch
  ) then
    return query select false, 'kill_switch_marca'::text, p_execution_id, null::text;
    return;
  end if;

  select * into teto from public.ai_budgets
   where workspace_id = p_workspace_id and brand_id is null and period = 'daily';
  if teto.id is null then
    return query select false, 'sem_orcamento_configurado'::text, p_execution_id, null::text;
    return;
  end if;

  perform 1 from public.ai_budgets where id = teto.id for update;

  select coalesce(sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end), 0)
    into gasto_workspace
  from public.ai_ledger l
  where l.workspace_id = p_workspace_id
    and l.status in ('reserved', 'settled')
    and l.created_at >= date_trunc('day', now());

  if gasto_workspace + p_reserved_micros > teto.limit_micros then
    return query select false, 'orcamento_do_workspace_esgotado'::text, p_execution_id, null::text;
    return;
  end if;

  if p_brand_id is not null then
    select * into teto from public.ai_budgets
     where workspace_id = p_workspace_id and brand_id = p_brand_id and period = 'daily';
    if teto.id is not null then
      perform 1 from public.ai_budgets where id = teto.id for update;
      select coalesce(sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end), 0)
        into gasto_marca
      from public.ai_ledger l
      where l.workspace_id = p_workspace_id and l.brand_id = p_brand_id
        and l.status in ('reserved', 'settled')
        and l.created_at >= date_trunc('day', now());

      if gasto_marca + p_reserved_micros > teto.limit_micros then
        return query select false, 'orcamento_da_marca_esgotado'::text, p_execution_id, null::text;
        return;
      end if;
    end if;
  end if;

  insert into public.ai_ledger (
    workspace_id, brand_id, user_id, execution_id, task,
    status, reserved_micros, currency, price_snapshot
  ) values (
    p_workspace_id, p_brand_id, actor, p_execution_id, p_task,
    'reserved', p_reserved_micros, p_currency, p_price_snapshot
  );

  return query select true, 'reservado'::text, p_execution_id, 'reserved'::text;
end;
$$;

revoke all on function public.reservar_execucao_de_ia_server(uuid, uuid, uuid, uuid, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.reservar_execucao_de_ia_server(uuid, uuid, uuid, uuid, text, bigint, text, jsonb) to service_role;

-- ─── Consolidar ──────────────────────────────────────────────────────────
create or replace function public.consolidar_execucao_de_ia_server(
  p_user_id uuid,
  p_execution_id uuid,
  p_settled_micros bigint,
  p_provider text,
  p_model text,
  p_usage_snapshot jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := p_user_id;
  linha public.ai_ledger%rowtype;
begin
  if actor is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  select * into linha from public.ai_ledger where execution_id = p_execution_id;
  if linha.id is null then
    raise exception 'no reservation for this execution' using errcode = 'P0002';
  end if;
  if linha.user_id <> actor then
    raise exception 'not the owner of this execution' using errcode = '42501';
  end if;
  if linha.status <> 'reserved' then
    return;
  end if;

  update public.ai_ledger
     set status = 'settled', settled_micros = p_settled_micros,
         provider = p_provider, model = p_model, settled_at = now(),
         usage_snapshot = p_usage_snapshot
   where execution_id = p_execution_id;
end;
$$;

revoke all on function public.consolidar_execucao_de_ia_server(uuid, uuid, bigint, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.consolidar_execucao_de_ia_server(uuid, uuid, bigint, text, text, jsonb) to service_role;

-- ─── Liberar ─────────────────────────────────────────────────────────────
create or replace function public.liberar_reserva_de_ia_server(p_user_id uuid, p_execution_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := p_user_id;
  linha public.ai_ledger%rowtype;
begin
  if actor is null then
    raise exception 'p_user_id is required' using errcode = '22004';
  end if;

  select * into linha from public.ai_ledger where execution_id = p_execution_id;
  if linha.id is null then
    raise exception 'no reservation for this execution' using errcode = 'P0002';
  end if;
  if linha.user_id <> actor then
    raise exception 'not the owner of this execution' using errcode = '42501';
  end if;
  if linha.status <> 'reserved' then
    return;
  end if;

  update public.ai_ledger set status = 'released', released_at = now()
   where execution_id = p_execution_id;
end;
$$;

revoke all on function public.liberar_reserva_de_ia_server(uuid, uuid) from public, anon, authenticated;
grant execute on function public.liberar_reserva_de_ia_server(uuid, uuid) to service_role;

comment on function public.reservar_execucao_de_ia_server(uuid, uuid, uuid, uuid, text, bigint, text, jsonb) is
  'SERVER-ONLY — só service_role executa (chave secreta sb_secret_..., '
  'nunca a chave pública). p_user_id é confiado porque só o servidor, com '
  'uma sessão já validada por supabase.auth.getUser(), consegue chamar '
  'esta função — nunca o corpo da requisição. Substitui '
  'reservar_execucao_de_ia (mantida até a migração de remoção, depois do '
  'backend novo publicado e verificado). Ver '
  'docs/plan/p2-benchmark-multimodal-2026-09-03.md, achado P0-2.';
comment on function public.consolidar_execucao_de_ia_server(uuid, uuid, bigint, text, text, jsonb) is
  'SERVER-ONLY — mesmo motivo de reservar_execucao_de_ia_server.';
comment on function public.liberar_reserva_de_ia_server(uuid, uuid) is
  'SERVER-ONLY — mesmo motivo de reservar_execucao_de_ia_server.';
