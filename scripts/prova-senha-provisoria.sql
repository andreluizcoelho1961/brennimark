-- Prova da senha provisória — fatia 2 do plano da interface, 18/09/2026.
--
-- O servidor cria o login com a chave de serviço e marca `app_metadata` com
-- `senha_provisoria_ate` e `criado_pela_conta`. Aqui, "o servidor" é o
-- superusuário gravando `auth.users` do mesmo jeito; todo o resto roda como a
-- pessoa (authenticated) ou como o servidor (service_role), pelas mesmas
-- portas que a aplicação usa.
--
-- O que ela tranca:
--   1. senha provisória não dá acesso — nem criando o perfil pela API;
--   2. a ativação só acontece depois da troca, e só pelo servidor;
--   3. renovar senha só vale para login provisório criado por ESTA conta —
--      senão "gerar nova senha" seria tomar o login de qualquer um;
--   4. login criado pela conta A não recebe acesso da conta B, e B não fica
--      sabendo que o login existe;
--   5. o perfil não escolhe de quem colher concessões;
--   6. revogar marca, não apaga.
--
-- Mesmo método: mundo próprio, SQLSTATE conferido, preparação que falha
-- REPROVA, `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta_a uuid, conta_b uuid, admin_a uuid, admin_b uuid, grafica uuid,
                         novo uuid, espiao uuid, a1 uuid, a2 uuid, b1 uuid);
grant select on mundo to authenticated, service_role;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

create function pg_temp.como(p_quem uuid, p_sql text, p_papel text default 'authenticated', out saida text)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_quem is null then json_build_object('role', p_papel)::text
           else json_build_object('sub', p_quem, 'role', p_papel)::text end, true);
    execute format('set local role %I', p_papel);
    execute p_sql into saida;
    saida := coalesce(saida, 'OK');
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    saida := sqlstate;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  end;
end $f$;

create function pg_temp.entrar(p_id uuid, p_email text) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role) values (p_id, p_email, 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (p_id, p_email, split_part(p_email,'@',1));
end $f$;

-- O que a rota do servidor faz com a chave de serviço: cria o login SEM perfil,
-- com a marca de provisória e a conta que o criou.
create function pg_temp.login_provisorio(p_id uuid, p_email text, p_conta uuid, p_ate timestamptz) returns void
language sql as $f$
  insert into auth.users (id, email, aud, role, raw_app_meta_data)
  values (p_id, p_email, 'authenticated', 'authenticated',
          jsonb_build_object('senha_provisoria_ate', to_char(p_ate at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                             'criado_pela_conta', p_conta));
$f$;

-- A troca de senha, do lado do servidor: apaga a marca de provisória.
create function pg_temp.trocou_a_senha(p_id uuid) returns void
language sql as $f$
  update auth.users
     set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('senha_provisoria_ate', null)
   where id = p_id;
$f$;

create function pg_temp.membro(p_user uuid, p_conta uuid) returns text
language sql as $f$
  select count(*)::text from public.workspace_members where user_id = p_user and workspace_id = p_conta;
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_admin_a uuid := 'abababab-0000-4000-8000-00000000000a';
  u_admin_b uuid := 'abababab-0000-4000-8000-00000000000b';
  ca uuid; cb uuid; x1 uuid; x2 uuid; y1 uuid;
begin
  perform pg_temp.entrar(u_admin_a, 'sp-admin-a@local.test');
  perform pg_temp.entrar(u_admin_b, 'sp-admin-b@local.test');
  ca := private.abrir_conta_de_assinatura('Conta A da Senha', 'sp-admin-a@local.test', u_admin_a);
  cb := private.abrir_conta_de_assinatura('Conta B da Senha', 'sp-admin-b@local.test', u_admin_b);

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (ca, 'sp-a1', 'SP A1', 'A1', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into x1;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (ca, 'sp-a2', 'SP A2', 'A2', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into x2;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (cb, 'sp-b1', 'SP B1', 'B1', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into y1;

  insert into mundo values (ca, cb, u_admin_a, u_admin_b,
    'abababab-0000-4000-8000-0000000000f1', 'abababab-0000-4000-8000-0000000000f2',
    'abababab-0000-4000-8000-0000000000f3', x1, x2, y1);
end $$;

-- ─── 1. Senha provisória não dá acesso ─────────────────────────────────────
do $$
declare m record; r text; n int;
begin
  select * into m from mundo;

  r := pg_temp.como(m.admin_a, format(
    'select public.conceder_acesso(%L, ''sp-grafica@local.test'', ''consulta'', array[%L]::uuid[], ''Gráfica Aurora'')',
    m.conta_a, m.a1));
  perform pg_temp.registrar('a conta concede com nome, e fica pendente', 'pendente', r);
  select count(*) into n from public.concessoes_de_acesso
   where email = 'sp-grafica@local.test' and nome = 'Gráfica Aurora' and situacao = 'pendente';
  perform pg_temp.registrar('o nome fica na concessao', '1', n::text);

  perform pg_temp.login_provisorio(m.grafica, 'sp-grafica@local.test', m.conta_a, now() + interval '72 hours');

  -- A pessoa cria o próprio perfil pela API, antes de trocar a senha.
  r := pg_temp.como(m.grafica, format(
    'insert into public.profiles (id, email, full_name) values (%L, ''sp-grafica@local.test'', ''G'') returning ''CRIOU''',
    m.grafica));
  perform pg_temp.registrar('com senha provisoria ela ate cria o perfil', 'CRIOU', r);
  perform pg_temp.registrar('mas o perfil NAO converte a concessao', '0', pg_temp.membro(m.grafica, m.conta_a));
  perform pg_temp.registrar('e ela NAO le a marca concedida',
    '0', pg_temp.como(m.grafica, format('select count(*)::text from public.brands where id = %L', m.a1)));

  -- Conceder de novo a quem tem senha provisória continua pendente.
  r := pg_temp.como(m.admin_a, format(
    'select public.conceder_acesso(%L, ''sp-grafica@local.test'', ''consulta'', array[%L,%L]::uuid[])',
    m.conta_a, m.a1, m.a2));
  perform pg_temp.registrar('conceder a login provisorio NAO aplica na hora', 'pendente', r);
  perform pg_temp.registrar('e ainda nao ha vinculo', '0', pg_temp.membro(m.grafica, m.conta_a));
  select count(*) into n from public.concessoes_de_acesso
   where email = 'sp-grafica@local.test' and situacao = 'pendente' and nome = 'Gráfica Aurora';
  perform pg_temp.registrar('a substituicao herda o nome digitado antes', '2', n::text);

  perform pg_temp.registrar('a colheita direta tambem recusa',
    '0', (select private.converter_concessoes(m.grafica, 'sp-grafica@local.test'))::text);

  -- Ela não apaga a própria marca de provisória: `auth.users` não é dela.
  r := pg_temp.como(m.grafica, format(
    'update auth.users set raw_app_meta_data = ''{}''::jsonb where id = %L returning ''MUDOU''', m.grafica));
  perform pg_temp.registrar('a pessoa NAO apaga a marca de provisoria', '42501', r);

  -- Nem ativa a si mesma.
  r := pg_temp.como(m.grafica, format('select public.ativar_login(%L)::text', m.grafica));
  perform pg_temp.registrar('a pessoa NAO chama a ativacao', '42501', r);
  r := pg_temp.como(null, format('select public.ativar_login(%L)::text', m.grafica), 'service_role');
  perform pg_temp.registrar('nem o servidor ativa antes da troca', '22023', r);
end $$;

-- ─── 2. A lista e a renovação da senha ─────────────────────────────────────
do $$
declare m record; r text;
begin
  select * into m from mundo;

  r := pg_temp.como(m.admin_a, format(
    'select nome || ''|'' || (senha_provisoria_ate > now())::text from public.pessoas_da_conta(%L) where email = ''sp-grafica@local.test''',
    m.conta_a));
  perform pg_temp.registrar('a conta A ve o nome e o prazo da senha', 'Gráfica Aurora|true', r);

  r := pg_temp.como(m.admin_a, format(
    'select (public.login_provisorio_da_conta(%L, ''SP-Grafica@local.test'') = %L)::text', m.conta_a, m.grafica));
  perform pg_temp.registrar('a conta A pode renovar a senha dela', 'true', r);

  r := pg_temp.como(m.admin_b, format(
    'select public.login_provisorio_da_conta(%L, ''sp-grafica@local.test'')::text', m.conta_a));
  perform pg_temp.registrar('a conta B NAO renova senha na conta A', '42501', r);
  r := pg_temp.como(m.admin_b, format(
    'select public.login_provisorio_da_conta(%L, ''sp-grafica@local.test'')::text', m.conta_b));
  perform pg_temp.registrar('nem pela propria conta, se o login nao e dela', '22023', r);

  -- O caso que protege contra tomar o login de alguém: senha que NÃO é
  -- provisória não se renova, nem para quem administra.
  r := pg_temp.como(m.admin_a, format(
    'select public.login_provisorio_da_conta(%L, ''sp-admin-a@local.test'')::text', m.conta_a));
  perform pg_temp.registrar('senha definitiva NAO se renova (nem a do proprio admin)', '22023', r);
  r := pg_temp.como(m.admin_a, format(
    'select public.login_provisorio_da_conta(%L, ''sp-ninguem@local.test'')::text', m.conta_a));
  perform pg_temp.registrar('e-mail sem login recebe a MESMA recusa', '22023', r);

  r := pg_temp.como(m.grafica, format(
    'select public.login_provisorio_da_conta(%L, ''sp-grafica@local.test'')::text', m.conta_a));
  perform pg_temp.registrar('quem nao administra NAO renova', '42501', r);
  r := pg_temp.como(null, format(
    'select public.login_provisorio_da_conta(%L, ''sp-grafica@local.test'')::text', m.conta_a), 'anon');
  perform pg_temp.registrar('anon NAO renova', '42501', r);
end $$;

-- ─── 3. Trocou a senha: o servidor ativa ───────────────────────────────────
do $$
declare m record; r text;
begin
  select * into m from mundo;
  perform pg_temp.trocou_a_senha(m.grafica);

  r := pg_temp.como(null, format('select public.ativar_login(%L)::text', m.grafica), 'service_role');
  perform pg_temp.registrar('depois da troca o servidor ativa as duas concessoes', '2', r);
  perform pg_temp.registrar('e ela entra na conta A', '1', pg_temp.membro(m.grafica, m.conta_a));
  perform pg_temp.registrar('e le as duas marcas concedidas',
    '2', pg_temp.como(m.grafica, format('select count(*)::text from public.brands where workspace_id = %L', m.conta_a)));

  r := pg_temp.como(m.admin_a, format(
    'select public.login_provisorio_da_conta(%L, ''sp-grafica@local.test'')::text', m.conta_a));
  perform pg_temp.registrar('ativada, a senha deixa de ser renovavel', '22023', r);

  -- Sem perfil nenhum: a ativação cria o perfil com o nome digitado.
  r := pg_temp.como(m.admin_a, format(
    'select public.conceder_acesso(%L, ''sp-novo@local.test'', ''administrador'', ''{}''::uuid[], ''Nina Nova'')',
    m.conta_a));
  if r <> 'pendente' then raise exception 'premissa falhou: concessao do sp-novo (%)', r; end if;
  perform pg_temp.login_provisorio(m.novo, 'sp-novo@local.test', m.conta_a, now() + interval '72 hours');
  perform pg_temp.trocou_a_senha(m.novo);
  r := pg_temp.como(null, format('select public.ativar_login(%L)::text', m.novo), 'service_role');
  perform pg_temp.registrar('ativar quem nao tem perfil converte', '1', r);
  perform pg_temp.registrar('e cria o perfil com o nome que o administrador digitou',
    'Nina Nova', (select full_name from public.profiles where id = m.novo));
  perform pg_temp.registrar('administrador ativado administra a conta',
    'owner', (select role from public.workspace_members where user_id = m.novo and workspace_id = m.conta_a));
end $$;

-- ─── 4. Login criado por A não recebe acesso de B ──────────────────────────
do $$
declare m record; r text;
begin
  select * into m from mundo;

  r := pg_temp.como(m.admin_b, format(
    'select public.conceder_acesso(%L, ''sp-grafica@local.test'', ''consulta'', array[%L]::uuid[], ''Grafica'')',
    m.conta_b, m.b1));
  perform pg_temp.registrar('B concede ao login criado por A: fica pendente', 'pendente', r);
  perform pg_temp.registrar('e ela NAO entra na conta B', '0', pg_temp.membro(m.grafica, m.conta_b));
  perform pg_temp.registrar('nem le a marca de B',
    '0', pg_temp.como(m.grafica, format('select count(*)::text from public.brands where id = %L', m.b1)));
  perform pg_temp.registrar('nem colhendo de novo',
    '0', (select private.converter_concessoes(m.grafica, 'sp-grafica@local.test'))::text);

  -- B não fica sabendo que o login existe: sem prazo de senha, igual a quem
  -- nunca entrou.
  r := pg_temp.como(m.admin_b, format(
    'select coalesce(senha_provisoria_ate::text, ''sem prazo'') from public.pessoas_da_conta(%L) where email = ''sp-grafica@local.test''',
    m.conta_b));
  perform pg_temp.registrar('B ve so "pendente", sem saber de A', 'sem prazo', r);
  r := pg_temp.como(m.admin_b, format(
    'select count(*)::text from public.pessoas_da_conta(%L) where email = ''sp-grafica@local.test''', m.conta_a));
  perform pg_temp.registrar('B NAO le a lista de A', '42501', r);
end $$;

-- ─── 5. O perfil não escolhe de quem colher ────────────────────────────────
do $$
declare m record; r text;
begin
  select * into m from mundo;

  r := pg_temp.como(m.admin_a, format(
    'select public.conceder_acesso(%L, ''sp-alvo@local.test'', ''administrador'')', m.conta_a));
  if r <> 'pendente' then raise exception 'premissa falhou: concessao do alvo (%)', r; end if;

  -- Um login qualquer, sem marca de conta, grava no perfil o e-mail do alvo.
  insert into auth.users (id, email, aud, role) values (m.espiao, 'sp-espiao@local.test', 'authenticated', 'authenticated');
  r := pg_temp.como(m.espiao, format(
    'insert into public.profiles (id, email, full_name) values (%L, ''sp-alvo@local.test'', ''E'') returning ''CRIOU''',
    m.espiao));
  perform pg_temp.registrar('o perfil com e-mail alheio e gravado', 'CRIOU', r);
  perform pg_temp.registrar('mas NAO colhe a concessao do alvo', '0', pg_temp.membro(m.espiao, m.conta_a));
  perform pg_temp.registrar('e a concessao do alvo segue pendente',
    'pendente', (select situacao from public.concessoes_de_acesso where email = 'sp-alvo@local.test'));
end $$;

-- ─── 6. Revogar marca, não apaga ───────────────────────────────────────────
do $$
declare m record; r text; n int;
begin
  select * into m from mundo;

  r := pg_temp.como(m.admin_a, format('select public.revogar_acesso(%L, ''sp-grafica@local.test'')', m.conta_a));
  perform pg_temp.registrar('revogar quem ja entrou', 'revogada', r);
  perform pg_temp.registrar('o vinculo sai', '0', pg_temp.membro(m.grafica, m.conta_a));
  select count(*) into n from public.concessoes_de_acesso
   where email = 'sp-grafica@local.test' and workspace_id = m.conta_a
     and situacao = 'revogada' and revogada_por = m.admin_a and convertida_em is not null;
  perform pg_temp.registrar('as ativas ficam como revogadas, com autor', '2', n::text);
  select count(*) into n from public.concessoes_de_acesso
   where email = 'sp-grafica@local.test' and workspace_id = m.conta_b and situacao = 'pendente';
  perform pg_temp.registrar('e a revogacao de A nao toca na pendencia de B', '1', n::text);

  -- Senha provisória VENCIDA também não dá acesso: o banco não precisa saber
  -- do prazo para recusar — quem confere o prazo é o servidor, na troca.
  perform pg_temp.login_provisorio('abababab-0000-4000-8000-0000000000f4', 'sp-vencida@local.test',
                                   m.conta_a, now() - interval '1 hour');
  r := pg_temp.como(m.admin_a, format(
    'select public.conceder_acesso(%L, ''sp-vencida@local.test'', ''consulta'', array[%L]::uuid[], ''V'')',
    m.conta_a, m.a1));
  perform pg_temp.registrar('senha vencida: a concessao fica pendente', 'pendente', r);
  r := pg_temp.como(m.admin_a, format(
    'select (senha_provisoria_ate < now())::text from public.pessoas_da_conta(%L) where email = ''sp-vencida@local.test''',
    m.conta_a));
  perform pg_temp.registrar('e a lista mostra que o prazo passou', 'true', r);
  r := pg_temp.como(m.admin_a, format(
    'select (public.login_provisorio_da_conta(%L, ''sp-vencida@local.test'') is not null)::text', m.conta_a));
  perform pg_temp.registrar('e a conta pode gerar outra', 'true', r);
end $$;

-- ─── Veredito ──────────────────────────────────────────────────────────────
select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido
from resultado order by ordem;

select case when count(*) filter (where not passou) = 0
            then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*)
       end as veredito
from resultado;

do $$
declare n integer;
begin
  select count(*) filter (where not passou) into n from resultado;
  if n > 0 then
    raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001';
  end if;
end $$;

rollback;
