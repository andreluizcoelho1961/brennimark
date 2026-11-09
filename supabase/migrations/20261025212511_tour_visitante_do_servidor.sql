-- Tour de demonstração — o visitante criado pelo servidor, com cadastro e tetos.
-- Decisão de André em 25/10/2026. Complementa 20261025212445_tour_de_demonstracao.sql
-- (que o desenho de 17/10 escreveu para login anônimo do Supabase) sem reescrevê-la.
--
-- O que muda em relação ao desenho de 17/10:
--
--   1. QUEM é visitante. Antes: login anônimo. Agora: login anônimo OU um usuário
--      que o SERVIDOR criou com `app_metadata.tour = true`. O servidor cria o
--      usuário (e-mail sintético `.invalid`, sem senha utilizável) depois de
--      conferir o captcha, então não é preciso ligar "Anonymous sign-ins" no
--      Supabase, que daria um JWT `authenticated` a qualquer estranho.
--      `app_metadata` só a API de administração escreve; `user_metadata` o
--      próprio usuário edita e NUNCA serve de critério.
--   2. O CADASTRO. A pessoa informa nome e e-mail; o e-mail real vai só para
--      `cadastros_gratuitos` (origem `tour`), nunca para `auth.users`, que fica
--      com o endereço sintético. Assim não colide com um assinante de verdade.
--   3. TETOS DIÁRIOS. Entradas e perguntas por dia, para o custo ter fim mesmo
--      que o captcha falhe. Padrões: 200 entradas e 100 perguntas.
--   4. 2 perguntas por visitante (era 10).
--
-- Reversibilidade: colunas e tabela novas e vazias, funções novas; as funções de
-- 18/10 são substituídas com a mesma assinatura. Desfazer é `drop` do que está aqui
-- e voltar o critério para `is_anonymous`.

-- ─── 1. Quem é visitante ────────────────────────────────────────────────────

create function private.visitante_do_tour(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
      from auth.users u
     where u.id = p_user
       and (u.is_anonymous or (u.raw_app_meta_data ->> 'tour') = 'true')
  );
$$;

revoke all on function private.visitante_do_tour(uuid) from public, anon, authenticated;

-- ─── 2. Tetos e padrão de perguntas ─────────────────────────────────────────

alter table private.demonstracao_config
  alter column perguntas_por_visitante set default 2,
  add column teto_entradas_dia  integer not null default 200
    constraint demonstracao_config_teto_entradas check (teto_entradas_dia between 1 and 100000),
  add column teto_perguntas_dia integer not null default 100
    constraint demonstracao_config_teto_perguntas check (teto_perguntas_dia between 1 and 100000);

-- Um registro por dia (fuso de Brasília: é o dia do André que importa no Console).
create table public.demonstracao_uso_diario (
  dia       date primary key,
  entradas  integer not null default 0 check (entradas >= 0),
  perguntas integer not null default 0 check (perguntas >= 0)
);

alter table public.demonstracao_uso_diario enable row level security;
revoke all on public.demonstracao_uso_diario from public, anon, authenticated;
-- Sem policy e sem grant: só as funções abaixo e a chave de serviço tocam.

-- ─── 3. O visitante aponta para o cadastro ──────────────────────────────────
--
-- `on delete set null`: apagar o cadastro (pedido de exclusão) não pode travar
-- nem apagar o visitante, e o visitante vencido não leva o cadastro junto.

alter table public.demonstracao_visitantes
  add column cadastro_id uuid
    constraint demonstracao_visitantes_cadastro_fkey
    references public.cadastros_gratuitos(id) on delete set null;

create index demonstracao_visitantes_cadastro_idx
  on public.demonstracao_visitantes (cadastro_id) where cadastro_id is not null;

alter table public.cadastros_gratuitos drop constraint cadastros_origem_valida;
alter table public.cadastros_gratuitos add constraint cadastros_origem_valida
  check (primeira_origem in ('kit', 'cores', 'grids', 'fonts', 'tour')
     and ultima_origem   in ('kit', 'cores', 'grids', 'fonts', 'tour'));

-- ─── 4. Critério de visitante nas funções de 18/10 ──────────────────────────

create or replace function public.demonstracao_entrar(p_user uuid)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $$
declare
  c      record;
  expira timestamptz;
begin
  if not private.visitante_do_tour(p_user) then
    raise exception 'sessao_nao_visitante' using errcode = 'P0001';
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

create or replace function public.demonstracao_vencidos()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $$
  select v.user_id
    from public.demonstracao_visitantes v
   where v.expira_em <= now()
     and private.visitante_do_tour(v.user_id)
   order by v.expira_em;
$$;

revoke all on function public.demonstracao_vencidos() from public, anon, authenticated;
grant execute on function public.demonstracao_vencidos() to service_role;

-- Usuários do tour criados e nunca registrados (a entrada falhou no meio): a
-- limpeza apaga depois de 2 h. Só visitante do tour, nunca conta real.
create function public.demonstracao_orfaos()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $$
  select u.id
    from auth.users u
   where u.created_at < now() - interval '2 hours'
     and private.visitante_do_tour(u.id)
     and not exists (select 1 from public.demonstracao_visitantes v where v.user_id = u.id)
   order by u.created_at;
$$;

revoke all on function public.demonstracao_orfaos() from public, anon, authenticated;
grant execute on function public.demonstracao_orfaos() to service_role;

-- O gatilho do registro de acesso: mesma função de 18/10, com o critério novo.
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
    if new.capacidades is not distinct from old.capacidades then
      return new;
    end if;
    alvo := new.user_id; acao_do_evento := 'alterado';
    antes := old.capacidades; depois := new.capacidades;
  end if;

  -- Visitante do tour: sem evento.
  if private.visitante_do_tour(alvo) then
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
    coalesce((select u.email from auth.users u where u.id = (select auth.uid())), '(sistema)'),
    acao_do_evento, antes, depois
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke execute on function private.registrar_acesso_por_marca() from public, anon, authenticated;

-- ─── 5. O contador, agora com o teto do dia ─────────────────────────────────
--
-- Mesma ordem de recusa e mesma atomicidade: a pergunta só conta se passa nos
-- DOIS limites. O teto do dia é reservado depois do limite do visitante e, se
-- ele barra, o gasto do visitante é devolvido na MESMA transação — ninguém vê o
-- valor intermediário, porque a linha do visitante fica travada até o fim.
-- Devolve: 'ok' | 'esgotado' | 'expirado' | 'inativo' | 'desconhecido' | 'teto_do_dia'.

create or replace function public.demonstracao_gastar_pergunta(p_user uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v    record;
  c    record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
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
  if not found then
    select * into v from public.demonstracao_visitantes where user_id = p_user;
    if not found then return 'desconhecido'; end if;
    if v.expira_em <= now() then return 'expirado'; end if;
    return 'esgotado';
  end if;

  insert into public.demonstracao_uso_diario as d (dia, perguntas)
  values (hoje, 1)
  on conflict (dia) do update set perguntas = d.perguntas + 1
    where d.perguntas < c.teto_perguntas_dia;
  if not found then
    -- O teto barrou: desfaz o gasto do visitante e diz qual limite foi.
    update public.demonstracao_visitantes
       set perguntas_feitas = perguntas_feitas - 1
     where user_id = p_user;
    return 'teto_do_dia';
  end if;

  return 'ok';
end;
$$;

revoke all on function public.demonstracao_gastar_pergunta(uuid) from public, anon, authenticated;
grant execute on function public.demonstracao_gastar_pergunta(uuid) to service_role;

-- ─── 6. A entrada completa: teto, perfil, cadastro e destino ────────────────
--
-- É o que a rota chama DEPOIS de criar o usuário e conferir o captcha. Faz numa
-- transação só, então uma falha no meio não deixa meia entrada:
--   * barra pelo teto de entradas do dia (visitante que já existe não gasta);
--   * cria o perfil com o nome informado e o idioma da tela;
--   * liga ao cadastro (e-mail real, já registrado por `registrar_cadastro` com
--     origem `tour`); se não achar, entra sem cadastro, não recusa;
--   * vincula à marca pelo `demonstracao_entrar`.
-- Devolve o destino, que sai do banco: o cliente nunca informa qual marca é.

create function public.demonstracao_receber(
  p_user   uuid,
  p_nome   text,
  p_email  text,
  p_idioma text default 'pt-BR'
)
returns table (expira_em timestamptz, workspace_id uuid, marca_key text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  c         record;
  hoje      date := (now() at time zone 'America/Sao_Paulo')::date;
  ja_existe boolean;
  cadastro  uuid;
  expira    timestamptz;
begin
  if not private.visitante_do_tour(p_user) then
    raise exception 'sessao_nao_visitante' using errcode = 'P0001';
  end if;

  select * into c from private.demonstracao_config where ativo;
  if not found then
    raise exception 'demonstracao_inativa' using errcode = 'P0001';
  end if;

  select exists (select 1 from public.demonstracao_visitantes v where v.user_id = p_user)
    into ja_existe;

  if not ja_existe then
    insert into public.demonstracao_uso_diario as d (dia, entradas)
    values (hoje, 1)
    on conflict (dia) do update set entradas = d.entradas + 1
      where d.entradas < c.teto_entradas_dia;
    if not found then
      raise exception 'demonstracao_lotada' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, locale)
  values (
    p_user,
    -- Endereço sintético: o e-mail real fica só no cadastro.
    'visitante-' || substr(replace(p_user::text, '-', ''), 1, 8) || '@visitante.invalid',
    left(btrim(p_nome), 120),
    case when p_idioma in ('pt-BR', 'en') then p_idioma end
  )
  on conflict (id) do nothing;

  select g.id into cadastro from public.cadastros_gratuitos g where g.email = lower(btrim(p_email));

  expira := public.demonstracao_entrar(p_user);

  update public.demonstracao_visitantes v
     set cadastro_id = cadastro
   where v.user_id = p_user and cadastro is not null;

  return query select expira, c.workspace_id, b.key
                 from public.brands b
                where b.id = c.brand_id and b.workspace_id = c.workspace_id;
end;
$$;

revoke all on function public.demonstracao_receber(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.demonstracao_receber(uuid, text, text, text) to service_role;
