-- Fechamento do P1 do piloto Qwen — item 7 da exigência de fechamento:
-- "preço, moeda e versão do catálogo ficam registrados no ledger".
--
-- `ai_ledger` já gravava `reserved_micros`/`settled_micros`/`currency` — o
-- VALOR. O que faltava era a MEMÓRIA de como aquele valor foi calculado:
-- qual preço por token, de qual fonte, de qual versão do catálogo. Sem
-- isso, se o catálogo mudar de preço amanhã, não há como auditar depois se
-- uma execução antiga foi cobrada certo NO MOMENTO em que aconteceu — a
-- pergunta "por que essa reserva foi X microUSD?" ficaria sem resposta.
--
-- Dois snapshots, dois momentos, os dois IMUTÁVEIS depois de escritos:
--
-- `price_snapshot` — o preço vigente na RESERVA (antes da chamada, uma
-- estimativa). Nunca é escrito de novo depois — nem por consolidar, nem por
-- liberar. Uma mudança futura no catálogo não reescreve contabilmente
-- chamadas antigas: cada linha carrega o preço que valia quando ela
-- aconteceu.
--
-- `usage_snapshot` — os tokens/unidades REALMENTE medidos pelo provedor,
-- escrito na CONSOLIDAÇÃO (depois da chamada, o valor real). Junto com
-- `price_snapshot`, reconstrói como `settled_micros` foi calculado, sem
-- precisar confiar só no número final.

alter table public.ai_ledger
  add column price_snapshot jsonb,
  add column usage_snapshot jsonb;

comment on column public.ai_ledger.price_snapshot is
  'Preço vigente NO MOMENTO da reserva: provedor, modelo, versão do '
  'catálogo (CATALOGO_VERSION), preço de entrada/cache/saída/imagem por '
  'milhão de tokens, moeda, fonte (URL) e data de conferência. Gravado uma '
  'vez, na reserva, e nunca alterado depois — nem por consolidar, nem por '
  'liberar. Nulo para linhas anteriores a esta migração.';
comment on column public.ai_ledger.usage_snapshot is
  'Tokens/unidades REALMENTE medidos pelo provedor — entrada, cache, '
  'saída, imagem — gravados na consolidação, quando o uso real é '
  'conhecido. Nulo até a linha ser consolidada, e nulo para linhas '
  'anteriores a esta migração.';

-- ─── Reservar: aceita o snapshot de preço, opcional ────────────────────────
--
-- `create or replace function` com uma lista de parâmetros DIFERENTE não
-- substitui a função — cria um OVERLOAD novo ao lado do antigo, porque o
-- Postgres identifica função por nome+tipos dos parâmetros. Sem o `drop`
-- abaixo, a versão de 6 parâmetros continuaria existindo, sem snapshot
-- nenhum, e uma chamada com 6 argumentos cairia nela por engano.
drop function if exists public.reservar_execucao_de_ia(uuid, uuid, uuid, text, bigint, text);

-- Parâmetro novo NO FIM, com default — quem ainda chama com 6 argumentos
-- continua funcionando, agora contra esta MESMA função (sem overload
-- duplicado). O snapshot é só gravado, nunca interpretado pela função: quem
-- sabe o preço é o catálogo (TypeScript), não o banco.
create or replace function public.reservar_execucao_de_ia(
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

revoke execute on function public.reservar_execucao_de_ia(uuid, uuid, uuid, text, bigint, text, jsonb) from public, anon;
grant execute on function public.reservar_execucao_de_ia(uuid, uuid, uuid, text, bigint, text, jsonb) to authenticated;

-- ─── Consolidar: aceita o snapshot de uso real, opcional ───────────────────
drop function if exists public.consolidar_execucao_de_ia(uuid, bigint, text, text);

create or replace function public.consolidar_execucao_de_ia(
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

  update public.ai_ledger
     set status = 'settled', settled_micros = p_settled_micros,
         provider = p_provider, model = p_model, settled_at = now(),
         usage_snapshot = p_usage_snapshot
   where execution_id = p_execution_id;
end;
$$;

revoke execute on function public.consolidar_execucao_de_ia(uuid, bigint, text, text, jsonb) from public, anon;
grant execute on function public.consolidar_execucao_de_ia(uuid, bigint, text, text, jsonb) to authenticated;
