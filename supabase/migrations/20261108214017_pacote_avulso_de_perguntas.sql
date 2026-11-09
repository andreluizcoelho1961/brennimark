-- Pacote avulso de perguntas (08/11/2026) — decisão do André: 100 por R$ 29 e 500 por R$ 119,
-- válidos até o fim do mês seguinte ao da compra, pagos uma vez por cartão (Stripe, modo payment).
-- Desenho: docs/plan/pacote-avulso-de-perguntas.md.
--
-- O QUE MUDA
--   - tabela `pacotes_de_perguntas`: uma linha por compra confirmada. A dona da conta lê as da
--     própria conta; ninguém escreve pelo navegador. `unique (provedor, sessao_externa)` é a
--     idempotência do webhook: o Stripe repete avisos, e a mesma sessão nunca credita duas vezes;
--   - `creditar_pacote_de_perguntas` (só chave de serviço): grava a compra;
--   - `private.franquia_da_conta` passa a somar à franquia do plano as perguntas avulsas ainda
--     válidas. A função de reserva NÃO muda: ela já compara o uso do mês com `franquia_da_conta`;
--   - `uso_do_vini_da_conta` devolve também quanto vem do plano e quanto vem de pacotes.
--
-- COMO O SALDO É CALCULADO (sem coluna de "restante", que precisaria ser devolvida quando uma
-- reserva é liberada). Para cada mês k desde a primeira compra:
--     entra   = perguntas compradas em k
--     sobra   = o que sobrou dos pacotes do mês anterior (vale até o fim de k)
--     excesso = max(0, perguntas usadas em k − franquia do plano)
--   O excesso consome primeiro a sobra (vence antes) e depois o que entrou em k:
--     sobra(k+1) = max(0, entra − max(0, excesso − sobra))
--   Franquia efetiva do mês atual = franquia do plano + sobra + entra. O consumo já está na
--   contagem de perguntas do mês, então não se desconta de novo.
--   Limite conhecido: usa a franquia ATUAL do plano para os meses antigos; quem trocou de plano
--   no meio do caminho pode ver o saldo de um mês passado recalculado. Só afeta quem comprou
--   pacote em dois meses seguidos e mudou de plano entre eles.
--
-- Reembolso: `estornado_em` tira a compra da conta. Preenchido à mão (pelo André), como os demais
-- estornos. Reversibilidade: a tabela e as duas funções se removem; `franquia_da_conta` volta à
-- versão de `20261108140544`. Nenhum dado existente muda.

create table public.pacotes_de_perguntas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  codigo text not null check (length(codigo) between 1 and 40),
  quantidade integer not null check (quantidade > 0 and quantidade <= 100000),
  valor_centavos integer not null check (valor_centavos > 0),
  moeda text not null default 'BRL' check (moeda in ('BRL', 'USD')),
  provedor text not null default 'stripe',
  sessao_externa text not null check (length(sessao_externa) between 1 and 255),
  comprado_em timestamptz not null default now(),
  estornado_em timestamptz,
  constraint pacotes_de_perguntas_sessao_unica unique (provedor, sessao_externa)
);

create index pacotes_de_perguntas_da_conta on public.pacotes_de_perguntas (workspace_id, comprado_em);

alter table public.pacotes_de_perguntas enable row level security;

revoke all on public.pacotes_de_perguntas from public, anon, authenticated;
grant select on public.pacotes_de_perguntas to authenticated;

create policy pacotes_de_perguntas_leitura_da_dona on public.pacotes_de_perguntas
  for select to authenticated
  using (workspace_id in (
    select m.workspace_id from public.workspace_members m
     where m.user_id = (select auth.uid()) and m.role = 'owner'
  ));

-- ─── Perguntas usadas num mês qualquer ───────────────────────────────────

create function private.perguntas_no_mes_de(p_workspace_id uuid, p_inicio timestamptz)
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
     and l.created_at >= p_inicio
     and l.created_at < p_inicio + interval '1 month';
$$;

revoke all on function private.perguntas_no_mes_de(uuid, timestamptz) from public, anon, authenticated;

-- ─── Quanto os pacotes somam à franquia do mês atual ─────────────────────

create function private.perguntas_de_pacotes_no_mes(p_workspace_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  plano integer;
  atual timestamptz := date_trunc('month', now());
  mes timestamptz;
  entra integer;
  sobra integer := 0;
  excesso integer;
begin
  select min(date_trunc('month', p.comprado_em)) into mes
    from public.pacotes_de_perguntas p
   where p.workspace_id = p_workspace_id and p.estornado_em is null;
  if mes is null then return 0; end if;

  plano := coalesce(private.franquia_do_plano(p_workspace_id), 0);

  loop
    select coalesce(sum(p.quantidade), 0)::integer into entra
      from public.pacotes_de_perguntas p
     where p.workspace_id = p_workspace_id and p.estornado_em is null
       and date_trunc('month', p.comprado_em) = mes;
    if mes >= atual then
      return sobra + entra;
    end if;
    excesso := greatest(0, private.perguntas_no_mes_de(p_workspace_id, mes) - plano);
    sobra := greatest(0, entra - greatest(0, excesso - sobra));
    mes := mes + interval '1 month';
  end loop;
end;
$$;

revoke all on function private.perguntas_de_pacotes_no_mes(uuid) from public, anon, authenticated;

-- ─── A franquia: a do plano, e a efetiva (plano + pacotes) ───────────────

create function private.franquia_do_plano(p_workspace_id uuid)
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

revoke all on function private.franquia_do_plano(uuid) from public, anon, authenticated;

-- Plano sem franquia (nula) continua sem franquia: pacote não se aplica a quem não tem cota.
create or replace function private.franquia_da_conta(p_workspace_id uuid)
returns integer
language sql
stable
security definer
set search_path to ''
as $$
  select private.franquia_do_plano(p_workspace_id)
         + private.perguntas_de_pacotes_no_mes(p_workspace_id);
$$;

revoke all on function private.franquia_da_conta(uuid) from public, anon, authenticated;

-- ─── Creditar a compra (só o webhook, com a chave de serviço) ────────────
--
-- Devolve true se creditou agora e false se a sessão já estava creditada (aviso repetido).
-- Recusa conta sem franquia: pacote não faz sentido onde não há cota, e o dinheiro já teria
-- sido cobrado — por isso a recusa é um erro que sobe e fica visível, não um "ignorado".

create function public.creditar_pacote_de_perguntas(
  p_workspace_id uuid, p_codigo text, p_quantidade integer, p_valor_centavos integer,
  p_moeda text, p_sessao_externa text
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  linhas integer;
begin
  if private.franquia_do_plano(p_workspace_id) is null then
    raise exception 'conta sem franquia de perguntas' using errcode = '22023', hint = 'pacote_sem_franquia';
  end if;

  insert into public.pacotes_de_perguntas (workspace_id, codigo, quantidade, valor_centavos, moeda, sessao_externa)
  values (p_workspace_id, p_codigo, p_quantidade, p_valor_centavos, p_moeda, p_sessao_externa)
  on conflict on constraint pacotes_de_perguntas_sessao_unica do nothing;
  get diagnostics linhas = row_count;
  return linhas = 1;
end;
$$;

revoke all on function public.creditar_pacote_de_perguntas(uuid, text, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.creditar_pacote_de_perguntas(uuid, text, integer, integer, text, text) to service_role;

-- ─── O uso, agora com a origem da franquia ───────────────────────────────

create or replace function public.uso_do_vini_da_conta(p_workspace_id uuid)
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
    'franquia_do_plano', private.franquia_do_plano(p_workspace_id),
    'perguntas_de_pacotes', case when private.franquia_do_plano(p_workspace_id) is null then 0
                                 else private.perguntas_de_pacotes_no_mes(p_workspace_id) end,
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
