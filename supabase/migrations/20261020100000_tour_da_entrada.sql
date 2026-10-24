-- Tour de demonstração — fatia 2a: o banco da entrada. Desenho em
-- docs/plan/tour-de-demonstracao.md §11, aprovado por André em 20/10/2026.
--
-- O que muda em relação à fatia 1 (20261018100000):
--
--   1. `demonstracao_entrar` passa a CRIAR O PERFIL do visitante e a devolver o
--      destino (conta e marca) além da validade. Sem perfil com nome o `/docs`
--      manda a pessoa ao onboarding; com ele, e com uma só marca, o resolvedor
--      leva direto ao manual. O onboarding não é tocado.
--   2. `demonstracao_orfaos` lista os logins anônimos que nunca passaram pela
--      entrada — o rastro de quem criou o login e não passou no captcha.
--
-- ─── Por que criar o perfil é seguro ────────────────────────────────────────
--
-- Até 17/09/2026 `handle_new_profile` abria uma conta nova e punha a pessoa
-- como dona. Hoje ele só chama `private.converter_concessoes(id, email)`, que
-- converte concessões PENDENTES para aquele e-mail. O e-mail do visitante é
-- sintético, de um domínio que nunca entrega (`.invalid`, RFC 2606 — o mesmo
-- recurso da conta removida), então nenhuma concessão casa com ele. A prova
-- confere: o visitante não ganha nenhum vínculo além do da marca do tour.
--
-- ─── O que NÃO muda ─────────────────────────────────────────────────────────
--
-- Nenhuma tabela, policy ou gatilho. As duas funções continuam só da chave de
-- serviço. O captcha mora no servidor (rota de entrada), não aqui: o banco
-- confia em quem o chama, e quem o chama é a rota depois de conferir o token.
--
-- Reversibilidade: `drop` da função nova e recriação da antiga (fatia 1). O
-- perfil de um visitante some junto com o login (`on delete cascade`).

-- ─── 1. A entrada, agora com perfil e destino ───────────────────────────────

drop function public.demonstracao_entrar(uuid);

create function public.demonstracao_entrar(p_user uuid)
returns table (expira_em timestamptz, conta_slug text, marca_key text)
language plpgsql
security definer
set search_path to ''
as $$
#variable_conflict use_column
declare
  v_anonimo boolean;
  c         record;
  v_expira  timestamptz;
  v_conta   text;
  v_marca   text;
begin
  select u.is_anonymous into v_anonimo from auth.users u where u.id = p_user;
  if v_anonimo is distinct from true then
    raise exception 'sessao_nao_anonima' using errcode = 'P0001';
  end if;

  select * into c from private.demonstracao_config where ativo;
  if not found then
    raise exception 'demonstracao_inativa' using errcode = 'P0001';
  end if;

  select w.slug, b.key into v_conta, v_marca
    from public.brands b
    join public.workspaces w on w.id = b.workspace_id
   where b.id = c.brand_id and b.workspace_id = c.workspace_id;
  if v_conta is null or v_marca is null then
    raise exception 'demonstracao_sem_destino' using errcode = 'P0001';
  end if;

  insert into public.demonstracao_visitantes (user_id, expira_em)
  values (p_user, now() + make_interval(hours => c.validade_horas))
  on conflict (user_id) do nothing;

  -- O perfil que o `/docs` exige. E-mail sintético e único por visitante: o id INTEIRO, não um prefixo
  -- (oito caracteres colidiriam em dezenas de milhares de visitantes).
  insert into public.profiles (id, email, full_name)
  values (p_user, 'visitante-' || replace(p_user::text, '-', '') || '@visitante.invalid', 'Visitante')
  on conflict (id) do nothing;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (c.workspace_id, p_user, 'member')
  on conflict do nothing;

  -- `consultar` e mais nada: é a cerca que impede upload e edição.
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
  values (c.brand_id, c.workspace_id, p_user, array['consultar']::text[])
  on conflict (brand_id, user_id) do nothing;

  select v.expira_em into v_expira from public.demonstracao_visitantes v where v.user_id = p_user;
  return query select v_expira, v_conta, v_marca;
end;
$$;

revoke all on function public.demonstracao_entrar(uuid) from public, anon, authenticated;
grant execute on function public.demonstracao_entrar(uuid) to service_role;

-- ─── 2. Os órfãos, para a limpeza ───────────────────────────────────────────
--
-- Login anônimo com mais de 2 h e sem linha em `demonstracao_visitantes`: foi
-- criado pelo navegador e nunca passou pela entrada (o captcha barrou, ou a
-- pessoa desistiu). Não tem vínculo nenhum; só ocupa a tabela de logins.
-- Só ANÔNIMO: conta real nunca aparece aqui, tenha ou não linha de visitante.

create function public.demonstracao_orfaos()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $$
  select u.id
    from auth.users u
   where u.is_anonymous
     and u.created_at < now() - interval '2 hours'
     and not exists (select 1 from public.demonstracao_visitantes v where v.user_id = u.id)
   order by u.created_at
   limit 500;
$$;

revoke all on function public.demonstracao_orfaos() from public, anon, authenticated;
grant execute on function public.demonstracao_orfaos() to service_role;
