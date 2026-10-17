-- Os cadastros gratuitos — a lista de quem usa as ferramentas do site — 17/10/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André (17/10/2026): Kit, Cores, Grids e o pedido de convite do
-- Fonts passam a pedir um cadastro (e-mail, nome, agência, algumas perguntas)
-- na hora de BAIXAR ou EXPORTAR, para o Brennimark ter uma lista de designers
-- e agências a quem escrever depois. A assinatura continua sendo outra coisa.
--
-- É um CADASTRO, NÃO UMA CONTA DE LOGIN. O login do produto é de time e fechado
-- desde 17/09/2026: abrir o cadastro do Supabase reabriria a porta pela qual
-- qualquer visitante virava dono de uma conta (gatilho `handle_new_profile`).
-- Aqui ninguém ganha sessão, senha nem acesso à plataforma: é só uma linha.
--
-- ─── Quem faz o quê ─────────────────────────────────────────────────────────
--
--   * ninguém pela sessão — nem o visitante, nem quem está logado — lê, grava,
--     altera ou apaga: `revoke all`, RLS sem policy. A lista tem e-mail de
--     terceiros, e o que um visitante não pode é ler a lista dos outros;
--   * só o servidor (service_role) grava, pela função `registrar_cadastro`, e só
--     ele lê (o Console);
--   * o e-mail vai sempre em minúsculas (a constraint confere), e é único: quem
--     volta a se cadastrar atualiza a mesma linha, em vez de criar outra.
--
-- ─── Consentimento (LGPD) ───────────────────────────────────────────────────
--
-- O aceite de marketing nasce DESMARCADO. Quando marcado, o banco guarda a
-- versão do texto aceito e a data — a prova de que a pessoa consentiu com
-- aquelas palavras. Uma nova inscrição SEM a caixa nunca retira um aceite já
-- dado (a pessoa sai pelo link próprio); COM a caixa, renova o aceite e desfaz
-- um descadastro anterior.
--
-- `token_de_saida` é o segredo do link de descadastro e de exclusão que irá em
-- todo e-mail enviado à lista. As duas funções por token só o servidor chama.
--
-- ⚖️ Tradeoff: tabela nova, sem relação com `auth.users`, workspaces ou marcas,
-- e sem cascata de nada. Reversível: apagá-la não afeta nenhuma outra parte do
-- produto. As perguntas da pesquisa moram em `respostas` (jsonb), para mudar a
-- lista de perguntas sem migration.

create table public.cadastros_gratuitos (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  nome                text not null,
  agencia             text,
  cargo               text,
  -- As respostas da pesquisa: equipe, marcas, como conheceu… O app valida as
  -- chaves; o banco só garante que é um objeto pequeno.
  respostas           jsonb not null default '{}'::jsonb,
  primeira_origem     text not null,
  ultima_origem       text not null,
  usos                integer not null default 1,
  aceite_marketing    boolean not null default false,
  aceite_versao       text,
  aceite_em           timestamptz,
  descadastrado_em    timestamptz,
  token_de_saida      uuid not null default gen_random_uuid(),
  criado_em           timestamptz not null default now(),
  ultimo_uso_em       timestamptz not null default now(),

  constraint cadastros_email_unico        unique (email),
  constraint cadastros_token_unico        unique (token_de_saida),
  constraint cadastros_email_em_minusculas check (email = lower(email)),
  constraint cadastros_email_valido       check (length(email) <= 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint cadastros_nome_valido        check (length(btrim(nome)) between 1 and 120),
  constraint cadastros_agencia_valida     check (agencia is null or length(agencia) <= 120),
  constraint cadastros_cargo_valido       check (cargo is null or cargo in ('diretor-de-arte', 'designer', 'atendimento', 'marketing', 'freelancer', 'outro')),
  constraint cadastros_respostas_valida   check (jsonb_typeof(respostas) = 'object' and octet_length(respostas::text) <= 2000),
  constraint cadastros_origem_valida      check (primeira_origem in ('kit', 'cores', 'grids', 'fonts') and ultima_origem in ('kit', 'cores', 'grids', 'fonts')),
  constraint cadastros_usos_positivo      check (usos >= 1),
  -- Aceite sem versão e data não prova nada.
  constraint cadastros_aceite_com_prova   check (not aceite_marketing or (aceite_versao is not null and aceite_em is not null)),
  constraint cadastros_aceite_versao_em_data check (aceite_versao is null or aceite_versao ~ '^\d{4}-\d{2}-\d{2}$')
);

-- A lista de quem aceitou receber e-mail, a consulta do marketing.
create index cadastros_gratuitos_aceite_idx on public.cadastros_gratuitos (criado_em desc)
  where aceite_marketing and descadastrado_em is null;

alter table public.cadastros_gratuitos enable row level security;
revoke all on table public.cadastros_gratuitos from public, anon, authenticated;
-- Explícito: no Supabase hospedado as tabelas novas ganham privilégios por
-- padrão, e no local não — o que vale é o que está escrito aqui.
grant select on table public.cadastros_gratuitos to service_role;

-- Grava ou atualiza o cadastro. Só o servidor chama: o e-mail e a origem vêm da
-- rota, que os valida antes, e uma função chamável pela sessão deixaria
-- qualquer um forjar aceite de marketing em nome de outro e-mail.
create function public.registrar_cadastro(
  p_email text,
  p_nome text,
  p_agencia text,
  p_cargo text,
  p_respostas jsonb,
  p_origem text,
  p_aceite_marketing boolean,
  p_aceite_versao text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.cadastros_gratuitos as c
    (email, nome, agencia, cargo, respostas, primeira_origem, ultima_origem,
     aceite_marketing, aceite_versao, aceite_em)
  values
    (p_email, p_nome, p_agencia, p_cargo, coalesce(p_respostas, '{}'::jsonb), p_origem, p_origem,
     coalesce(p_aceite_marketing, false),
     case when coalesce(p_aceite_marketing, false) then p_aceite_versao end,
     case when coalesce(p_aceite_marketing, false) then now() end)
  on conflict (email) do update set
    nome             = excluded.nome,
    agencia          = coalesce(excluded.agencia, c.agencia),
    cargo            = coalesce(excluded.cargo, c.cargo),
    respostas        = c.respostas || excluded.respostas,
    ultima_origem    = excluded.ultima_origem,
    usos             = c.usos + 1,
    ultimo_uso_em    = now(),
    -- Marcar a caixa renova o aceite e desfaz um descadastro; deixar
    -- desmarcada NUNCA retira um aceite já dado.
    aceite_marketing = c.aceite_marketing or excluded.aceite_marketing,
    aceite_versao    = case when excluded.aceite_marketing then excluded.aceite_versao else c.aceite_versao end,
    aceite_em        = case when excluded.aceite_marketing then excluded.aceite_em else c.aceite_em end,
    descadastrado_em = case when excluded.aceite_marketing then null else c.descadastrado_em end;
end;
$$;

-- O link do e-mail: para de receber, e a pessoa continua na lista só como
-- registro de que saiu (para não ser reinscrita sem a caixa marcada).
create function public.descadastrar_cadastro(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  achou integer;
begin
  update public.cadastros_gratuitos
     set aceite_marketing = false, descadastrado_em = now()
   where token_de_saida = p_token;
  get diagnostics achou = row_count;
  return achou > 0;
end;
$$;

-- A exclusão que a LGPD garante: apaga a linha inteira.
create function public.apagar_cadastro(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  achou integer;
begin
  delete from public.cadastros_gratuitos where token_de_saida = p_token;
  get diagnostics achou = row_count;
  return achou > 0;
end;
$$;

revoke execute on function public.registrar_cadastro(text, text, text, text, jsonb, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.descadastrar_cadastro(uuid) from public, anon, authenticated;
revoke execute on function public.apagar_cadastro(uuid) from public, anon, authenticated;
grant execute on function public.registrar_cadastro(text, text, text, text, jsonb, text, boolean, text) to service_role;
grant execute on function public.descadastrar_cadastro(uuid) to service_role;
grant execute on function public.apagar_cadastro(uuid) to service_role;
