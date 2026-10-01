-- Cobrança — o link de primeiro acesso do titular (01/10/2026).
--
-- Quem assina pelo site ganha a conta e um login SEM senha (o webhook o cria).
-- Enquanto o André não decide como o acesso chega sozinho (serviço de e-mail),
-- a equipe gera no Console um link de primeiro acesso e o manda à pessoa. O
-- link abre a sessão e leva à tela de criar a senha.
--
-- O link é uma chave da conta. Por isso esta função só entrega o login quando:
--
--   - a conta TEM assinatura, e o login é o do titular dela;
--   - o login foi criado PELA COBRANÇA (`app_metadata.criado_pela_cobranca`),
--     nunca um login que a pessoa já tinha;
--   - o login NUNCA ENTROU: depois do primeiro acesso, quem perde a senha
--     segue outro caminho, e a equipe não abre sessão de cliente;
--   - quem pede é da equipe, com motivo — e o pedido fica no registro.

create function public.console_titular_para_primeiro_acesso(p_workspace_id uuid, p_motivo text)
returns table (user_id uuid, email text)
language plpgsql
security definer
set search_path to ''
as $$
declare
  o_email text;
  o_login uuid;
begin
  if not private.eh_da_equipe() then
    raise exception 'só a equipe da Brennimark' using errcode = '42501';
  end if;
  select a.titular_email into o_email from public.assinaturas a where a.workspace_id = p_workspace_id;
  if o_email is null then
    raise exception 'conta sem assinatura' using errcode = 'P0002', hint = 'cobranca_sem_assinatura';
  end if;
  select u.id into o_login from auth.users u
   where lower(u.email) = o_email
     and u.raw_app_meta_data->>'criado_pela_cobranca' = 'true'
     and u.last_sign_in_at is null;
  if o_login is null then
    raise exception 'o titular já entrou, ou o login não nasceu da compra' using errcode = '22023', hint = 'cobranca_titular_ja_tem_acesso';
  end if;

  perform private.registrar_acao_da_equipe('gerar link de primeiro acesso', 'conta ' || p_workspace_id::text,
    null, jsonb_build_object('titular', o_email), p_motivo);
  return query select o_login, o_email;
end;
$$;

revoke all on function public.console_titular_para_primeiro_acesso(uuid, text) from public, anon;
grant execute on function public.console_titular_para_primeiro_acesso(uuid, text) to authenticated;

-- ─── Correção da revisão de 01/10/2026: o login da compra fica preso à conta ─
--
-- A mesma função da migration `cobranca`, com a abertura da conta reescrita
-- (ver o comentário dentro dela). Os dois defeitos que a revisão reproduziu:
--
--   1. o login criado pela compra colhia concessões de QUALQUER conta;
--   2. quem já tinha login criado por outra agência pagava e não virava dono.
--
-- E uma correção de comentário: a migration `cobranca` diz, em
-- `private.aplicar_plano_na_conta`, que a unicidade de `ai_budgets` não tem
-- NULLS NOT DISTINCT. Tem, desde 03/09 (`ai_budgets_unique_nulls_not_distinct`).
-- O código de lá (atualizar, e inserir se não houver) continua certo; só a
-- explicação estava errada, e migration aplicada não se reescreve.

create or replace function public.cobranca_sincronizar_assinatura(
  p_provedor text,
  p_id_externo_cliente text,
  p_id_externo_assinatura text,
  p_id_externo_preco text,
  p_situacao text,
  p_periodo_pago_ate timestamptz,
  p_cancelar_no_fim boolean,
  p_moeda text,
  p_titular uuid,
  p_titular_email text,
  p_nome_da_conta text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  o_plano public.planos%rowtype;
  atual public.assinaturas%rowtype;
  conta uuid;
  o_email text := lower(btrim(p_titular_email));
  titular uuid := p_titular;
begin
  if p_situacao not in ('ativa', 'em_atraso', 'cancelada', 'incompleta') then
    raise exception 'situação desconhecida: %', p_situacao using errcode = '22023', hint = 'cobranca_situacao_desconhecida';
  end if;

  select pl.* into o_plano
    from public.precos_do_plano pr join public.planos pl on pl.codigo = pr.plano
   where pr.provedor = p_provedor and pr.id_externo = p_id_externo_preco;
  if not found then
    raise exception 'preço sem plano: %', p_id_externo_preco using errcode = '22023', hint = 'cobranca_preco_desconhecido';
  end if;

  -- Dois avisos da mesma assinatura chegam ao mesmo tempo (o checkout e a
  -- fatura paga, por exemplo). Sem esta trava, os dois veriam "não existe" e
  -- abririam DUAS contas.
  perform pg_advisory_xact_lock(hashtextextended('cobranca:' || p_provedor || ':' || p_id_externo_assinatura, 0));

  select * into atual from public.assinaturas
   where provedor = p_provedor and id_externo_assinatura = p_id_externo_assinatura
   for update;

  if not found then
    -- Só o pagamento abre conta. Assinatura que nunca pagou não vira nada.
    if p_situacao <> 'ativa' then
      return null;
    end if;
    if titular is null then
      select u.id into titular from auth.users u where lower(u.email) = o_email limit 1;
    end if;
    if titular is null then
      raise exception 'falta o titular' using errcode = '22004', hint = 'cobranca_sem_titular';
    end if;

    /*
     * A conta é aberta AQUI, e não por `private.abrir_conta_de_assinatura`
     * (correção da revisão de 01/10/2026). Aquela função converte TODAS as
     * concessões pendentes do e-mail para o login — inclusive as de outras
     * contas —, e o login que a compra cria não tem e-mail confirmado: o
     * Stripe não confirma. Quem comprasse com o e-mail de outra pessoa
     * colheria o acesso que uma agência concedesse a ela depois.
     *
     * A ordem é a defesa: (1) a conta nasce; (2) o login criado pela compra
     * fica PRESO a ela (`criado_pela_conta`), como os logins criados por uma
     * conta desde 18/09 — e a partir daí só colhe o que esta conta conceder;
     * (3) o titular vira dono desta conta, e só desta, diretamente: pagar é a
     * prova de que a conta é dele, mesmo quando o login já existia (criado por
     * outra agência, ou com senha provisória ainda não trocada).
     */
    insert into public.workspaces (name)
    values (coalesce(nullif(btrim(p_nome_da_conta), ''), o_email))
    returning id into conta;

    update auth.users u
       set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('criado_pela_conta', conta)
     where u.id = titular
       and u.raw_app_meta_data->>'criado_pela_cobranca' = 'true'
       and u.raw_app_meta_data->>'criado_pela_conta' is null;

    insert into public.concessoes_de_acesso (workspace_id, brand_id, email, papel, concedida_por, convertida_em, convertida_para)
    values (conta, null, o_email, 'administrador', titular, now(), titular);
    insert into public.workspace_members (workspace_id, user_id, role)
    values (conta, titular, 'owner')
    on conflict (workspace_id, user_id) do update set role = 'owner';

    insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura,
                                    situacao, periodo_pago_ate, cancelar_no_fim, moeda, titular_email)
    values (conta, o_plano.codigo, p_provedor, p_id_externo_cliente, p_id_externo_assinatura,
            'ativa', p_periodo_pago_ate, coalesce(p_cancelar_no_fim, false), upper(p_moeda), o_email);

    perform private.aplicar_plano_na_conta(conta, o_plano.codigo);
    return conta;
  end if;

  if p_situacao = 'incompleta' then
    return atual.workspace_id;
  end if;

  update public.assinaturas set
    plano            = o_plano.codigo,
    id_externo_cliente = p_id_externo_cliente,
    situacao         = p_situacao,
    em_atraso_desde  = case when p_situacao = 'em_atraso' then coalesce(atual.em_atraso_desde, now()) end,
    cancelada_em     = case when p_situacao = 'cancelada' then coalesce(atual.cancelada_em, now()) end,
    periodo_pago_ate = coalesce(p_periodo_pago_ate, atual.periodo_pago_ate),
    cancelar_no_fim  = coalesce(p_cancelar_no_fim, false),
    moeda            = coalesce(upper(p_moeda), atual.moeda),
    updated_at       = now()
   where id = atual.id;

  if o_plano.codigo is distinct from atual.plano then
    perform private.aplicar_plano_na_conta(atual.workspace_id, o_plano.codigo);
  end if;
  return atual.workspace_id;
end;
$$;

-- ─── Correção da revisão de 01/10/2026: o que é público em `planos` ─────────
--
-- A tabela é pública porque o site lista os planos. Mas `select` em todas as
-- colunas entregava também o TETO DE CUSTO do Vini em dólares — e a decisão de
-- 30/09 é que o cliente vê uso e percentual, nunca dinheiro. O público lê só
-- o que o site e Configurações mostram; o teto fica com o Console (função
-- `security definer`) e com o banco.
revoke select on public.planos from anon, authenticated;
grant select (codigo, nome, maximo_de_marcas, armazenamento_bytes, a_venda, ordem) on public.planos to anon, authenticated;

-- E outra correção de comentário da migration `cobranca`: em `assinaturas`,
-- "quem volta depois de cancelar reaproveita a linha" não é o que acontece.
-- Uma compra nova abre conta nova (assinatura nova no Stripe); a conta antiga
-- fica cancelada, só para leitura, com tudo dentro. Juntar as duas é parte da
-- decisão em aberto sobre os dados de quem cancelou.
