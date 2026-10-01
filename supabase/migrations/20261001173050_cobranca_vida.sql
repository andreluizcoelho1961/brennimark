-- Cobrança, fatia 3 — a vida da assinatura (01/10/2026).
--
-- A regra de atraso aprovada pelo André em 01/10:
--
--   em atraso até 7 dias   tudo funciona; o dono vê o aviso       → 'tolerancia'
--   em atraso há 7 dias+   só leitura: consulta e download sim;  → 'so_leitura'
--   ou cancelada           Vini, edição e marca nova não
--   nada é apagado, nunca
--
-- E o limite de marcas do plano, que o banco impõe (a tela só avisa).
--
-- CONTA SEM ASSINATURA NÃO MUDA NADA: as contas de hoje, criadas à mão antes
-- da cobrança existir, ficam 'livre'. A regra só alcança quem assina.
--
-- Onde a regra mora, e por quê assim:
--
--   private.acesso_pela_cobranca   a decisão, num lugar só
--   reservar_execucao_de_ia_server o Vini recusa com 'conta_so_leitura', ao lado
--                                  das outras pausas (mesma função, um bloco a mais)
--   gatilho nas tabelas de CONTEÚDO a edição para no banco, qualquer que seja a
--                                  rota; as tabelas de REGISTRO (downloads,
--                                  acessos) ficam de fora, porque download segue
--   gatilho em brands              marca nova para, e o limite do plano vale
--
-- Pessoas e acessos (concessões) continuam administráveis: tirar alguém de uma
-- conta em atraso é proteger a conta, não editá-la.

-- ─── 1. A decisão ────────────────────────────────────────────────────────

create function private.acesso_pela_cobranca(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path to ''
as $$
  select case
           when a.id is null then 'livre'
           when a.situacao = 'ativa' then 'ativa'
           when a.situacao = 'em_atraso' and a.em_atraso_desde > now() - interval '7 days' then 'tolerancia'
           else 'so_leitura'
         end
    from (select 1) as um
    left join public.assinaturas a on a.workspace_id = p_workspace_id;
$$;

revoke all on function private.acesso_pela_cobranca(uuid) from public, anon, authenticated;

-- O que a moldura precisa para avisar: só para quem é da conta. O dono vê o
-- resto (plano, datas) pela própria assinatura, que a RLS só entrega a ele.
create function public.situacao_de_cobranca_da_conta(p_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  acesso text;
  desde timestamptz;
begin
  if not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace_id and m.user_id = (select auth.uid()))
     and not exists (select 1 from public.brand_members b where b.workspace_id = p_workspace_id and b.user_id = (select auth.uid())) then
    raise exception 'não é desta conta' using errcode = '42501';
  end if;
  acesso := private.acesso_pela_cobranca(p_workspace_id);
  select a.em_atraso_desde into desde from public.assinaturas a where a.workspace_id = p_workspace_id;
  return jsonb_build_object(
    'acesso', acesso,
    'so_leitura_a_partir_de', case when acesso = 'tolerancia' then desde + interval '7 days' end);
end;
$$;

revoke all on function public.situacao_de_cobranca_da_conta(uuid) from public, anon;
grant execute on function public.situacao_de_cobranca_da_conta(uuid) to authenticated;

-- ─── 2. O Vini para ──────────────────────────────────────────────────────
--
-- A função inteira, copiada da versão em produção (impressão digital conferida
-- antes desta migration) com UM bloco a mais, logo depois da trava geral.

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

-- ─── 3. A edição para ────────────────────────────────────────────────────

create function private.barrar_escrita_por_cobranca()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if private.acesso_pela_cobranca(new.workspace_id) = 'so_leitura' then
    raise exception 'conta só para leitura: a assinatura está em atraso ou cancelada'
      using errcode = '42501', hint = 'cobranca_conta_so_leitura';
  end if;
  return new;
end;
$$;

revoke all on function private.barrar_escrita_por_cobranca() from public, anon, authenticated;

create trigger cobranca_so_leitura before insert or update on public.brand_imports
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.brand_documents
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert on public.brand_document_versions
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.brand_assets
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.brand_asset_items
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.paleta_da_marca
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.complementos
  for each row execute function private.barrar_escrita_por_cobranca();
create trigger cobranca_so_leitura before insert or update on public.rascunhos_de_complemento
  for each row execute function private.barrar_escrita_por_cobranca();
-- Link de entrega: criar para; REVOGAR continua (é proteger, não editar).
create trigger cobranca_so_leitura before insert on public.links_de_entrega
  for each row execute function private.barrar_escrita_por_cobranca();

-- ─── 4. Marca nova: só leitura e o limite do plano ───────────────────────

create function private.marca_nova_pela_cobranca()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  maximo integer;
  existentes integer;
begin
  if private.acesso_pela_cobranca(new.workspace_id) = 'so_leitura' then
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

revoke all on function private.marca_nova_pela_cobranca() from public, anon, authenticated;

create trigger cobranca_marca_nova before insert or update on public.brands
  for each row execute function private.marca_nova_pela_cobranca();
