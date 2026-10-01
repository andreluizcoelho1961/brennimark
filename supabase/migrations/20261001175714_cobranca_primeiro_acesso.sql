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
