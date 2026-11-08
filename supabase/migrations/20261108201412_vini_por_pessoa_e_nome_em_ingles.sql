-- O interruptor "usa o Vini" por pessoa e o nome dos planos em inglês. Autorização nominal do André, 08/11/2026.
--
-- 1. `workspace_members.usa_o_vini` (padrão LIGADO): a dona da conta desliga o Vini para um membro de
--    consulta (uma gráfica, um assistente que só baixa o logotipo). Vale para a CONTA inteira, em todos
--    os planos (ADR-0009 §5). É ortogonal às capacidades. Quem barra é a reserva de execução, no banco —
--    a tela só esconde. Administrador nunca é barrado.
-- 2. `public.definir_uso_do_vini` e `public.usos_do_vini_da_conta`: só a dona da conta (owner).
-- 3. `planos.nome_en`: o nome do plano em inglês, legível por anon como `nome`.
--
-- Reversibilidade: remover as colunas e as duas funções; devolver a reserva à versão de 20261108140544.

alter table public.workspace_members add column usa_o_vini boolean not null default true;
-- O membro lê só a própria linha (política existente); a leitura da coluna precisa de grant explícito.
grant select (usa_o_vini) on public.workspace_members to authenticated;

alter table public.planos add column nome_en text;
grant select (nome_en) on public.planos to anon, authenticated;
update public.planos set nome_en = case codigo
  when 'uma-marca-sem-ia' then 'Spark · bring your own AI'
  when 'uma-marca-com-ia' then 'Spark · with AI'
  when 'a-sem-ia'         then 'Iron · bring your own AI'
  when 'a-com-ia'         then 'Iron · with AI'
  when 'b-sem-ia'         then 'Forge · bring your own AI'
  when 'b-com-ia'         then 'Forge · with AI'
  when 'c-sem-ia'         then 'Ember · bring your own AI'
  when 'c-com-ia'         then 'Ember · with AI'
end where codigo in ('uma-marca-sem-ia','uma-marca-com-ia','a-sem-ia','a-com-ia','b-sem-ia','b-com-ia','c-sem-ia','c-com-ia');

-- A reserva, agora com o interruptor.
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

  -- O interruptor "usa o Vini" (08/11/2026): quem a dona desligou não pergunta, nem chamando a
  -- rota por fora da tela. Administrador (owner) nunca é barrado: a dona não se tranca para fora.
  if exists (
    select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.user_id = actor
      and m.role = 'member' and not m.usa_o_vini
  ) then
    return query select false, 'vini_desligado_para_voce'::text, p_execution_id, null::text;
    return;
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

-- ─── A dona liga e desliga ───────────────────────────────────────────────

create function public.definir_uso_do_vini(p_workspace_id uuid, p_email text, p_ligado boolean)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $$
declare alvo uuid;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.user_id = (select auth.uid()) and wm.role = 'owner'
  ) then
    raise exception 'só quem administra a conta liga ou desliga o Vini' using errcode = '42501';
  end if;
  if p_ligado is null then
    raise exception 'ligado ou desligado' using errcode = '22023';
  end if;

  select wm.user_id into alvo
    from public.workspace_members wm
    join auth.users u on u.id = wm.user_id
   where wm.workspace_id = p_workspace_id and lower(u.email) = lower(btrim(p_email)) and wm.role = 'member';
  if alvo is null then
    raise exception 'pessoa de consulta não encontrada nesta conta' using errcode = '22023';
  end if;

  update public.workspace_members set usa_o_vini = p_ligado
   where workspace_id = p_workspace_id and user_id = alvo;
end;
$$;

create function public.usos_do_vini_da_conta(p_workspace_id uuid)
 returns table(email text, usa_o_vini boolean)
 language plpgsql
 security definer
 set search_path to ''
as $$
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.workspace_members wm
     where wm.workspace_id = p_workspace_id and wm.user_id = (select auth.uid()) and wm.role = 'owner'
  ) then
    raise exception 'só quem administra a conta vê quem usa o Vini' using errcode = '42501';
  end if;
  return query
    select lower(u.email)::text, wm.usa_o_vini
      from public.workspace_members wm
      join auth.users u on u.id = wm.user_id
     where wm.workspace_id = p_workspace_id;
end;
$$;

revoke all on function public.definir_uso_do_vini(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.definir_uso_do_vini(uuid, text, boolean) to authenticated;
revoke all on function public.usos_do_vini_da_conta(uuid) from public, anon, authenticated;
grant execute on function public.usos_do_vini_da_conta(uuid) to authenticated;
