-- ADR-0009 (adendo de 08/11/2026): quem paga a IA define o teto, e o plano "com IA" tem franquia
-- de perguntas.
--
-- Decisões do André em 07 e 08/11/2026:
--   1. IA PRÓPRIA (a agência paga o modelo): o teto em dólar é da AGÊNCIA. A conta nasce SEM teto
--      e a dona define, na tela Configurações › IA, um limite por dia e um por mês, ou nenhum.
--      A plataforma não impõe valor nenhum a quem paga o próprio modelo.
--   2. IA DA PLATAFORMA: o teto em dólar continua como é (padrão da plataforma, ajustado pelo
--      Console). Nada muda para essas contas.
--   3. FRANQUIA POR PERGUNTAS: o plano pode ter uma cota mensal de perguntas. Acabou, o Vini
--      bloqueia até o mês seguinte. Nunca excede. NULA = sem franquia (os planos de hoje).
--
-- O QUE MUDA
--   - `planos.franquia_de_perguntas_por_mes` (coluna nova, nula nos planos atuais);
--   - `ai_budgets`: o teto do workspace pode ser vazio. A restrição antiga só aceitava teto vazio
--     em linha de marca; a linha da conta continua existindo (é nela que mora a trava do Console),
--     só passa a poder dizer "sem teto". Na conta da plataforma, teto vazio RECUSA (como linha
--     ausente), então afrouxar a restrição não abre brecha;
--   - gatilho em `assinaturas`: entrar no modo próprio zera o teto padrão; sair do modo próprio
--     devolve o padrão da plataforma;
--   - `reservar_execucao_de_ia_server`: confere a franquia e trata o teto vazio da conta própria;
--   - `uso_do_vini_da_conta` (leitura do uso, só a dona) e `definir_teto_da_ia_propria` (a dona
--     define o teto).
--
-- Reversibilidade: a coluna se remove; as funções se recriam pela versão de
-- `20261001204510_cobranca_vida`; a restrição se recria depois de dar teto às linhas vazias da
-- conta. Nenhum dado existente muda de valor.

-- ─── 1. A franquia no plano ─────────────────────────────────────────────

alter table public.planos
  add column franquia_de_perguntas_por_mes integer
  check (franquia_de_perguntas_por_mes is null or franquia_de_perguntas_por_mes > 0);

comment on column public.planos.franquia_de_perguntas_por_mes is
  'Perguntas por mês na conta inteira (análise de peça conta 2). Nula = sem franquia. Acabou, o Vini bloqueia até o mês seguinte (UTC).';

-- ─── 2. Teto da conta pode ser vazio (só a conta própria usa) ─────────────

alter table public.ai_budgets drop constraint ai_budgets_teto_vazio_so_de_marca;

-- ─── 3. Contagem de perguntas do mês ────────────────────────────────────
--
-- Uma pergunta = uma linha do razão que não foi liberada. Falha que liberou a reserva não
-- gasta franquia. Mês em UTC, como o teto mensal. Análise de peça conta 2.

create function private.perguntas_no_mes(p_workspace_id uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(sum(case when l.task = 'analyse-image' then 2 else 1 end), 0)::integer
    from public.ai_ledger l
   where l.workspace_id = p_workspace_id
     and l.status in ('reserved', 'settled')
     and l.created_at >= date_trunc('month', now());
$$;

revoke all on function private.perguntas_no_mes(uuid) from public, anon, authenticated;

create function private.franquia_da_conta(p_workspace_id uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select p.franquia_de_perguntas_por_mes
    from public.assinaturas a
    join public.planos p on p.codigo = a.plano
   where a.workspace_id = p_workspace_id;
$$;

revoke all on function private.franquia_da_conta(uuid) from public, anon, authenticated;

-- ─── 4. Entrar e sair do modo próprio acerta o teto padrão ───────────────

create function private.acertar_teto_no_modo_de_ia()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes text;
  depois text;
  padrao record;
begin
  select p.modo_de_ia into depois from public.planos p where p.codigo = new.plano;
  if tg_op = 'UPDATE' then
    select p.modo_de_ia into antes from public.planos p where p.codigo = old.plano;
  end if;

  if depois = 'propria' and antes is distinct from 'propria' then
    -- Entrou na IA própria: o padrão da plataforma não vale. A agência define o dela.
    update public.ai_budgets
       set limit_micros = null, updated_at = now()
     where workspace_id = new.workspace_id and brand_id is null and period in ('daily', 'monthly');
  elsif depois is distinct from 'propria' then
    -- Plataforma: nenhuma linha da conta pode ficar sem teto. Devolve o padrão onde estiver vazio.
    select * into padrao from private.parametros_da_plataforma where id;
    update public.ai_budgets
       set limit_micros = case period
             when 'daily' then coalesce(padrao.limite_diario_padrao_micros, 5000000)
             else coalesce(padrao.limite_mensal_padrao_micros, 60000000) end,
           updated_at = now()
     where workspace_id = new.workspace_id and brand_id is null
       and period in ('daily', 'monthly') and limit_micros is null;
  end if;
  return new;
end;
$$;

revoke all on function private.acertar_teto_no_modo_de_ia() from public, anon, authenticated;

create trigger acertar_teto_no_modo_de_ia
  after insert or update of plano on public.assinaturas
  for each row execute function private.acertar_teto_no_modo_de_ia();

-- ─── 5. A reserva: franquia e teto da conta própria ──────────────────────
--
-- Mesma função de `20261001204510_cobranca_vida`, com DOIS acréscimos, ambos marcados:
--   (a) a franquia de perguntas, logo depois das travas (vale nos dois modos);
--   (b) o teto da conta própria: linha ausente ou vazia = sem teto; na plataforma continua
--       recusando com `sem_orcamento_configurado`.

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
  propria boolean;
  franquia integer;
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

  -- A assinatura em atraso há mais de 7 dias, ou cancelada, deixa a conta só
  -- para leitura (cobrança, fatia 3, 01/10/2026): o Vini para. Conta sem
  -- assinatura (as criadas à mão) não muda nada.
  if private.acesso_pela_cobranca(p_workspace_id) = 'so_leitura' then
    return query select false, 'conta_so_leitura'::text, p_execution_id, null::text;
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

  -- (a) A franquia de perguntas do plano (08/11/2026). A trava por conta serializa duas
  -- perguntas simultâneas: sem ela, as duas leriam "falta uma" e a franquia estouraria.
  franquia := private.franquia_da_conta(p_workspace_id);
  if franquia is not null then
    perform pg_advisory_xact_lock(hashtextextended('franquia-de-ia:' || p_workspace_id::text, 0));
    if private.perguntas_no_mes(p_workspace_id) + (case when p_task = 'analyse-image' then 2 else 1 end) > franquia then
      return query select false, 'franquia_esgotada'::text, p_execution_id, null::text;
      return;
    end if;
  end if;

  propria := private.modo_de_ia_da_conta(p_workspace_id) = 'propria';

  select * into teto from public.ai_budgets
   where workspace_id = p_workspace_id and brand_id is null and period = 'daily';
  -- (b) Teto diário vazio ou ausente: na IA própria é "a agência não pôs teto"; na plataforma
  -- é conta sem orçamento, e recusa.
  if teto.id is null or teto.limit_micros is null then
    if not propria then
      return query select false, 'sem_orcamento_configurado'::text, p_execution_id, null::text;
      return;
    end if;
  else
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
  end if;

  -- O teto do MÊS da conta (28/09/2026). Opcional: sem linha 'monthly' ou com ela vazia, não
  -- há teto mensal. Mês em UTC, como o dia acima.
  select * into teto from public.ai_budgets
   where workspace_id = p_workspace_id and brand_id is null and period = 'monthly';
  if teto.id is not null and teto.limit_micros is not null then
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

revoke all on function public.reservar_execucao_de_ia_server(uuid, uuid, uuid, uuid, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.reservar_execucao_de_ia_server(uuid, uuid, uuid, uuid, text, bigint, text, jsonb) to service_role;

-- ─── 6. O uso e o teto, para a dona da conta ─────────────────────────────

create function public.uso_do_vini_da_conta(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  diario bigint;
  mensal bigint;
begin
  if quem is null then
    raise exception 'é preciso entrar' using errcode = '28000';
  end if;
  if not private.administra_a_conta(p_workspace_id, quem) then
    raise exception 'só quem administra a conta vê o uso' using errcode = '42501', hint = 'uso_so_a_dona';
  end if;

  select b.limit_micros into diario from public.ai_budgets b
   where b.workspace_id = p_workspace_id and b.brand_id is null and b.period = 'daily';
  select b.limit_micros into mensal from public.ai_budgets b
   where b.workspace_id = p_workspace_id and b.brand_id is null and b.period = 'monthly';

  return jsonb_build_object(
    'modo', private.modo_de_ia_da_conta(p_workspace_id),
    'franquia', private.franquia_da_conta(p_workspace_id),
    'perguntas_no_mes', private.perguntas_no_mes(p_workspace_id),
    'volta_em', (date_trunc('month', now()) + interval '1 month')::date,
    'teto_diario_micros', diario,
    'teto_mensal_micros', mensal,
    'gasto_hoje_micros', (select coalesce(sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end), 0)
                            from public.ai_ledger l
                           where l.workspace_id = p_workspace_id and l.status in ('reserved', 'settled')
                             and l.created_at >= date_trunc('day', now())),
    'gasto_no_mes_micros', (select coalesce(sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end), 0)
                              from public.ai_ledger l
                             where l.workspace_id = p_workspace_id and l.status in ('reserved', 'settled')
                               and l.created_at >= date_trunc('month', now()))
  );
end;
$$;

revoke all on function public.uso_do_vini_da_conta(uuid) from public, anon;
grant execute on function public.uso_do_vini_da_conta(uuid) to authenticated;

-- A dona define o teto da IA PRÓPRIA. Nulo = sem teto. Só mexe no valor: a trava do Console
-- (`kill_switch`) mora na mesma linha e não é tocada.
create function public.definir_teto_da_ia_propria(p_workspace_id uuid, p_diario_micros bigint, p_mensal_micros bigint)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
begin
  if quem is null then
    raise exception 'é preciso entrar' using errcode = '28000';
  end if;
  if not private.administra_a_conta(p_workspace_id, quem) then
    raise exception 'só quem administra a conta define o teto' using errcode = '42501', hint = 'teto_so_a_dona';
  end if;
  if private.modo_de_ia_da_conta(p_workspace_id) <> 'propria' then
    raise exception 'o teto é da agência só quando a IA é dela' using errcode = '42501', hint = 'teto_so_ia_propria';
  end if;
  if (p_diario_micros is not null and (p_diario_micros <= 0 or p_diario_micros > 1000000000000))
     or (p_mensal_micros is not null and (p_mensal_micros <= 0 or p_mensal_micros > 1000000000000))
     or (p_diario_micros is not null and p_mensal_micros is not null and p_diario_micros > p_mensal_micros) then
    raise exception 'valor de teto inválido' using errcode = '22023', hint = 'teto_invalido';
  end if;

  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency)
  values (p_workspace_id, null, 'daily', p_diario_micros, 'USD'),
         (p_workspace_id, null, 'monthly', p_mensal_micros, 'USD')
  on conflict (workspace_id, brand_id, period)
  do update set limit_micros = excluded.limit_micros, updated_at = now();
end;
$$;

revoke all on function public.definir_teto_da_ia_propria(uuid, bigint, bigint) from public, anon;
grant execute on function public.definir_teto_da_ia_propria(uuid, bigint, bigint) to authenticated;
