-- ADR-0009 (adendo de 07/11/2026): o razão não impõe teto em dinheiro quando a IA é da agência.
--
-- Decisão do André em 07/11/2026: no plano "traga a sua IA" a agência paga o modelo, então o
-- limite diário/mensal/da marca em dólar (`ai_budgets`) não vale. Sem esta mudança a reserva
-- ainda exigiria linhas em `ai_budgets` e recusaria com `sem_orcamento_configurado`.
--
-- O QUE MUDA: UM bloco, logo depois das travas (pausa geral, conta só para leitura, kill
-- switch da conta e da marca), antes dos tetos. O resto da função é a versão de
-- `20261001204510_cobranca_vida`, que é a que roda em produção. Ficam valendo as travas; o
-- que sai é só o limite em dinheiro, e só para conta em modo `propria`.
--
-- Reversibilidade: `create or replace` da versão anterior desfaz. Nenhuma tabela muda.

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

  -- IA da AGÊNCIA (ADR-0009, 07/11/2026): quem paga o modelo é a agência, com a chave
  -- dela, então o limite em dinheiro NÃO se aplica (decisão do André). Ficam valendo tudo
  -- o que está acima: pausa geral, conta só para leitura e trava da conta e da marca. A
  -- reserva continua sendo gravada no razão, porque é dele que sai o histórico de uso.
  if private.modo_de_ia_da_conta(p_workspace_id) = 'propria' then
    insert into public.ai_ledger (
      workspace_id, brand_id, user_id, execution_id, task,
      status, reserved_micros, currency, price_snapshot
    ) values (
      p_workspace_id, p_brand_id, actor, p_execution_id, p_task,
      'reserved', p_reserved_micros, p_currency, p_price_snapshot
    );
    return query select true, 'reservado'::text, p_execution_id, 'reserved'::text;
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

revoke all on function public.reservar_execucao_de_ia_server(uuid, uuid, uuid, uuid, text, bigint, text, jsonb) from public, anon, authenticated;
grant execute on function public.reservar_execucao_de_ia_server(uuid, uuid, uuid, uuid, text, bigint, text, jsonb) to service_role;
