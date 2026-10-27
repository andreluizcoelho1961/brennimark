-- Tour de demonstração — fatia 1: o banco.
-- Decisão de André em 17/10/2026 (docs/plan/tour-de-demonstracao.md): quem não
-- assina entra, sem cadastro, numa marca de exemplo e conversa com o Vini.
--
-- O visitante é um login ANÔNIMO do Supabase (`auth.users.is_anonymous`). Por
-- ser um usuário real, o portão de IA, a RLS, o orçamento por conta e a trava
-- geral valem para ele sem código novo de autorização. O que esta migration
-- acrescenta é só o que o tour precisa e o resto do produto não tem:
--
--   1. QUAL é a marca do tour (uma linha, que só a chave de serviço lê — o
--      cliente nunca informa a marca);
--   2. a ENTRADA: vincula o visitante à marca com `consultar` e nada mais;
--   3. o CONTADOR de perguntas e a validade da sessão;
--   4. a lista dos VENCIDOS, para a limpeza apagar só login anônimo.
--
-- ─── O que NÃO está aqui ────────────────────────────────────────────────────
--
-- A marca do tour. Recriar marca por SQL é proibido (CLAUDE.md): a conta
-- "Demonstração" e o manual entram pela tela de importação, como o cliente
-- faz, e só então a linha de `private.demonstracao_config` é preenchida e
-- `ativo` vira verdadeiro. Até lá o tour está DESLIGADO — a tabela nasce
-- vazia e a entrada recusa.
--
-- ─── Por que o apagamento do visitante funciona ─────────────────────────────
--
-- A migration de 24/09 (conta_removida) já fez o que a limpeza precisa: o
-- razão de IA guarda o consumo com `user_id` nulo, as participações saem antes
-- do login e as conversas somem junto. Apagar um login anônimo não trava.
--
-- Reversibilidade: tabelas novas e vazias, funções novas; nada existente muda
-- de forma, exceto o gatilho do registro de acesso (seção 5), que ganha uma
-- guarda. Desfazer é `drop` das três funções e das duas tabelas.

-- ─── 1. Qual é a marca do tour ──────────────────────────────────────────────

create table private.demonstracao_config (
  -- Linha única: o tour é um só. `check (id)` + chave primária impedem a segunda.
  id                      boolean primary key default true check (id),
  workspace_id            uuid not null,
  brand_id                uuid not null,
  ativo                   boolean not null default false,
  perguntas_por_visitante integer not null default 10
                            check (perguntas_por_visitante between 1 and 100),
  validade_horas          integer not null default 24
                            check (validade_horas between 1 and 168),
  atualizado_em           timestamptz not null default now(),

  -- Composta, como todo vínculo com marca neste esquema: a marca precisa ser
  -- DESTA conta. Apagar a marca apaga a configuração, que desliga o tour.
  constraint demonstracao_config_marca_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade
);

alter table private.demonstracao_config enable row level security;
revoke all on private.demonstracao_config from public, anon, authenticated;

-- ─── 2. Quem está no tour ───────────────────────────────────────────────────

create table public.demonstracao_visitantes (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  criado_em        timestamptz not null default now(),
  expira_em        timestamptz not null,
  perguntas_feitas integer not null default 0 check (perguntas_feitas >= 0)
);

-- A limpeza pergunta "quem venceu?" todo dia.
create index demonstracao_visitantes_expira_idx on public.demonstracao_visitantes (expira_em);

alter table public.demonstracao_visitantes enable row level security;
revoke all on public.demonstracao_visitantes from public, anon, authenticated;

-- O visitante lê só a PRÓPRIA linha (a faixa do tour mostra "7 de 10"). Nenhum
-- papel comum escreve: entrada e contador passam pelas funções abaixo.
grant select on public.demonstracao_visitantes to authenticated;
create policy "O visitante vê a própria sessão" on public.demonstracao_visitantes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ─── 3. A entrada ───────────────────────────────────────────────────────────
--
-- Só a chave de serviço executa; o servidor chama DEPOIS de criar a sessão
-- anônima e de conferir o Turnstile. Recusa quem não é anônimo: sem isso, o
-- servidor podia por engano pôr um assinante no tour — e a limpeza, que
-- apaga login, não deve poder alcançar uma conta real.

create function public.demonstracao_entrar(p_user uuid)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $$
declare
  anonimo boolean;
  c       record;
  expira  timestamptz;
begin
  select u.is_anonymous into anonimo from auth.users u where u.id = p_user;
  if anonimo is distinct from true then
    raise exception 'sessao_nao_anonima' using errcode = 'P0001';
  end if;

  select * into c from private.demonstracao_config where ativo;
  if not found then
    raise exception 'demonstracao_inativa' using errcode = 'P0001';
  end if;

  insert into public.demonstracao_visitantes (user_id, expira_em)
  values (p_user, now() + make_interval(hours => c.validade_horas))
  on conflict (user_id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (c.workspace_id, p_user, 'member')
  on conflict do nothing;

  -- `consultar` e mais nada: é a cerca que impede upload e edição.
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
  values (c.brand_id, c.workspace_id, p_user, array['consultar']::text[])
  on conflict (brand_id, user_id) do nothing;

  select v.expira_em into expira from public.demonstracao_visitantes v where v.user_id = p_user;
  return expira;
end;
$$;

revoke all on function public.demonstracao_entrar(uuid) from public, anon, authenticated;
grant execute on function public.demonstracao_entrar(uuid) to service_role;

-- ─── 4. O contador ──────────────────────────────────────────────────────────
--
-- Um único `update` condicional: a checagem e o gasto são a MESMA instrução,
-- então duas abas perguntando ao mesmo tempo não furam o limite (a segunda
-- espera a linha e relê o valor novo).
--
-- Devolve o motivo em texto, para o servidor dizer ao visitante qual limite
-- barrou: 'ok' | 'esgotado' | 'expirado' | 'inativo' | 'desconhecido'.

create function public.demonstracao_gastar_pergunta(p_user uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v record;
  c record;
begin
  select * into c from private.demonstracao_config;
  if not found or not c.ativo then
    return 'inativo';
  end if;

  update public.demonstracao_visitantes
     set perguntas_feitas = perguntas_feitas + 1
   where user_id = p_user
     and perguntas_feitas < c.perguntas_por_visitante
     and expira_em > now();
  if found then
    return 'ok';
  end if;

  select * into v from public.demonstracao_visitantes where user_id = p_user;
  if not found then
    return 'desconhecido';
  end if;
  if v.expira_em <= now() then
    return 'expirado';
  end if;
  return 'esgotado';
end;
$$;

revoke all on function public.demonstracao_gastar_pergunta(uuid) from public, anon, authenticated;
grant execute on function public.demonstracao_gastar_pergunta(uuid) to service_role;

-- ─── 5. Os vencidos, para a limpeza ─────────────────────────────────────────
--
-- Só login ANÔNIMO: a limpeza apaga login pela API de administração, e essa
-- lista é a única fonte do que ela apaga. Uma conta real nunca aparece aqui,
-- mesmo que alguém grave uma linha em `demonstracao_visitantes` à mão.

create function public.demonstracao_vencidos()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $$
  select v.user_id
    from public.demonstracao_visitantes v
    join auth.users u on u.id = v.user_id
   where v.expira_em <= now()
     and u.is_anonymous
   order by v.expira_em;
$$;

revoke all on function public.demonstracao_vencidos() from public, anon, authenticated;
grant execute on function public.demonstracao_vencidos() to service_role;

-- ─── 6. O registro de acesso não é lixeira de visitante ─────────────────────
--
-- O gatilho de `brand_members` grava um evento "concedido" e outro "revogado"
-- por visitante, para sempre (o registro é append-only). Com milhares de
-- visitantes, o Registros da marca do tour viraria ruído que ninguém abre. A
-- única mudança é a guarda no começo: login anônimo não gera evento. O resto é
-- a função de 13/09 como estava.

create or replace function private.registrar_acesso_por_marca()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  alvo          uuid;
  acao_do_evento text;
  antes         text[];
  depois        text[];
begin
  if tg_op = 'DELETE' then
    alvo := old.user_id; acao_do_evento := 'revogado';
    antes := old.capacidades; depois := null;
  elsif tg_op = 'INSERT' then
    alvo := new.user_id; acao_do_evento := 'concedido';
    antes := null; depois := new.capacidades;
  else
    -- Alteração que não mexe nas capacidades não é evento de acesso. Sem esta
    -- guarda, qualquer `touch` na linha encheria o registro de ruído — e um
    -- registro ruidoso é um registro que ninguém abre.
    if new.capacidades is not distinct from old.capacidades then
      return new;
    end if;
    alvo := new.user_id; acao_do_evento := 'alterado';
    antes := old.capacidades; depois := new.capacidades;
  end if;

  -- Visitante do tour (login anônimo): sem evento.
  if exists (select 1 from auth.users u where u.id = alvo and u.is_anonymous) then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.brand_access_log (
    brand_id, workspace_id, pessoa, autor, pessoa_email, autor_email,
    acao, capacidades_antes, capacidades_depois
  )
  values (
    coalesce(new.brand_id, old.brand_id),
    coalesce(new.workspace_id, old.workspace_id),
    alvo,
    (select auth.uid()),
    coalesce((select u.email from auth.users u where u.id = alvo), '(conta removida)'),
    -- Sem sessão o autor é o sistema: semeadura, chave de serviço, SQL de
    -- manutenção. Dizer "desconhecido" seria esconder que a causa é conhecida.
    coalesce((select u.email from auth.users u where u.id = (select auth.uid())), '(sistema)'),
    acao_do_evento, antes, depois
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function private.registrar_acesso_por_marca() from public, anon, authenticated;
