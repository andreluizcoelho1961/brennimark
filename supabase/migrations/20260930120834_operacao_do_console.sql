-- A operação do Console — etapa 3 — 30/09/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- A IA é da plataforma (ADR-0008) e quem paga é a Brennimark. Faltavam à
-- equipe as alavancas de operação, e o André escolheu três (30/09):
--
--   1. PAUSAR O VINI NUMA CONTA OU NUMA MARCA. A trava já existia no banco
--      (`ai_budgets.kill_switch`, conferida pela reserva), mas desde o #64 o
--      cliente não altera mais o próprio limite, e o Console não tinha botão:
--      só dava para acionar à mão, no banco.
--   2. A TRAVA GERAL: pausar o Vini em todas as contas de uma vez — chave
--      vazada, custo disparado, provedor fora do ar.
--   3. A FICHA DA CONTA: o que a equipe olha antes de responder um cliente
--      no suporte. Só leitura, e só contagens — nunca conteúdo de conversa.
--
-- Toda ação registra quem, antes, depois e MOTIVO (`registro_da_equipe`).
--
-- ─── O teto vazio, só de marca ──────────────────────────────────────────────
--
-- Pausar uma marca pede uma linha de limite DA MARCA, e nenhuma marca tem.
-- `limit_micros` era obrigatório: criar a linha só para pausar obrigaria a
-- inventar um teto, que passaria a valer e o Console mostraria como escolha.
-- Agora a linha de MARCA pode ter o teto vazio — "sem teto próprio, só a
-- trava" —, e a reserva ignora o teto vazio. A linha de CONTA continua
-- obrigada a ter teto (constraint nova). Nenhuma linha atual muda: nenhuma
-- marca tem linha.
--
-- ⚖️ Tradeoff: a reserva ganha uma leitura de uma linha a cada pergunta ao
-- Vini (a trava geral). Reversível: a coluna nasce desligada, e o teto vazio
-- não altera linha existente.

-- ─── 1. A trava geral ───────────────────────────────────────────────────────

alter table private.parametros_da_plataforma
  add column vini_pausado boolean not null default false;

-- ─── 2. Teto vazio só em linha de marca ─────────────────────────────────────

alter table public.ai_budgets alter column limit_micros drop not null;
alter table public.ai_budgets
  add constraint ai_budgets_teto_vazio_so_de_marca check (limit_micros is not null or brand_id is not null);

-- ─── 3. A reserva confere a trava geral e aceita teto vazio de marca ───────
CREATE OR REPLACE FUNCTION public.reservar_execucao_de_ia_server(p_user_id uuid, p_workspace_id uuid, p_brand_id uuid, p_execution_id uuid, p_task text, p_reserved_micros bigint, p_currency text, p_price_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(ok boolean, motivo text, execution_id uuid, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- A trava geral vem antes de tudo (30/09/2026): pausa o Vini em todas as
  -- contas de uma vez, pelo Console.
  if exists (select 1 from private.parametros_da_plataforma p where p.id and p.vini_pausado) then
    return query select false, 'plataforma_pausada'::text, p_execution_id, null::text;
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

  -- O teto do MÊS da conta (28/09/2026). Opcional: sem linha 'monthly', não
  -- há teto mensal. Mês em UTC, como o dia acima.
  select * into teto from public.ai_budgets
   where workspace_id = p_workspace_id and brand_id is null and period = 'monthly';
  if teto.id is not null then
    perform 1 from public.ai_budgets where id = teto.id for update;
    select coalesce(sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end), 0)
      into gasto_workspace
    from public.ai_ledger l
    where l.workspace_id = p_workspace_id
      and l.status in ('reserved', 'settled')
      and l.created_at >= date_trunc('month', now());
    if gasto_workspace + p_reserved_micros > teto.limit_micros then
      return query select false, 'orcamento_mensal_esgotado'::text, p_execution_id, null::text;
      return;
    end if;
  end if;

  -- Linha de marca com teto VAZIO existe só para a trava (30/09/2026): não
  -- impõe teto próprio.
  if p_brand_id is not null then
    select * into teto from public.ai_budgets
     where workspace_id = p_workspace_id and brand_id = p_brand_id and period = 'daily';
    if teto.id is not null and teto.limit_micros is not null then
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
$function$;

-- ─── 4. As alavancas do Console ─────────────────────────────────────────────
--
-- Todas: SECURITY DEFINER, `search_path` vazio, 42501 para quem não é da
-- equipe, motivo obrigatório (o registro recusa motivo com menos de 3
-- caracteres), e o registro da ação na mesma transação.

create function public.console_pausar_plataforma(p_pausado boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes boolean;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if p_pausado is null then
    raise exception 'diga se pausa ou retoma' using errcode = '22004';
  end if;
  select vini_pausado into antes from private.parametros_da_plataforma where id;
  update private.parametros_da_plataforma set vini_pausado = p_pausado where id;
  perform private.registrar_acao_da_equipe(
    case when p_pausado then 'pausar o Vini' else 'retomar o Vini' end, 'plataforma inteira',
    jsonb_build_object('pausado', antes), jsonb_build_object('pausado', p_pausado), p_motivo);
end;
$$;

revoke all on function public.console_pausar_plataforma(boolean, text) from public, anon;
grant execute on function public.console_pausar_plataforma(boolean, text) to authenticated;

-- A conta: liga ou desliga a trava nas linhas de limite da conta (dia e mês).
create function public.console_pausar_conta(p_workspace_id uuid, p_pausado boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes boolean;
  n integer;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if p_pausado is null then
    raise exception 'diga se pausa ou retoma' using errcode = '22004';
  end if;
  select bool_or(b.kill_switch) into antes from public.ai_budgets b
   where b.workspace_id = p_workspace_id and b.brand_id is null;

  update public.ai_budgets set kill_switch = p_pausado, updated_at = now()
   where workspace_id = p_workspace_id and brand_id is null;
  get diagnostics n = row_count;
  if n = 0 then
    -- Toda conta nasce com limites (gatilho do #64); sem linha é conta que
    -- não existe, e pausar o nada não pode parecer sucesso.
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;

  perform private.registrar_acao_da_equipe(
    case when p_pausado then 'pausar o Vini' else 'retomar o Vini' end, 'conta ' || p_workspace_id::text,
    jsonb_build_object('pausado', coalesce(antes, false)), jsonb_build_object('pausado', p_pausado), p_motivo);
end;
$$;

revoke all on function public.console_pausar_conta(uuid, boolean, text) from public, anon;
grant execute on function public.console_pausar_conta(uuid, boolean, text) to authenticated;

-- A marca: a conta sai da própria marca, nunca do pedido. A linha nasce com
-- teto VAZIO se ainda não existir; se já existir (um teto de marca definido
-- antes), só a trava muda.
create function public.console_pausar_marca(p_brand_id uuid, p_pausado boolean, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  conta uuid;
  antes boolean;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if p_pausado is null then
    raise exception 'diga se pausa ou retoma' using errcode = '22004';
  end if;
  select b.workspace_id into conta from public.brands b where b.id = p_brand_id;
  if conta is null then
    raise exception 'marca não encontrada' using errcode = 'P0002';
  end if;
  select bool_or(o.kill_switch) into antes from public.ai_budgets o where o.brand_id = p_brand_id;

  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency, kill_switch)
  values (conta, p_brand_id, 'daily', null, 'USD', p_pausado)
  on conflict (workspace_id, brand_id, period)
  do update set kill_switch = excluded.kill_switch, updated_at = now();
  -- Uma linha mensal de marca (não criada pelo Console, mas possível) segue
  -- a mesma trava: a reserva confere a trava em qualquer linha da marca.
  update public.ai_budgets set kill_switch = p_pausado, updated_at = now()
   where brand_id = p_brand_id and period <> 'daily';

  perform private.registrar_acao_da_equipe(
    case when p_pausado then 'pausar o Vini' else 'retomar o Vini' end, 'marca ' || p_brand_id::text,
    jsonb_build_object('pausado', coalesce(antes, false)), jsonb_build_object('pausado', p_pausado), p_motivo);
end;
$$;

revoke all on function public.console_pausar_marca(uuid, boolean, text) from public, anon;
grant execute on function public.console_pausar_marca(uuid, boolean, text) to authenticated;

-- ─── 5. As contas e a ficha ─────────────────────────────────────────────────
--
-- Só contagens e somas. O conteúdo das conversas NUNCA passa por aqui: o
-- Console é da equipe, e a conversa é de quem conversou.

create function public.console_contas()
returns table (workspace_id uuid, conta text, slug text, marcas integer, pausada boolean, gasto_mes_micros bigint)
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  return query
    select w.id, w.name, w.slug,
           (select count(*)::integer from public.brands b where b.workspace_id = w.id),
           coalesce((select bool_or(o.kill_switch) from public.ai_budgets o where o.workspace_id = w.id and o.brand_id is null), false),
           coalesce((select sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end)
                       from public.ai_ledger l
                      where l.workspace_id = w.id and l.status in ('reserved', 'settled')
                        and l.created_at >= date_trunc('month', now())), 0)::bigint
      from public.workspaces w
     order by w.name;
end;
$$;

revoke all on function public.console_contas() from public, anon;
grant execute on function public.console_contas() to authenticated;

create function public.console_ficha_da_conta(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  ficha jsonb;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if not exists (select 1 from public.workspaces w where w.id = p_workspace_id) then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;

  select jsonb_build_object(
    'conta', (select jsonb_build_object('id', w.id, 'nome', w.name, 'slug', w.slug, 'criada_em', w.created_at)
                from public.workspaces w where w.id = p_workspace_id),
    'plataforma_pausada', (select p.vini_pausado from private.parametros_da_plataforma p where p.id),
    'pausada', coalesce((select bool_or(o.kill_switch) from public.ai_budgets o
                          where o.workspace_id = p_workspace_id and o.brand_id is null), false),
    -- Quem tem acesso a alguma coisa da conta: pela conta ou por uma marca.
    'pessoas', (select count(distinct u.user_id) from (
                  select m.user_id from public.workspace_members m where m.workspace_id = p_workspace_id
                  union
                  select bm.user_id from public.brand_members bm where bm.workspace_id = p_workspace_id
                ) u),
    'limites', coalesce((select jsonb_object_agg(o.period, o.limit_micros) from public.ai_budgets o
                          where o.workspace_id = p_workspace_id and o.brand_id is null), '{}'::jsonb),
    'uso', jsonb_build_object(
      'hoje_micros', coalesce((select sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end)
                                 from public.ai_ledger l
                                where l.workspace_id = p_workspace_id and l.status in ('reserved', 'settled')
                                  and l.created_at >= date_trunc('day', now())), 0),
      'mes_micros', coalesce((select sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end)
                                from public.ai_ledger l
                               where l.workspace_id = p_workspace_id and l.status in ('reserved', 'settled')
                                 and l.created_at >= date_trunc('month', now())), 0),
      'pedidos_hoje', (select count(*) from public.ai_ledger l
                        where l.workspace_id = p_workspace_id and l.created_at >= date_trunc('day', now())),
      'pedidos_mes', (select count(*) from public.ai_ledger l
                       where l.workspace_id = p_workspace_id and l.created_at >= date_trunc('month', now()))
    ),
    'marcas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id, 'nome', b.name, 'chave', b.key,
               'pausada', coalesce((select bool_or(o.kill_switch) from public.ai_budgets o where o.brand_id = b.id), false),
               'pedidos_mes', (select count(*) from public.ai_ledger l
                                where l.brand_id = b.id and l.created_at >= date_trunc('month', now())))
             order by b.name)
        from public.brands b where b.workspace_id = p_workspace_id), '[]'::jsonb)
  ) into ficha;
  return ficha;
end;
$$;

revoke all on function public.console_ficha_da_conta(uuid) from public, anon;
grant execute on function public.console_ficha_da_conta(uuid) to authenticated;
