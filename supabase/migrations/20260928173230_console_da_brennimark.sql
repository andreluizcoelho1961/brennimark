-- O Console da Brennimark — etapa 1: o painel de custos — 28/09/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisões do André, 28/09/2026:
--   1. A IA é da PLATAFORMA: nenhum assinante escolhe ou configura IA. A
--      Brennimark contrata os modelos e paga a conta — a mensalidade cobre IA,
--      armazenamento e manutenção.
--   2. Por isso, "controle financeiro absoluto": saber quanto CADA CONTA e
--      CADA MARCA consome, por mês, sem despesa que ninguém esperava.
--   3. A operação acontece num CONSOLE da Brennimark, dentro do produto, que
--      só a equipe enxerga — e não pelo código.
--
-- Esta etapa é SÓ LEITURA. O que já é gravado — o razão de IA (`ai_ledger`),
-- as fotografias diárias de armazenamento, os limites por conta — passa a ter
-- uma visão ENTRE CONTAS, que nenhuma política de cliente permite (e não deve).
--
-- ─── A equipe ───────────────────────────────────────────────────────────────
--
-- Quem é da equipe mora em `private.equipe_brennimark`: o schema `private` NÃO
-- é exposto pela API, então nenhuma sessão lê, escreve ou sequer enxerga esta
-- lista. Ela muda por SQL de quem administra o banco, nunca por uma tela — uma
-- tela que concedesse acesso de equipe seria a porta mais valiosa do produto.
--
-- A lista nasce VAZIA nesta migration: quem entra nela é dado de produção,
-- inserido à parte e com autorização nominal.
--
-- ─── As funções ─────────────────────────────────────────────────────────────
--
-- Leitura entre contas exige SECURITY DEFINER. Cada função confere, antes de
-- tudo, que a sessão é da equipe, e recusa com 42501 caso contrário — a mesma
-- resposta para visitante, cliente e cliente administrador. `search_path`
-- vazio e nomes qualificados, como as outras.
--
-- ⚖️ Tradeoff: uma tabela e quatro funções. Reversível: apagar tudo não toca em
-- dado de cliente — o Console só LÊ.

create table private.equipe_brennimark (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nome       text not null check (char_length(btrim(nome)) between 1 and 120),
  -- Por que a pessoa está na equipe, para quem ler a lista daqui a um ano.
  motivo     text not null default '' check (char_length(motivo) <= 300),
  created_at timestamptz not null default now()
);

revoke all on private.equipe_brennimark from public, anon, authenticated;

create function private.eh_da_equipe()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (select 1 from private.equipe_brennimark e where e.user_id = (select auth.uid()));
$$;

revoke all on function private.eh_da_equipe() from public, anon, authenticated;

-- A tela pergunta "sou da equipe?" para decidir se o Console EXISTE para a
-- pessoa. Responder `false` a quem não é não revela nada que ela não saiba.
create function public.sou_da_equipe_brennimark()
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.eh_da_equipe();
$$;

revoke all on function public.sou_da_equipe_brennimark() from public, anon;
grant execute on function public.sou_da_equipe_brennimark() to authenticated;

-- ─── IA: o razão, por conta, marca e modelo, num intervalo ──────────────────
--
-- Só execuções LIQUIDADAS: a reservada ainda não tem custo real, e a liberada
-- não custou nada. `sem_uso_medido` conta as liquidadas cujo provedor não
-- informou tokens — o custo delas é o da reserva, e a tela avisa.

create function public.console_custos_de_ia(p_inicio timestamptz, p_fim timestamptz)
returns table (
  workspace_id uuid, conta text, brand_id uuid, marca text,
  provider text, model text, currency text,
  execucoes integer, tokens_entrada bigint, tokens_saida bigint,
  custo_micros bigint, sem_uso_medido integer
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
    select l.workspace_id, w.name, l.brand_id, b.name,
           l.provider, l.model, l.currency,
           count(*)::integer,
           coalesce(sum((l.usage_snapshot->>'inputTokens')::bigint), 0)::bigint,
           coalesce(sum((l.usage_snapshot->>'outputTokens')::bigint), 0)::bigint,
           coalesce(sum(l.settled_micros), 0)::bigint,
           count(*) filter (where l.usage_snapshot ? 'unknown' or not (l.usage_snapshot ? 'inputTokens'))::integer
      from public.ai_ledger l
      join public.workspaces w on w.id = l.workspace_id
      left join public.brands b on b.id = l.brand_id
     where l.status = 'settled'
       and l.created_at >= p_inicio and l.created_at < p_fim
     group by l.workspace_id, w.name, l.brand_id, b.name, l.provider, l.model, l.currency;
end;
$$;

revoke all on function public.console_custos_de_ia(timestamptz, timestamptz) from public, anon;
grant execute on function public.console_custos_de_ia(timestamptz, timestamptz) to authenticated;

-- ─── Armazenamento: a fotografia mais recente até um dia ────────────────────

create function public.console_armazenamento(p_ate date)
returns table (
  workspace_id uuid, conta text, brand_id uuid, marca text,
  bucket_id text, dia date, objetos integer, bytes bigint
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
    with ultimo as (
      select c.workspace_id as ws, max(c.dia) as d
        from public.consumo_de_armazenamento c
       where c.dia <= p_ate
       group by c.workspace_id
    )
    select c.workspace_id, w.name, c.brand_id, b.name, c.bucket_id, c.dia, c.objetos, c.bytes
      from public.consumo_de_armazenamento c
      join ultimo u on u.ws = c.workspace_id and u.d = c.dia
      join public.workspaces w on w.id = c.workspace_id
      left join public.brands b on b.id = c.brand_id;
end;
$$;

revoke all on function public.console_armazenamento(date) from public, anon;
grant execute on function public.console_armazenamento(date) to authenticated;

-- ─── Limites: o teto diário de cada conta e o que já foi gasto hoje ─────────
--
-- A MESMA conta que a reserva faz (`reservar_execucao_de_ia_server`): dia em
-- UTC, reservado ou liquidado. O Console mostra o que o portão enxerga.

create function public.console_limites()
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
                and l.created_at >= date_trunc('day', now())
           ), 0)::bigint
      from public.ai_budgets o
      join public.workspaces w on w.id = o.workspace_id
      left join public.brands b on b.id = o.brand_id;
end;
$$;

revoke all on function public.console_limites() from public, anon;
grant execute on function public.console_limites() to authenticated;
