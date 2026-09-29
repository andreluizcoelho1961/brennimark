-- A IA da plataforma — etapa 2 do Console da Brennimark — 29/09/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André, 28/09/2026: a IA é da PLATAFORMA. Nenhum assinante escolhe
-- ou configura IA; a Brennimark contrata os modelos, escolhe pelo preço e paga
-- a conta — a mensalidade cobre tudo. A operação é no Console, só da equipe.
--
-- Esta migration prepara o BANCO para isso, sem mudar ainda o comportamento do
-- Vini (a leitura das rotas pelo servidor vem no PR seguinte):
--
--   1. As ROTAS da plataforma: para cada tarefa (conversa, análise), os
--      modelos em ordem — principal e reservas —, e a espera pelo primeiro
--      trecho. Nascem IGUAIS ao que o Vini usa hoje (Gemini 3.6 Flash, com o
--      Groq Qwen de reserva), para nada mudar para quem usa.
--   2. Os LIMITES PADRÃO de toda conta nova: por dia e por MÊS. Até aqui uma
--      conta nova nascia sem limite — e sem limite o portão recusa tudo. Um
--      gatilho cria os dois na criação da conta.
--   3. O teto MENSAL na reserva: um teto diário não garante o do mês.
--   4. O cliente deixa de ALTERAR o próprio limite: a política antiga dava
--      escrita a quem administra a marca — fazia sentido quando cada conta
--      pagava a sua IA. Agora quem paga é a Brennimark. Leitura continua.
--   5. O REGISTRO DA EQUIPE: toda mudança feita no Console, com quem, antes,
--      depois e MOTIVO. Só se acrescenta; ninguém reescreve.
--
-- As CHAVES não entram aqui: moram nas variáveis da Vercel, nunca no banco.
-- A tabela de chaves por conta (`ai_settings`) fica como está, sem uso a
-- partir do PR seguinte — nada é apagado.
--
-- ⚖️ Tradeoff: três tabelas privadas, um gatilho, a reserva com o teto do mês e
-- sete funções. Reversível: voltar a "cada conta traz a sua IA" é religar a
-- leitura antiga, que continua no banco.

-- ─── 1. As rotas e os parâmetros da plataforma ──────────────────────────────

create table private.rotas_de_ia (
  tarefa   text not null check (tarefa in ('chat', 'analysis')),
  ordem    smallint not null check (ordem between 1 and 3),
  provider text not null check (provider in ('google', 'groq', 'anthropic', 'openai', 'openrouter', 'ollama-cloud')),
  model    text not null check (char_length(btrim(model)) between 1 and 120),
  primary key (tarefa, ordem)
);

create table private.parametros_da_plataforma (
  -- Uma linha só: a plataforma é uma.
  id                          boolean primary key default true check (id),
  espera_chat_ms              integer not null default 20000 check (espera_chat_ms between 1000 and 120000),
  espera_analysis_ms          integer not null default 30000 check (espera_analysis_ms between 1000 and 120000),
  limite_diario_padrao_micros bigint  not null check (limite_diario_padrao_micros >= 0),
  limite_mensal_padrao_micros bigint  not null check (limite_mensal_padrao_micros >= 0)
);

revoke all on private.rotas_de_ia from public, anon, authenticated;
revoke all on private.parametros_da_plataforma from public, anon, authenticated;

insert into private.rotas_de_ia (tarefa, ordem, provider, model) values
  ('chat', 1, 'google', 'gemini-3.6-flash'),
  ('chat', 2, 'groq', 'qwen/qwen3.8-27b'),
  ('analysis', 1, 'google', 'gemini-3.6-flash'),
  ('analysis', 2, 'groq', 'qwen/qwen3.8-27b');

-- US$ 5 por dia e US$ 60 por mês: o padrão da fase de pilotos (decisão de
-- 28/09). Com chaves GRATUITAS, é só uma segunda trava — o custo zero vem de
-- a conta do provedor não ter faturamento ligado.
insert into private.parametros_da_plataforma (limite_diario_padrao_micros, limite_mensal_padrao_micros)
values (5000000, 60000000);

-- ─── 2. O registro da equipe ───────────────────────────────────────────────

create table private.registro_da_equipe (
  id         uuid primary key default gen_random_uuid(),
  quem       uuid references auth.users(id) on delete set null,
  quem_nome  text not null,
  acao       text not null check (char_length(btrim(acao)) between 1 and 80),
  alvo       text not null default '',
  antes      jsonb,
  depois     jsonb,
  motivo     text not null check (char_length(btrim(motivo)) between 3 and 500),
  created_at timestamptz not null default clock_timestamp()
);

create index registro_da_equipe_quando_idx on private.registro_da_equipe (created_at desc);
create index registro_da_equipe_quem_idx on private.registro_da_equipe (quem);
revoke all on private.registro_da_equipe from public, anon, authenticated;

create function private.registrar_acao_da_equipe(p_acao text, p_alvo text, p_antes jsonb, p_depois jsonb, p_motivo text)
returns void
language sql
security definer
set search_path to ''
as $$
  insert into private.registro_da_equipe (quem, quem_nome, acao, alvo, antes, depois, motivo)
  select (select auth.uid()),
         coalesce((select e.nome from private.equipe_brennimark e where e.user_id = (select auth.uid())), 'sistema'),
         p_acao, coalesce(p_alvo, ''), p_antes, p_depois, p_motivo;
$$;

revoke all on function private.registrar_acao_da_equipe(text, text, jsonb, jsonb, text) from public, anon, authenticated;

-- ─── 3. Limites: o cliente lê, só o Console altera ─────────────────────────

drop policy "Quem administra a marca cuida do orçamento dela" on public.ai_budgets;
create policy "Quem administra a marca lê o orçamento dela" on public.ai_budgets
  for select to authenticated
  using (
    case
      when brand_id is null then workspace_id in (
        select wm.workspace_id from public.workspace_members wm
         where wm.user_id = (select auth.uid()) and wm.role = 'owner')
      else public.tem_capacidade_na_marca(brand_id, 'administrar')
    end
  );
revoke insert, update, delete on public.ai_budgets from authenticated;

-- As contas que já existem ganham os padrões: o diário vira US$ 5 onde era
-- menor, e o mensal passa a existir.
update public.ai_budgets
   set limit_micros = 5000000, updated_at = now()
 where brand_id is null and period = 'daily' and limit_micros < 5000000;
insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency, kill_switch)
select w.id, null, p.periodo, p.valor, 'USD', false
  from public.workspaces w
 cross join (values ('daily', 5000000::bigint), ('monthly', 60000000::bigint)) as p(periodo, valor)
on conflict (workspace_id, brand_id, period) do nothing;

-- Conta nova nasce com os limites padrão da plataforma.
create function private.limites_da_conta_nova()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  padrao record;
begin
  select * into padrao from private.parametros_da_plataforma where id;
  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency, kill_switch) values
    (new.id, null, 'daily', coalesce(padrao.limite_diario_padrao_micros, 5000000), 'USD', false),
    (new.id, null, 'monthly', coalesce(padrao.limite_mensal_padrao_micros, 60000000), 'USD', false)
  on conflict (workspace_id, brand_id, period) do nothing;
  return new;
end;
$$;

revoke all on function private.limites_da_conta_nova() from public, anon, authenticated;

create trigger workspaces_limites_da_conta_nova
  after insert on public.workspaces
  for each row execute function private.limites_da_conta_nova();

-- ─── 4. A reserva confere também o teto do mês ─────────────────────────────
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
$function$;

-- ─── 5. As funções do Console ──────────────────────────────────────────────
--
-- Todas: SECURITY DEFINER, `search_path` vazio, recusam com 42501 quem não é
-- da equipe, e as que ALTERAM registram antes, depois e motivo.

-- O servidor lê as rotas para o Vini (chave de serviço). Nunca a sessão.
create function public.rotas_de_ia_da_plataforma()
returns table (tarefa text, ordem smallint, provider text, model text, espera_ms integer)
language sql
stable
security definer
set search_path to ''
as $$
  select r.tarefa, r.ordem, r.provider, r.model,
         case r.tarefa when 'chat' then p.espera_chat_ms else p.espera_analysis_ms end
    from private.rotas_de_ia r
   cross join private.parametros_da_plataforma p
   order by r.tarefa, r.ordem;
$$;

revoke all on function public.rotas_de_ia_da_plataforma() from public, anon, authenticated;
grant execute on function public.rotas_de_ia_da_plataforma() to service_role;

create function public.console_ia_da_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'rotas', coalesce((select jsonb_agg(jsonb_build_object('tarefa', r.tarefa, 'ordem', r.ordem, 'provider', r.provider, 'model', r.model)
                                        order by r.tarefa, r.ordem) from private.rotas_de_ia r), '[]'::jsonb),
    'parametros', (select to_jsonb(p) - 'id' from private.parametros_da_plataforma p)
  );
end;
$$;

revoke all on function public.console_ia_da_plataforma() from public, anon;
grant execute on function public.console_ia_da_plataforma() to authenticated;

create function public.console_definir_rotas(p_tarefa text, p_rotas jsonb, p_espera_ms integer, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes jsonb;
  item jsonb;
  n integer := 0;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if p_tarefa not in ('chat', 'analysis') then
    raise exception 'tarefa desconhecida' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rotas) <> 'array' or jsonb_array_length(p_rotas) not between 1 and 3 then
    raise exception 'de 1 a 3 modelos, em ordem' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'rotas', coalesce(jsonb_agg(jsonb_build_object('provider', r.provider, 'model', r.model) order by r.ordem), '[]'::jsonb),
    'espera_ms', (select case p_tarefa when 'chat' then p.espera_chat_ms else p.espera_analysis_ms end from private.parametros_da_plataforma p))
    into antes
    from private.rotas_de_ia r where r.tarefa = p_tarefa;

  delete from private.rotas_de_ia where tarefa = p_tarefa;
  for item in select * from jsonb_array_elements(p_rotas) loop
    n := n + 1;
    -- Os checks da tabela recusam provedor desconhecido e modelo vazio.
    insert into private.rotas_de_ia (tarefa, ordem, provider, model)
    values (p_tarefa, n, item->>'provider', item->>'model');
  end loop;

  if p_tarefa = 'chat' then
    update private.parametros_da_plataforma set espera_chat_ms = p_espera_ms where id;
  else
    update private.parametros_da_plataforma set espera_analysis_ms = p_espera_ms where id;
  end if;

  perform private.registrar_acao_da_equipe('definir rotas de IA', p_tarefa, antes,
    jsonb_build_object('rotas', p_rotas, 'espera_ms', p_espera_ms), p_motivo);
end;
$$;

revoke all on function public.console_definir_rotas(text, jsonb, integer, text) from public, anon;
grant execute on function public.console_definir_rotas(text, jsonb, integer, text) to authenticated;

-- O limite de UMA conta, por dia ou por mês.
create function public.console_definir_limite(p_workspace_id uuid, p_periodo text, p_limite_micros bigint, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes bigint;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  if p_periodo not in ('daily', 'monthly') then
    raise exception 'período desconhecido' using errcode = '22023';
  end if;
  if not exists (select 1 from public.workspaces w where w.id = p_workspace_id) then
    raise exception 'conta não encontrada' using errcode = 'P0002';
  end if;

  select b.limit_micros into antes from public.ai_budgets b
   where b.workspace_id = p_workspace_id and b.brand_id is null and b.period = p_periodo;

  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency, kill_switch)
  values (p_workspace_id, null, p_periodo, p_limite_micros, 'USD', false)
  on conflict (workspace_id, brand_id, period)
  do update set limit_micros = excluded.limit_micros, updated_at = now();

  perform private.registrar_acao_da_equipe('definir limite de IA', p_workspace_id::text || ' · ' || p_periodo,
    jsonb_build_object('limit_micros', antes), jsonb_build_object('limit_micros', p_limite_micros), p_motivo);
end;
$$;

revoke all on function public.console_definir_limite(uuid, text, bigint, text) from public, anon;
grant execute on function public.console_definir_limite(uuid, text, bigint, text) to authenticated;

-- O padrão das contas NOVAS (as existentes não mudam).
create function public.console_definir_limites_padrao(p_diario_micros bigint, p_mensal_micros bigint, p_motivo text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  antes jsonb;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  select jsonb_build_object('diario', p.limite_diario_padrao_micros, 'mensal', p.limite_mensal_padrao_micros)
    into antes from private.parametros_da_plataforma p where p.id;
  update private.parametros_da_plataforma
     set limite_diario_padrao_micros = p_diario_micros, limite_mensal_padrao_micros = p_mensal_micros
   where id;
  perform private.registrar_acao_da_equipe('definir limites padrão', 'contas novas', antes,
    jsonb_build_object('diario', p_diario_micros, 'mensal', p_mensal_micros), p_motivo);
end;
$$;

revoke all on function public.console_definir_limites_padrao(bigint, bigint, text) from public, anon;
grant execute on function public.console_definir_limites_padrao(bigint, bigint, text) to authenticated;

create function public.console_registro_da_equipe(p_limite integer default 100)
returns table (quando timestamptz, quem text, acao text, alvo text, antes jsonb, depois jsonb, motivo text)
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
    select r.created_at, r.quem_nome, r.acao, r.alvo, r.antes, r.depois, r.motivo
      from private.registro_da_equipe r
     order by r.created_at desc
     limit least(greatest(coalesce(p_limite, 100), 1), 500);
end;
$$;

revoke all on function public.console_registro_da_equipe(integer) from public, anon;
grant execute on function public.console_registro_da_equipe(integer) to authenticated;

-- ─── 6. O painel de limites soma pelo período de cada linha ────────────────
--
-- A etapa 1 somava sempre o gasto do DIA. Com o teto do mês, a linha
-- 'monthly' soma desde o início do mês (UTC) — a mesma conta que a reserva.
-- Mesma assinatura: o nome da coluna (`gasto_hoje_micros`) fica, e passa a
-- valer "gasto no período".

create or replace function public.console_limites()
returns table (
  workspace_id uuid, conta text, brand_id uuid, marca text,
  period text, limit_micros bigint, currency text, kill_switch boolean,
  gasto_hoje_micros bigint
)
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
    select o.workspace_id, w.name, o.brand_id, b.name, o.period, o.limit_micros, o.currency, o.kill_switch,
           coalesce((
             select sum(case when l.status = 'settled' then l.settled_micros else l.reserved_micros end)
               from public.ai_ledger l
              where l.workspace_id = o.workspace_id
                and (o.brand_id is null or l.brand_id = o.brand_id)
                and l.status in ('reserved', 'settled')
                and l.created_at >= date_trunc(case when o.period = 'monthly' then 'month' else 'day' end, now())
           ), 0)::bigint
      from public.ai_budgets o
      join public.workspaces w on w.id = o.workspace_id
      left join public.brands b on b.id = o.brand_id;
end;
$$;
