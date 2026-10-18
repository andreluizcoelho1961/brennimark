-- A confirmação por e-mail (double opt-in) da lista de cadastros — 18/10/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André (18/10/2026): só recebe e-mail de marketing quem CONFIRMOU
-- que o endereço é dele. Sem isso, qualquer pessoa inscreveria o e-mail de
-- outra (a caixa de marketing vem marcada por quem digita), a lista juntaria
-- endereços que nunca pediram nada, e não haveria prova de que o dono do
-- endereço consentiu. A LGPD pede consentimento livre e demonstrável.
--
-- Quem só baixa a ferramenta NÃO precisa confirmar nada. A confirmação vale
-- para o marketing: marcar a caixa dispara um e-mail com um botão, e só o clique
-- no botão (POST em `/api/cadastro/confirmar`, nunca GET) torna a pessoa elegível.
--
-- ─── O que muda ─────────────────────────────────────────────────────────────
--
--   * `confirmado_em`: quando o dono clicou em confirmar. Só existe com aceite.
--   * `confirmacao_enviada_em`: quando saiu o último e-mail de confirmação. É o
--     limite de UM e-mail por endereço a cada 24 horas: sem ele, qualquer um
--     usaria o formulário para encher a caixa de entrada de outra pessoa.
--   * Elegível ao marketing = aceitou E confirmou E não saiu.
--   * Sair, ou voltar depois de sair, ZERA a confirmação: quem retorna confirma
--     de novo.
--
-- O código secreto é o mesmo `token_de_saida` (decisão do André): um só segredo
-- por pessoa serve a confirmar, sair e apagar.
--
-- ─── Ordem de entrada ───────────────────────────────────────────────────────
--
-- A migration vem ANTES do código. `registrar_cadastro` passa a devolver jsonb
-- em vez de nada, e o código atual ignora o retorno, então nada quebra no meio.
--
-- ⚖️ Tradeoff: parte das pessoas não vai clicar, e a lista de marketing fica
-- menor que a de cadastros. Reversível: duas colunas que aceitam vazio.

alter table public.cadastros_gratuitos
  add column confirmado_em timestamptz,
  add column confirmacao_enviada_em timestamptz,
  add constraint cadastros_confirmacao_com_aceite check (confirmado_em is null or aceite_marketing);

-- A lista de quem pode receber e-mail: aceitou, confirmou e não saiu.
drop index public.cadastros_gratuitos_aceite_idx;
create index cadastros_gratuitos_elegiveis_idx on public.cadastros_gratuitos (criado_em desc)
  where aceite_marketing and confirmado_em is not null and descadastrado_em is null;

-- A função muda de retorno (void → jsonb), então sai e entra de novo, com os
-- mesmos privilégios: só o servidor chama.
drop function public.registrar_cadastro(text, text, text, text, jsonb, text, boolean, text);

-- Grava ou atualiza o cadastro e diz se é preciso mandar o e-mail de confirmação.
-- Devolve `{"confirmar": bool, "token": uuid|null}`; o token só sai quando o
-- e-mail vai de fato ser enviado.
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
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_token uuid;
  v_aceite boolean;
  v_confirmado timestamptz;
  v_enviada timestamptz;
  v_pedir boolean := false;
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
    -- Quem volta depois de sair confirma de novo; quem já confirmou e segue
    -- inscrito continua confirmado.
    confirmado_em    = case when excluded.aceite_marketing and c.descadastrado_em is not null then null else c.confirmado_em end,
    descadastrado_em = case when excluded.aceite_marketing then null else c.descadastrado_em end;

  select token_de_saida, aceite_marketing, confirmado_em, confirmacao_enviada_em
    into v_token, v_aceite, v_confirmado, v_enviada
    from public.cadastros_gratuitos
   where email = p_email;

  -- Pede confirmação só se aceitou, ainda não confirmou, e não mandamos outra
  -- nas últimas 24 horas.
  if v_aceite and v_confirmado is null and (v_enviada is null or v_enviada < now() - interval '24 hours') then
    update public.cadastros_gratuitos set confirmacao_enviada_em = now() where email = p_email;
    v_pedir := true;
  end if;

  return jsonb_build_object('confirmar', v_pedir, 'token', case when v_pedir then v_token end);
end;
$$;

-- O clique no botão do e-mail. Só vale para quem aceitou e não saiu; chamar de
-- novo não muda nada (a data da primeira confirmação fica).
create function public.confirmar_cadastro(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  achou integer;
begin
  update public.cadastros_gratuitos
     set confirmado_em = coalesce(confirmado_em, now())
   where token_de_saida = p_token and aceite_marketing and descadastrado_em is null;
  get diagnostics achou = row_count;
  return achou > 0;
end;
$$;

-- Sair agora também zera a confirmação: quem volta confirma de novo.
create or replace function public.descadastrar_cadastro(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  achou integer;
begin
  update public.cadastros_gratuitos
     set aceite_marketing = false, confirmado_em = null, descadastrado_em = now()
   where token_de_saida = p_token;
  get diagnostics achou = row_count;
  return achou > 0;
end;
$$;

revoke execute on function public.registrar_cadastro(text, text, text, text, jsonb, text, boolean, text) from public, anon, authenticated;
revoke execute on function public.confirmar_cadastro(uuid) from public, anon, authenticated;
revoke execute on function public.descadastrar_cadastro(uuid) from public, anon, authenticated;
grant execute on function public.registrar_cadastro(text, text, text, text, jsonb, text, boolean, text) to service_role;
grant execute on function public.confirmar_cadastro(uuid) to service_role;
grant execute on function public.descadastrar_cadastro(uuid) to service_role;
