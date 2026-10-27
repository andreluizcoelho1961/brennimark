-- Prova do tour — a diferença de 25/10/2026 (visitante criado pelo servidor,
-- cadastro, tetos diários). Complementa scripts/prova-da-demonstracao.sql.
--
--   A. Quem é visitante: `app_metadata.tour` e login anônimo valem; `user_metadata`
--      (que o próprio usuário edita) e conta real NÃO valem.
--   B. A entrada completa: perfil com e-mail sintético `.invalid`, vínculo
--      `consultar`, destino vindo do banco, ligação ao cadastro (ou entrada sem
--      ele), recusa de conta real, idempotência.
--   C. Teto de entradas do dia: barra a que passa do teto, não deixa meia entrada,
--      e quem já está dentro não gasta o teto de novo.
--   D. Perguntas: 2 por visitante e teto do dia; o teto devolve o gasto do visitante.
--   E. Cadastro com origem `tour` aceito; origem inventada barra pelo NOME da constraint.
--   F. Vencidos e órfãos: só visitante do tour, nunca conta real.
--   G. Autorização NEGATIVA: o visitante não alcança tetos, cadastros, configuração
--      nem as funções; `anon` também não.
--   H. O registro de acesso ignora visitante do tour e continua anotando gente real.
--   I. Apagar o cadastro não apaga nem trava o visitante.
--   J. Constraints dos tetos, pelo NOME EXATO.
--
-- Mundo próprio, dados próprios por caso, `rollback` no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

create function pg_temp.entrar_real(p_id uuid, p_email text) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role) values (p_id, p_email, 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (p_id, p_email, split_part(p_email,'@',1));
end $f$;

-- Login anônimo do Supabase: sem e-mail, sem perfil, `is_anonymous` verdadeiro.
create function pg_temp.entrar_anonimo(p_id uuid) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, aud, role, is_anonymous) values (p_id, 'authenticated', 'authenticated', true);
end $f$;

-- Uma consulta escalar executada COMO uma pessoa: papel `authenticated` e a
-- identidade dela. Erro vira o código do erro.
create function pg_temp.como(p_user uuid, p_sql text) returns text
language plpgsql as $f$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    execute p_sql into r;
  exception when others then
    r := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $f$;

-- Uma escrita executada COMO uma pessoa: devolve o código do erro, ou
-- 'linhas=N' (o que a RLS deixou passar; 0 é a recusa silenciosa dela).
create function pg_temp.tenta(p_user uuid, p_sql text) returns text
language plpgsql as $f$
declare r text; n integer;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    execute p_sql;
    get diagnostics n = row_count;
    r := 'linhas=' || n;
  exception when others then
    r := sqlstate;
  end;
  reset role;
  perform set_config('request.jwt.claims', '', true);
  return r;
end $f$;

-- Executa uma instrução e devolve o NOME da constraint que ela violou.
create function pg_temp.constraint_de(p_sql text) returns text
language plpgsql as $f$
declare n text;
begin
  execute p_sql;
  return '(sem erro)';
exception when others then
  get stacked diagnostics n = constraint_name;
  return coalesce(n, sqlstate);
end $f$;

-- Chama uma função COMO um papel (anon, authenticated ou service_role).
create function pg_temp.chama_como(p_papel text, p_sql text) returns text
language plpgsql as $f$
declare r text;
begin
  execute format('set local role %I', p_papel);
  begin
    execute p_sql into r;
  exception when others then
    r := sqlstate;
  end;
  reset role;
  return coalesce(r, '(nulo)');
end $f$;

-- A mensagem do erro: os dois recusos da entrada são P0001 e só a mensagem os distingue.
create function pg_temp.msg_de(p_papel text, p_sql text) returns text
language plpgsql as $f$
declare r text; msg text;
begin
  execute format('set local role %I', p_papel);
  begin
    execute p_sql into r;
    msg := '(sem erro)';
  exception when others then
    get stacked diagnostics msg = message_text;
  end;
  reset role;
  return msg;
end $f$;

create temp table mundo (conta_a uuid, marca_a uuid, dono_a uuid, real uuid,
                         t1 uuid, t2 uuid, t3 uuid, t4 uuid, t5 uuid, trapaca uuid, anon uuid);

-- Usuário do tour criado pelo servidor: app_metadata.tour, e-mail sintético, sem perfil.
create function pg_temp.entrar_tour(p_id uuid, p_idade interval default interval '0') returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role, raw_app_meta_data, created_at)
  values (p_id, 'tour-' || right(p_id::text,12) || '@visitante.invalid', 'authenticated', 'authenticated',
          '{"tour": true}'::jsonb, now() - p_idade);
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_dono uuid := 'd1d1d1d1-0000-4000-8000-00000000000a';
  u_real uuid := 'd1d1d1d1-0000-4000-8000-0000000000e1';
  u_t1 uuid := 'd1d1d1d1-0000-4000-8000-0000000000a1';
  u_t2 uuid := 'd1d1d1d1-0000-4000-8000-0000000000a2';
  u_t3 uuid := 'd1d1d1d1-0000-4000-8000-0000000000a3';
  u_t4 uuid := 'd1d1d1d1-0000-4000-8000-0000000000a4';
  u_t5 uuid := 'd1d1d1d1-0000-4000-8000-0000000000a5';
  u_tr uuid := 'd1d1d1d1-0000-4000-8000-0000000000f1';
  u_an uuid := 'd1d1d1d1-0000-4000-8000-0000000000b1';
  ca uuid; ma uuid;
begin
  perform pg_temp.entrar_real(u_dono, 'vs-dono@local.test');
  perform pg_temp.entrar_real(u_real, 'vs-real@local.test');
  perform pg_temp.entrar_tour(u_t1);
  perform pg_temp.entrar_tour(u_t2);
  perform pg_temp.entrar_tour(u_t3);
  perform pg_temp.entrar_tour(u_t4);
  perform pg_temp.entrar_tour(u_t5);
  -- A armadilha: conta real cujo USER_metadata diz tour. Não pode valer.
  insert into auth.users (id, email, aud, role, raw_user_meta_data)
  values (u_tr, 'vs-trapaca@local.test', 'authenticated', 'authenticated', '{"tour": true}'::jsonb);
  insert into auth.users (id, aud, role, is_anonymous) values (u_an, 'authenticated', 'authenticated', true);

  ca := private.abrir_conta_de_assinatura('Demonstração da Prova 2', 'vs-dono@local.test', u_dono);
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (ca, 'vs-tour', 'Marca do Tour', 'T', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into ma;

  insert into mundo values (ca, ma, u_dono, u_real, u_t1, u_t2, u_t3, u_t4, u_t5, u_tr, u_an);

  -- Liga o tour: 2 perguntas por visitante, teto de 3 entradas e de 3 perguntas por dia.
  insert into private.demonstracao_config
    (workspace_id, brand_id, ativo, perguntas_por_visitante, validade_horas, teto_entradas_dia, teto_perguntas_dia)
  values (ca, ma, true, 2, 24, 3, 3);
end $$;

-- ═══ A. Quem é visitante ════════════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform pg_temp.registrar('A1 app_metadata.tour vale', 'true', private.visitante_do_tour(m.t1)::text);
  perform pg_temp.registrar('A2 login anônimo continua valendo', 'true', private.visitante_do_tour(m.anon)::text);
  perform pg_temp.registrar('A3 user_metadata.tour NÃO vale (o usuário o edita)', 'false', private.visitante_do_tour(m.trapaca)::text);
  perform pg_temp.registrar('A4 conta real não é visitante', 'false', private.visitante_do_tour(m.real)::text);
  perform pg_temp.registrar('A5 usuário inexistente não é visitante', 'false', private.visitante_do_tour(gen_random_uuid())::text);
  perform pg_temp.registrar('A6 o padrão novo é 2 perguntas', '2',
    (select column_default from information_schema.columns
      where table_schema='private' and table_name='demonstracao_config' and column_name='perguntas_por_visitante'));
end $$;

-- ═══ B. A entrada completa ══════════════════════════════════════════════════
do $$
declare m mundo%rowtype; r record; cad uuid; r2 record;
begin
  select * into m from mundo;
  perform public.registrar_cadastro('ana.da.prova@local.test', 'Ana da Prova', null, null, '{}'::jsonb, 'tour', false, null);
  select id into cad from public.cadastros_gratuitos where email = 'ana.da.prova@local.test';

  select * into r from public.demonstracao_receber(m.t1, 'Ana da Prova', 'Ana.Da.Prova@local.test', 'en');
  perform pg_temp.registrar('B1 o destino sai do banco: a conta do tour', 'true', (r.workspace_id = m.conta_a)::text);
  perform pg_temp.registrar('B2 e a marca do tour', 'vs-tour', r.marca_key);
  perform pg_temp.registrar('B3 validade de cerca de 24 h', 'true',
    (r.expira_em > now() + interval '23 hours' and r.expira_em <= now() + interval '24 hours 1 minute')::text);
  perform pg_temp.registrar('B4 o perfil leva o nome informado', 'Ana da Prova',
    (select full_name from public.profiles where id = m.t1));
  perform pg_temp.registrar('B5 o e-mail do perfil é sintético, nunca o real', 'true',
    (select (email like 'visitante-%@visitante.invalid' and email not like '%local.test')::text from public.profiles where id = m.t1));
  perform pg_temp.registrar('B6 o idioma da tela vira o idioma do perfil', 'en',
    (select locale from public.profiles where id = m.t1));
  perform pg_temp.registrar('B7 o vínculo é `consultar` e só', '{consultar}',
    (select capacidades::text from public.brand_members where user_id = m.t1));
  perform pg_temp.registrar('B8 a sessão aponta para o cadastro (e-mail em maiúsculas casa)', 'true',
    (select (cadastro_id = cad)::text from public.demonstracao_visitantes where user_id = m.t1));

  -- Sem cadastro: entra, não recusa.
  perform public.demonstracao_receber(m.t2, 'Sem Cadastro', 'ninguem@local.test', 'pt-BR');
  perform pg_temp.registrar('B9 sem cadastro, entra e a ligação fica nula', '(nulo)',
    (select coalesce(cadastro_id::text, '(nulo)') from public.demonstracao_visitantes where user_id = m.t2));
  perform pg_temp.registrar('B10 idioma pt-BR válido é gravado', 'pt-BR',
    (select locale from public.profiles where id = m.t2));
  perform public.demonstracao_receber(m.t3, 'Idioma Estranho', 'x@local.test', 'xx-YY');
  perform pg_temp.registrar('B11 idioma fora de {pt-BR,en} fica nulo', '(nulo)',
    (select coalesce(locale, '(nulo)') from public.profiles where id = m.t3));

  perform pg_temp.registrar('B12 conta real é recusada', 'sessao_nao_visitante',
    pg_temp.msg_de('service_role', format($q$select count(*)::text from public.demonstracao_receber(%L,'Real','r@local.test','pt-BR')$q$, m.real)));
  perform pg_temp.registrar('B13 a trapaça de user_metadata é recusada', 'sessao_nao_visitante',
    pg_temp.msg_de('service_role', format($q$select count(*)::text from public.demonstracao_receber(%L,'Trapa','t@local.test','pt-BR')$q$, m.trapaca)));
  perform pg_temp.registrar('B14 a conta real e a trapaça não ganharam vínculo', '0',
    (select count(*)::text from public.brand_members where user_id in (m.real, m.trapaca)));

  -- Idempotência: entrar de novo não duplica nem muda o nome nem gasta o teto.
  perform public.demonstracao_receber(m.t1, 'Outro Nome', 'ana.da.prova@local.test', 'pt-BR');
  perform pg_temp.registrar('B15 reentrar não duplica a linha de marca', '1',
    (select count(*)::text from public.brand_members where user_id = m.t1));
  perform pg_temp.registrar('B16 reentrar não troca o perfil', 'Ana da Prova',
    (select full_name from public.profiles where id = m.t1));
  perform pg_temp.registrar('B17 reentrar não gastou o teto (3 entradas até aqui)', '3',
    (select entradas::text from public.demonstracao_uso_diario));
end $$;

-- ═══ C. Teto de entradas do dia ═════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform pg_temp.registrar('C1 passando do teto, a entrada recusa', 'demonstracao_lotada',
    pg_temp.msg_de('service_role', format($q$select count(*)::text from public.demonstracao_receber(%L,'Quarto','q@local.test','pt-BR')$q$, m.t4)));
  perform pg_temp.registrar('C2 e não sobrou meia entrada: sem perfil', '0',
    (select count(*)::text from public.profiles where id = m.t4));
  perform pg_temp.registrar('C3 nem vínculo', '0',
    (select count(*)::text from public.brand_members where user_id = m.t4));
  perform pg_temp.registrar('C4 nem sessão', '0',
    (select count(*)::text from public.demonstracao_visitantes where user_id = m.t4));
  perform pg_temp.registrar('C5 o contador de entradas não passou do teto', '3',
    (select entradas::text from public.demonstracao_uso_diario));
  perform pg_temp.registrar('C6 quem já está dentro continua entrando com o teto cheio', 'true',
    (select (count(*) = 1)::text from public.demonstracao_receber(m.t1, 'Ana', 'ana.da.prova@local.test', 'pt-BR')));
end $$;

-- ═══ D. Perguntas ═══════════════════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform pg_temp.registrar('D1 1ª pergunta', 'ok', public.demonstracao_gastar_pergunta(m.t1));
  perform pg_temp.registrar('D2 2ª pergunta', 'ok', public.demonstracao_gastar_pergunta(m.t1));
  perform pg_temp.registrar('D3 3ª é recusada: o limite do visitante é 2', 'esgotado', public.demonstracao_gastar_pergunta(m.t1));
  perform pg_temp.registrar('D4 a recusa não gastou nada', '2',
    (select perguntas_feitas::text from public.demonstracao_visitantes where user_id = m.t1));
  perform pg_temp.registrar('D5 o teto do dia contou só as 2 que passaram', '2',
    (select perguntas::text from public.demonstracao_uso_diario));
  perform pg_temp.registrar('D6 outro visitante não herda o gasto', 'ok', public.demonstracao_gastar_pergunta(m.t2));
  perform pg_temp.registrar('D7 teto do dia cheio (3): o visitante com saldo é barrado', 'teto_do_dia', public.demonstracao_gastar_pergunta(m.t2));
  perform pg_temp.registrar('D8 e o gasto dele foi DEVOLVIDO (1, não 2)', '1',
    (select perguntas_feitas::text from public.demonstracao_visitantes where user_id = m.t2));
  perform pg_temp.registrar('D9 o teto não passou de 3', '3',
    (select perguntas::text from public.demonstracao_uso_diario));
  perform pg_temp.registrar('D10 sem sessão, o contador diz desconhecido', 'desconhecido', public.demonstracao_gastar_pergunta(m.t5));
end $$;

-- ═══ E. Cadastro com origem tour ════════════════════════════════════════════
do $$
begin
  perform pg_temp.registrar('E1 a origem `tour` entra no cadastro', 'tour',
    (select primeira_origem from public.cadastros_gratuitos where email = 'ana.da.prova@local.test'));
  perform pg_temp.registrar('E2 origem inventada barra pelo nome exato', 'cadastros_origem_valida',
    pg_temp.constraint_de($q$select public.registrar_cadastro('outra@local.test','Outra',null,null,'{}'::jsonb,'inventada',false,null)$q$));
end $$;

-- ═══ F. Vencidos e órfãos ═══════════════════════════════════════════════════
do $$
declare m mundo%rowtype; v_orfao uuid := 'd1d1d1d1-0000-4000-8000-0000000000c1';
  v_velho_real uuid := 'd1d1d1d1-0000-4000-8000-0000000000c2';
begin
  select * into m from mundo;
  perform pg_temp.entrar_tour(v_orfao, interval '3 hours');
  perform pg_temp.entrar_real(v_velho_real, 'vs-velho@local.test');
  update auth.users set created_at = now() - interval '3 hours' where id = v_velho_real;

  perform pg_temp.registrar('F1 órfão do tour com 3 h é listado', 'true',
    (exists (select 1 from public.demonstracao_orfaos() o where o = v_orfao))::text);
  perform pg_temp.registrar('F2 usuário do tour recém-criado (sem sessão ainda) não é listado', 'false',
    (exists (select 1 from public.demonstracao_orfaos() o where o = m.t5))::text);
  perform pg_temp.registrar('F3 conta real antiga nunca é listada como órfã', 'false',
    (exists (select 1 from public.demonstracao_orfaos() o where o = v_velho_real))::text);
  perform pg_temp.registrar('F4 quem tem sessão não é órfão', 'false',
    (exists (select 1 from public.demonstracao_orfaos() o where o = m.t1))::text);

  update public.demonstracao_visitantes set expira_em = now() - interval '1 minute' where user_id = m.t1;
  perform pg_temp.registrar('F5 visitante do tour vencido é listado', 'true',
    (exists (select 1 from public.demonstracao_vencidos() o where o = m.t1))::text);
  -- Linha de sessão gravada à mão para uma conta real: a lista a ignora.
  insert into public.demonstracao_visitantes (user_id, expira_em) values (m.real, now() - interval '1 day');
  perform pg_temp.registrar('F6 conta real com linha vencida NÃO é listada', 'false',
    (exists (select 1 from public.demonstracao_vencidos() o where o = m.real))::text);
  delete from public.demonstracao_visitantes where user_id = m.real;
end $$;

-- ═══ G. Autorização negativa ════════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform pg_temp.registrar('G1 o visitante não lê os tetos do dia', '42501',
    pg_temp.como(m.t2, 'select count(*)::text from public.demonstracao_uso_diario'));
  perform pg_temp.registrar('G2 não lê a lista de cadastros', '42501',
    pg_temp.como(m.t2, 'select count(*)::text from public.cadastros_gratuitos'));
  perform pg_temp.registrar('G3 não lê a configuração', '42501',
    pg_temp.como(m.t2, 'select count(*)::text from private.demonstracao_config'));
  perform pg_temp.registrar('G4 lê só a própria sessão', '1',
    pg_temp.como(m.t2, 'select count(*)::text from public.demonstracao_visitantes'));
  perform pg_temp.registrar('G5 não zera o próprio contador', '42501',
    pg_temp.tenta(m.t2, format('update public.demonstracao_visitantes set perguntas_feitas = 0 where user_id = %L', m.t2)));
  perform pg_temp.registrar('G6 não aponta a própria sessão para outro cadastro', '42501',
    pg_temp.tenta(m.t2, format('update public.demonstracao_visitantes set cadastro_id = null where user_id = %L', m.t2)));
  perform pg_temp.registrar('G7 o visitante não chama `demonstracao_receber`', '42501',
    pg_temp.chama_como('authenticated', format($q$select count(*)::text from public.demonstracao_receber(%L,'x','x@x.test','pt-BR')$q$, m.t5)));
  perform pg_temp.registrar('G8 nem `anon`', '42501',
    pg_temp.chama_como('anon', format($q$select count(*)::text from public.demonstracao_receber(%L,'x','x@x.test','pt-BR')$q$, m.t5)));
  perform pg_temp.registrar('G9 o visitante não gasta pergunta pelo banco', '42501',
    pg_temp.chama_como('authenticated', format('select public.demonstracao_gastar_pergunta(%L)', m.t5)));
  perform pg_temp.registrar('G10 não lista órfãos', '42501',
    pg_temp.chama_como('authenticated', 'select count(*)::text from public.demonstracao_orfaos()'));
  perform pg_temp.registrar('G11 não chama o critério de visitante', '42501',
    pg_temp.chama_como('authenticated', format('select private.visitante_do_tour(%L)::text', m.t5)));
  perform pg_temp.registrar('G12 nem `anon` o chama', '42501',
    pg_temp.chama_como('anon', format('select private.visitante_do_tour(%L)::text', m.t5)));
end $$;

-- ═══ H. O registro de acesso ════════════════════════════════════════════════
do $$
declare m mundo%rowtype; antes integer;
begin
  select * into m from mundo;
  perform pg_temp.registrar('H1 entrar no tour não escreveu no registro de acesso', '0',
    (select count(*)::text from public.brand_access_log where pessoa in (m.t1, m.t2, m.t3)));
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
  values (m.marca_a, m.conta_a, m.real, array['consultar']::text[]);
  perform pg_temp.registrar('H2 acesso de pessoa real continua registrado', '1',
    (select count(*)::text from public.brand_access_log where pessoa = m.real));
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
  values (m.marca_a, m.conta_a, m.trapaca, array['consultar']::text[]);
  perform pg_temp.registrar('H3 a trapaça de user_metadata também é registrada (é gente real)', '1',
    (select count(*)::text from public.brand_access_log where pessoa = m.trapaca));
end $$;

-- ═══ I. Apagar o cadastro não trava o visitante ═════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  delete from public.cadastros_gratuitos where email = 'ana.da.prova@local.test';
  perform pg_temp.registrar('I1 o visitante sobrevive ao cadastro apagado', '1',
    (select count(*)::text from public.demonstracao_visitantes where user_id = m.t1));
  perform pg_temp.registrar('I2 e a ligação vira nula', '(nulo)',
    (select coalesce(cadastro_id::text, '(nulo)') from public.demonstracao_visitantes where user_id = m.t1));
end $$;

-- ═══ J. Constraints dos tetos, pelo nome exato ══════════════════════════════
do $$
begin
  perform pg_temp.registrar('J1 teto de entradas zero', 'demonstracao_config_teto_entradas',
    pg_temp.constraint_de($q$update private.demonstracao_config set teto_entradas_dia = 0$q$));
  perform pg_temp.registrar('J2 teto de perguntas zero', 'demonstracao_config_teto_perguntas',
    pg_temp.constraint_de($q$update private.demonstracao_config set teto_perguntas_dia = 0$q$));
  perform pg_temp.registrar('J3 contador de entradas negativo', 'demonstracao_uso_diario_entradas_check',
    pg_temp.constraint_de($q$update public.demonstracao_uso_diario set entradas = -1$q$));
  perform pg_temp.registrar('J4 contador de perguntas negativo', 'demonstracao_uso_diario_perguntas_check',
    pg_temp.constraint_de($q$update public.demonstracao_uso_diario set perguntas = -1$q$));
end $$;

-- ═══ K. Devolver a pergunta que falhou, e o estado ══════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform pg_temp.registrar('K1 o estado diz quantas fez e de quantas', '1/2',
    (select feitas || '/' || limite from public.demonstracao_estado(m.t2)));
  perform pg_temp.registrar('K2 o estado traz até quando vale a sessão', 'true',
    (select (expira_em > now())::text from public.demonstracao_estado(m.t2)));
  perform pg_temp.registrar('K3 sem sessão, o estado vem vazio', '0',
    (select count(*)::text from public.demonstracao_estado(gen_random_uuid())));

  perform public.demonstracao_devolver_pergunta(m.t2);
  perform pg_temp.registrar('K4 devolver desfaz o gasto do visitante', '0',
    (select perguntas_feitas::text from public.demonstracao_visitantes where user_id = m.t2));
  perform pg_temp.registrar('K5 e o gasto do teto do dia', '2',
    (select perguntas::text from public.demonstracao_uso_diario));

  perform public.demonstracao_devolver_pergunta(m.t2);
  perform pg_temp.registrar('K6 devolver de novo NÃO passa de zero', '0',
    (select perguntas_feitas::text from public.demonstracao_visitantes where user_id = m.t2));
  perform pg_temp.registrar('K7 e não desconta o teto do dia outra vez', '2',
    (select perguntas::text from public.demonstracao_uso_diario));

  perform pg_temp.registrar('K8 a pergunta devolvida pode ser gasta de novo', 'ok', public.demonstracao_gastar_pergunta(m.t2));
  perform public.demonstracao_devolver_pergunta(gen_random_uuid());
  perform pg_temp.registrar('K9 devolver a de um visitante inexistente não faz nada nem erra (teto do dia segue 3)', '3',
    (select perguntas::text from public.demonstracao_uso_diario));

  perform pg_temp.registrar('K10 o visitante não devolve a própria pergunta (burlaria o limite)', '42501',
    pg_temp.chama_como('authenticated', format('select public.demonstracao_devolver_pergunta(%L)::text', m.t2)));
  perform pg_temp.registrar('K11 nem `anon`', '42501',
    pg_temp.chama_como('anon', format('select public.demonstracao_devolver_pergunta(%L)::text', m.t2)));
  perform pg_temp.registrar('K12 o visitante não lê o estado pela função', '42501',
    pg_temp.chama_como('authenticated', format('select count(*)::text from public.demonstracao_estado(%L)', m.t2)));
  perform pg_temp.registrar('K13 nem `anon`', '42501',
    pg_temp.chama_como('anon', format('select count(*)::text from public.demonstracao_estado(%L)', m.t2)));
end $$;

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
