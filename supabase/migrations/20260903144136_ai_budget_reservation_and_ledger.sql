-- P1 do piloto Qwen — orçamento com reserva pré-chamada, ledger idempotente
-- e kill switch. NENHUMA chave, crédito ou conexão externa é criada por esta
-- migração — ela só constrói o mecanismo de controle de gasto.
--
-- Por que reserva-antes-e-consolida-depois, e não "descontar depois que a
-- chamada volta": entre o momento em que uma pessoa aperta enviar e o momento
-- em que o provedor responde, outras chamadas concorrentes podem estar em
-- voo. Sem reserva, duas chamadas simultâneas veem o mesmo saldo disponível e
-- as duas passam — o orçamento existe no papel e não no relógio. A reserva
-- ATOMICAMENTE debita o teto ANTES da chamada sair, e a consolidação ajusta
-- para o custo real quando o provedor devolve o uso — que quase nunca é
-- idêntico ao estimado.
--
-- "Não fixar moeda, preço ou orçamento no código: guardar como dado
-- auditável" — por isso tudo aqui é linha de tabela, e o valor monetário é
-- inteiro em MICROUNIDADES da moeda declarada (1/1.000.000), para não haver
-- arredondamento de ponto flutuante somando milhares de execuções pequenas.

-- ─── Tetos, por escopo ──────────────────────────────────────────────────────
--
-- `brand_id` nulo é o teto do WORKSPACE inteiro; preenchido é o teto de UMA
-- marca. As duas linhas convivem: uma execução daquela marca precisa caber
-- nos dois tetos ao mesmo tempo, e a função de reserva confere ambos.
create table public.ai_budgets (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  brand_id      uuid,
  -- 'daily' | 'monthly'. Texto e não enum: um período novo não deve exigir
  -- migração de tipo, só uma linha nova.
  period        text not null check (period in ('daily', 'monthly')),
  limit_micros  bigint not null check (limit_micros >= 0),
  currency      text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- Interrompe TODO uso deste escopo, na hora, sem esperar o teto ser
  -- alcançado. É o botão de "parar agora" que o briefing pede.
  kill_switch   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint ai_budgets_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade,
  -- Um teto por escopo e período. Duas linhas para o mesmo workspace+marca+
  -- período seriam duas verdades sobre o mesmo limite.
  unique (workspace_id, brand_id, period)
);

create index ai_budgets_workspace_idx on public.ai_budgets(workspace_id);

alter table public.ai_budgets enable row level security;

-- Só owner. Orçamento é governo da conta — mesmo motivo do G1 para
-- ai_settings: quem paga a fatura decide o teto.
create policy "Owners manage ai budgets" on public.ai_budgets
  for all to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = ai_budgets.workspace_id
                   and m.user_id = (select auth.uid()) and m.role = 'owner'))
  with check (exists (select 1 from public.workspace_members m
                      where m.workspace_id = ai_budgets.workspace_id
                        and m.user_id = (select auth.uid()) and m.role = 'owner'));

revoke all on public.ai_budgets from anon;
grant select, insert, update, delete on public.ai_budgets to authenticated;

-- ─── O ledger ────────────────────────────────────────────────────────────
--
-- Uma linha por EXECUÇÃO, não por chamada de API — se uma execução tenta dois
-- provedores em sequência (a política de roteamento permite isso), é a
-- mesma reserva, ajustada quando uma das tentativas conclui.
create table public.ai_ledger (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  brand_id          uuid,
  -- Quem disparou. Nulo só seria aceitável para execução de sistema, que hoje
  -- não existe — toda execução do produto tem uma pessoa por trás.
  user_id           uuid not null references auth.users(id),

  -- A CHAVE DE IDEMPOTÊNCIA. Gerada pelo CLIENTE antes de chamar a rota, e
  -- reenviada se a requisição precisar ser repetida — um duplo clique, um
  -- retry de rede. Sem ela, repetir a chamada reserva duas vezes o mesmo
  -- gasto para o mesmo pedido.
  execution_id      uuid not null unique,

  task              text not null check (task in ('assist', 'analyse-image', 'prompt')),
  provider          text,
  model             text,

  status            text not null default 'reserved'
                       check (status in ('reserved', 'settled', 'released')),
  reserved_micros   bigint not null check (reserved_micros >= 0),
  settled_micros    bigint check (settled_micros >= 0),
  currency          text not null check (currency ~ '^[A-Z]{3}$'),

  created_at        timestamptz not null default now(),
  settled_at        timestamptz,
  released_at       timestamptz,

  constraint ai_ledger_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade,
  -- Consolidar e liberar só fazem sentido depois de reservar, e uma vez cada.
  constraint ai_ledger_settled_coherente
    check (status <> 'settled' or (settled_micros is not null and settled_at is not null)),
  constraint ai_ledger_released_coherente
    check (status <> 'released' or released_at is not null)
);

create index ai_ledger_workspace_idx on public.ai_ledger(workspace_id, created_at desc);
create index ai_ledger_brand_idx on public.ai_ledger(brand_id, created_at desc) where brand_id is not null;
create index ai_ledger_user_idx on public.ai_ledger(user_id, created_at desc);

-- O que decide o consumo de um período é o RESERVADO E AINDA NÃO LIBERADO —
-- 'reserved' conta pelo valor estimado, 'settled' pelo valor real, e
-- 'released' não conta nada. Índice parcial: só as linhas que entram nessa
-- soma, que são a maioria das consultas de orçamento.
create index ai_ledger_ativo_idx on public.ai_ledger(workspace_id, brand_id, created_at)
  where status in ('reserved', 'settled');

alter table public.ai_ledger enable row level security;

-- Owner vê tudo do workspace — é auditoria. Ninguém escreve por aqui
-- diretamente: as três funções abaixo são o único caminho de escrita, porque
-- elas impõem a atomicidade que uma escrita solta não tem.
create policy "Owners read ai ledger" on public.ai_ledger
  for select to authenticated
  using (exists (select 1 from public.workspace_members m
                 where m.workspace_id = ai_ledger.workspace_id
                   and m.user_id = (select auth.uid()) and m.role = 'owner'));

revoke all on public.ai_ledger from anon, authenticated;
grant select on public.ai_ledger to authenticated;

-- ─── Reservar ──────────────────────────────────────────────────────────────
--
-- `security definer`: PRECISA enxergar o consumo de TODO o workspace para
-- somar corretamente, e quem chama pode ser `member` — que não tem select
-- direto em `ai_ledger` por RLS. A checagem de autorização fica DENTRO da
-- função, no lugar da RLS que ela contorna: aqui, "faz parte do workspace"
-- confere primeiro. Sem essa checagem, um `security definer` seria a
-- exposição que o S0 desta auditoria existiu para eliminar.
create or replace function public.reservar_execucao_de_ia(
  p_workspace_id uuid,
  p_brand_id uuid,
  p_execution_id uuid,
  p_task text,
  p_reserved_micros bigint,
  p_currency text
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
  actor uuid := (select auth.uid());
  existente public.ai_ledger%rowtype;
  gasto_workspace bigint;
  gasto_marca bigint;
  teto record;
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

  -- IDEMPOTÊNCIA: já existe reserva para este execution_id? Devolve o que já
  -- está lá, sem reservar de novo. É o que torna seguro reenviar a mesma
  -- requisição depois de uma falha de rede no meio do caminho.
  select * into existente from public.ai_ledger l where l.execution_id = p_execution_id;
  if existente.id is not null then
    return query select true, 'ja_reservado'::text, existente.execution_id, existente.status;
    return;
  end if;

  -- KILL SWITCH primeiro: interrompe sem nem olhar o teto.
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

  -- Sem teto configurado NENHUM: falha FECHADA. "Não é possível consultar
  -- orçamento" não é o mesmo que "sem limite" — é o oposto. Enquanto ninguém
  -- configurou um teto, nenhuma chamada paga acontece.
  select * into teto from public.ai_budgets
   where workspace_id = p_workspace_id and brand_id is null and period = 'daily';
  if teto.id is null then
    return query select false, 'sem_orcamento_configurado'::text, p_execution_id, null::text;
    return;
  end if;

  -- Trava a linha do teto: duas reservas concorrentes do mesmo workspace
  -- esperam a vez uma da outra em vez de lerem o mesmo saldo e as duas
  -- passarem. É isto que torna a reserva atômica de verdade.
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

  -- Teto da MARCA, só quando declarado — é opcional por design.
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
    status, reserved_micros, currency
  ) values (
    p_workspace_id, p_brand_id, actor, p_execution_id, p_task,
    'reserved', p_reserved_micros, p_currency
  );

  return query select true, 'reservado'::text, p_execution_id, 'reserved'::text;
end;
$$;

revoke execute on function public.reservar_execucao_de_ia(uuid, uuid, uuid, text, bigint, text) from public, anon;
grant execute on function public.reservar_execucao_de_ia(uuid, uuid, uuid, text, bigint, text) to authenticated;

-- ─── Consolidar ──────────────────────────────────────────────────────────
--
-- Chamada depois que o provedor devolve o uso real. O custo estimado na
-- reserva quase nunca bate com o cobrado — o consumo real de tokens só se
-- sabe depois da resposta.
create or replace function public.consolidar_execucao_de_ia(
  p_execution_id uuid,
  p_settled_micros bigint,
  p_provider text,
  p_model text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  linha public.ai_ledger%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  select * into linha from public.ai_ledger where execution_id = p_execution_id;
  if linha.id is null then
    raise exception 'no reservation for this execution' using errcode = 'P0002';
  end if;
  if linha.user_id <> actor then
    raise exception 'not the owner of this execution' using errcode = '42501';
  end if;
  -- Consolidar ou liberar duas vezes seria contar a mesma execução duas
  -- vezes no orçamento. Silencioso e não erro: um retry de rede depois de a
  -- primeira tentativa já ter consolidado não deveria derrubar a resposta
  -- que a pessoa já recebeu.
  if linha.status <> 'reserved' then
    return;
  end if;

  update public.ai_ledger
     set status = 'settled', settled_micros = p_settled_micros,
         provider = p_provider, model = p_model, settled_at = now()
   where execution_id = p_execution_id;
end;
$$;

revoke execute on function public.consolidar_execucao_de_ia(uuid, bigint, text, text) from public, anon;
grant execute on function public.consolidar_execucao_de_ia(uuid, bigint, text, text) to authenticated;

-- ─── Liberar ─────────────────────────────────────────────────────────────
--
-- Chamada quando a execução falha antes de produzir uso cobrável — timeout,
-- erro do provedor, cancelamento. Sem isto, toda falha continuaria contando
-- contra o orçamento como se tivesse sido bem-sucedida, e uma sequência de
-- falhas esgotaria o teto sem ninguém ter recebido resposta nenhuma.
create or replace function public.liberar_reserva_de_ia(p_execution_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  linha public.ai_ledger%rowtype;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
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

revoke execute on function public.liberar_reserva_de_ia(uuid) from public, anon;
grant execute on function public.liberar_reserva_de_ia(uuid) to authenticated;

comment on table public.ai_budgets is
  'Tetos de gasto de IA, por workspace ou por marca. Governado só por owner. '
  'Nenhum crédito real é movimentado aqui — é o limite que a reserva confere.';
comment on table public.ai_ledger is
  'Uma linha por execução de IA: reservada antes da chamada, consolidada com '
  'o uso real depois, ou liberada se a execução falhou. execution_id é a '
  'chave de idempotência — reenviar a mesma execução não reserva duas vezes.';
