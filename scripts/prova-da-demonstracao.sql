-- Prova do tour de demonstração — fatia 1, decisão de André em 17/10/2026.
--
-- O que ela garante (cada item é um caso numerado na saída):
--
--   A. O tour nasce DESLIGADO: sem configuração ativa, a entrada recusa.
--   B. Só login anônimo entra; conta real é recusada.
--   C. A entrada vincula o visitante à marca com `consultar` e nada mais, é
--      idempotente, e NÃO escreve no registro de acesso (a guarda da seção 6).
--      Um acesso de pessoa real continua sendo registrado — a guarda não o engole.
--   D. Autorização NEGATIVA (condição 2 do ADR-0003): o visitante A não lê o B,
--      não lê outra conta nem outra marca, não escreve em nada do tour, e não
--      alcança a configuração nem as funções.
--   E. O contador: gasta até o limite, recusa o seguinte SEM gastar, não vaza
--      entre visitantes, e diz qual limite barrou (esgotado × expirado × inativo).
--   F. A lista de vencidos traz só login anônimo vencido, nunca conta real.
--   G. Apagar o login do visitante funciona e deixa o consumo no razão com
--      `user_id` nulo (o razão precisa bater com o custo).
--   H. As constraints da configuração e do visitante, pelo NOME EXATO.
--
-- Cada caso usa dados próprios: dado compartilhado entre casos foi o que
-- produziu o falso positivo da prova anterior (CLAUDE.md, "Provas versionadas").
-- Mundo próprio, `rollback` no fim. Não deixa resíduo.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta_a uuid, marca_a uuid, conta_b uuid, marca_b uuid,
                         dono_a uuid, dono_b uuid, real uuid, v1 uuid, v2 uuid, v3 uuid, v4 uuid);

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

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_dono_a uuid := 'd0d0d0d0-0000-4000-8000-00000000000a';
  u_dono_b uuid := 'd0d0d0d0-0000-4000-8000-00000000000b';
  u_real   uuid := 'd0d0d0d0-0000-4000-8000-0000000000e1';
  u_v1     uuid := 'd0d0d0d0-0000-4000-8000-0000000000a1';
  u_v2     uuid := 'd0d0d0d0-0000-4000-8000-0000000000a2';
  u_v3     uuid := 'd0d0d0d0-0000-4000-8000-0000000000a3';
  u_v4     uuid := 'd0d0d0d0-0000-4000-8000-0000000000a4';
  ca uuid; cb uuid; ma uuid; mb uuid;
begin
  perform pg_temp.entrar_real(u_dono_a, 'dm-dono-a@local.test');
  perform pg_temp.entrar_real(u_dono_b, 'dm-dono-b@local.test');
  perform pg_temp.entrar_real(u_real,   'dm-real@local.test');
  perform pg_temp.entrar_anonimo(u_v1);
  perform pg_temp.entrar_anonimo(u_v2);
  perform pg_temp.entrar_anonimo(u_v3);
  perform pg_temp.entrar_anonimo(u_v4);

  ca := private.abrir_conta_de_assinatura('Demonstração da Prova', 'dm-dono-a@local.test', u_dono_a);
  cb := private.abrir_conta_de_assinatura('Outra Conta da Prova', 'dm-dono-b@local.test', u_dono_b);

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (ca, 'dm-tour', 'Marca do Tour', 'T', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into ma;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (cb, 'dm-outra', 'Outra Marca', 'O', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into mb;

  insert into mundo values (ca, ma, cb, mb, u_dono_a, u_dono_b, u_real, u_v1, u_v2, u_v3, u_v4);

  -- Uma execução da OUTRA conta no razão, para provar que o visitante não a lê.
  insert into public.ai_ledger (workspace_id, brand_id, user_id, execution_id, task, reserved_micros, currency)
  values (cb, mb, u_dono_b, gen_random_uuid(), 'assist', 100, 'USD');
end $$;

-- ═══ A. O tour nasce desligado ══════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform pg_temp.registrar('A1 a tabela de configuração nasce vazia', '0',
    (select count(*)::text from private.demonstracao_config));
  perform pg_temp.registrar('A2 sem configuração, a entrada recusa', 'demonstracao_inativa',
    pg_temp.msg_de('service_role', format('select public.demonstracao_entrar(%L)::text', m.v1)));
  perform pg_temp.registrar('A3 sem configuração, o contador diz inativo', 'inativo',
    pg_temp.chama_como('service_role', format('select public.demonstracao_gastar_pergunta(%L)', m.v1)));
  perform pg_temp.registrar('A4 a recusa não deixou vínculo nenhum', '0',
    (select count(*)::text from public.brand_members where user_id = m.v1));

  -- Liga o tour: 3 perguntas e 24 h (o padrão é 10; 3 acelera a prova).
  insert into private.demonstracao_config (workspace_id, brand_id, ativo, perguntas_por_visitante, validade_horas)
  values (m.conta_a, m.marca_a, true, 3, 24);
end $$;

-- ═══ B. Só login anônimo entra ══════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform pg_temp.registrar('B1 conta real é recusada', 'sessao_nao_anonima',
    pg_temp.msg_de('service_role', format('select public.demonstracao_entrar(%L)::text', m.real)));
  perform pg_temp.registrar('B2 conta real não ganhou vínculo nenhum', '0',
    (select (select count(*) from public.brand_members where user_id = m.real)::text));
  perform pg_temp.registrar('B3 usuário inexistente é recusado', 'sessao_nao_anonima',
    pg_temp.msg_de('service_role', format('select public.demonstracao_entrar(%L)::text', gen_random_uuid())));
end $$;

-- ═══ C. A entrada ═══════════════════════════════════════════════════════════
do $$
declare m mundo%rowtype; e1 timestamptz; e2 timestamptz;
begin
  select * into m from mundo;
  e1 := public.demonstracao_entrar(m.v1);
  perform pg_temp.registrar('C1 a validade é de cerca de 24 h', 'true',
    (e1 > now() + interval '23 hours' and e1 <= now() + interval '24 hours 1 minute')::text);
  perform pg_temp.registrar('C2 o visitante tem UMA linha de marca', '1',
    (select count(*)::text from public.brand_members where user_id = m.v1));
  perform pg_temp.registrar('C3 e é só `consultar`', '{consultar}',
    (select capacidades::text from public.brand_members where user_id = m.v1));
  perform pg_temp.registrar('C4 e é a marca do tour', 'true',
    (select (brand_id = m.marca_a and workspace_id = m.conta_a)::text from public.brand_members where user_id = m.v1));
  perform pg_temp.registrar('C5 papel `member` na conta do tour (nunca owner)', 'member',
    (select role from public.workspace_members where user_id = m.v1 and workspace_id = m.conta_a));
  perform pg_temp.registrar('C6 entrar de novo não duplica nada', '1/1/1',
    (select (select count(*) from public.brand_members where user_id = m.v1) || '/' ||
            (select count(*) from public.workspace_members where user_id = m.v1) || '/' ||
            (select count(*) from public.demonstracao_visitantes where user_id = m.v1)
     from (select public.demonstracao_entrar(m.v1)) x));
  e2 := (select expira_em from public.demonstracao_visitantes where user_id = m.v1);
  perform pg_temp.registrar('C7 entrar de novo NÃO renova a validade', 'true', (e1 = e2)::text);
  perform pg_temp.registrar('C8 o visitante não gerou evento no registro de acesso', '0',
    (select count(*)::text from public.brand_access_log where pessoa = m.v1));

  -- A guarda não pode engolir o registro de gente de verdade.
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
  values (m.marca_a, m.conta_a, m.real, array['consultar'], m.dono_a);
  perform pg_temp.registrar('C9 acesso de PESSOA REAL continua registrado', '1',
    (select count(*)::text from public.brand_access_log where pessoa = m.real and acao = 'concedido'));
  delete from public.brand_members where user_id = m.real;
  perform pg_temp.registrar('C10 e a revogação dela também', '1',
    (select count(*)::text from public.brand_access_log where pessoa = m.real and acao = 'revogado'));
end $$;

-- ═══ D. Autorização negativa ════════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform public.demonstracao_entrar(m.v2);

  -- D1–D6: o visitante 1 não enxerga o visitante 2 nem a outra conta.
  perform pg_temp.registrar('D1 v1 lê a própria sessão', '1',
    pg_temp.como(m.v1, 'select count(*)::text from public.demonstracao_visitantes'));
  perform pg_temp.registrar('D2 v1 não lê a sessão do v2', '0',
    pg_temp.como(m.v1, format('select count(*)::text from public.demonstracao_visitantes where user_id = %L', m.v2)));
  perform pg_temp.registrar('D3 v1 vê só o próprio vínculo de marca', '1',
    pg_temp.como(m.v1, 'select count(*)::text from public.brand_members'));
  perform pg_temp.registrar('D4 v1 vê só o próprio vínculo de conta', '1',
    pg_temp.como(m.v1, 'select count(*)::text from public.workspace_members'));
  perform pg_temp.registrar('D5 v1 vê uma marca só: a do tour', '1',
    pg_temp.como(m.v1, 'select count(*)::text from public.brands'));
  perform pg_temp.registrar('D6 v1 vê uma conta só: a do tour', '1',
    pg_temp.como(m.v1, 'select count(*)::text from public.workspaces'));
  perform pg_temp.registrar('D7 v1 não lê a marca da outra conta', '0',
    pg_temp.como(m.v1, format('select count(*)::text from public.brands where id = %L', m.marca_b)));
  perform pg_temp.registrar('D8 v1 não lê o razão de IA de ninguém', '0',
    pg_temp.como(m.v1, 'select count(*)::text from public.ai_ledger'));
  perform pg_temp.registrar('D9 v1 não lê o registro de acesso', '0',
    pg_temp.como(m.v1, 'select count(*)::text from public.brand_access_log'));

  -- D10–D16: v1 não escreve em nada do tour.
  perform pg_temp.registrar('D10 v1 não cria sessão para si', '42501',
    pg_temp.tenta(m.v1, format('insert into public.demonstracao_visitantes (user_id, expira_em) values (%L, now())', m.v3)));
  perform pg_temp.registrar('D11 v1 não zera o próprio contador', '42501',
    pg_temp.tenta(m.v1, format('update public.demonstracao_visitantes set perguntas_feitas = 0 where user_id = %L', m.v1)));
  perform pg_temp.registrar('D12 v1 não estende a própria validade', '42501',
    pg_temp.tenta(m.v1, format('update public.demonstracao_visitantes set expira_em = now() + interval ''30 days'' where user_id = %L', m.v1)));
  perform pg_temp.registrar('D13 v1 não apaga a própria sessão', '42501',
    pg_temp.tenta(m.v1, format('delete from public.demonstracao_visitantes where user_id = %L', m.v1)));
  perform pg_temp.registrar('D14 v1 não se concede `editar` (inserção)', '42501',
    pg_temp.tenta(m.v1, format($q$insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
      values (%L, %L, %L, array['consultar','editar'])$q$, m.marca_a, m.conta_a, m.v3)));
  perform pg_temp.registrar('D15 v1 não amplia o próprio acesso (a RLS recusa em silêncio)', 'linhas=0',
    pg_temp.tenta(m.v1, format($q$update public.brand_members set capacidades = array['consultar','editar','administrar']
      where user_id = %L$q$, m.v1)));
  perform pg_temp.registrar('D16 e a capacidade segue só `consultar`', '{consultar}',
    (select capacidades::text from public.brand_members where user_id = m.v1));
  perform pg_temp.registrar('D17 v1 não renomeia a marca (recusa silenciosa)', 'linhas=0',
    pg_temp.tenta(m.v1, format($q$update public.brands set name = 'invadida' where id = %L$q$, m.marca_a)));
  perform pg_temp.registrar('D18 v1 não vira dono da conta do tour', '42501',
    pg_temp.tenta(m.v1, format($q$insert into public.workspace_members (workspace_id, user_id, role)
      values (%L, %L, 'owner')$q$, m.conta_a, m.v3)));

  -- D19–D22: a configuração e as funções ficam fora do alcance.
  perform pg_temp.registrar('D19 v1 não lê a configuração do tour', '42501',
    pg_temp.como(m.v1, 'select count(*)::text from private.demonstracao_config'));
  perform pg_temp.registrar('D20 authenticated não executa a entrada', '42501',
    pg_temp.chama_como('authenticated', format('select public.demonstracao_entrar(%L)::text', m.v3)));
  perform pg_temp.registrar('D21 anon não executa a entrada', '42501',
    pg_temp.chama_como('anon', format('select public.demonstracao_entrar(%L)::text', m.v3)));
  perform pg_temp.registrar('D22 authenticated não executa o contador', '42501',
    pg_temp.chama_como('authenticated', format('select public.demonstracao_gastar_pergunta(%L)', m.v1)));
  perform pg_temp.registrar('D23 authenticated não lê a lista de vencidos', '42501',
    pg_temp.chama_como('authenticated', 'select count(*)::text from public.demonstracao_vencidos()'));
  perform pg_temp.registrar('D24 anon não lê a sessão de ninguém', '42501',
    pg_temp.chama_como('anon', 'select count(*)::text from public.demonstracao_visitantes'));
  perform pg_temp.registrar('D25 o contador do v1 segue em zero depois de tudo', '0',
    (select perguntas_feitas::text from public.demonstracao_visitantes where user_id = m.v1));
end $$;

-- ═══ E. O contador ══════════════════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform public.demonstracao_entrar(m.v3);   -- v3 para o limite
  perform public.demonstracao_entrar(m.v4);   -- v4 para a expiração e o controle

  perform pg_temp.registrar('E1 pergunta 1 de 3', 'ok', public.demonstracao_gastar_pergunta(m.v3));
  perform pg_temp.registrar('E2 pergunta 2 de 3', 'ok', public.demonstracao_gastar_pergunta(m.v3));
  perform pg_temp.registrar('E3 pergunta 3 de 3', 'ok', public.demonstracao_gastar_pergunta(m.v3));
  perform pg_temp.registrar('E4 a quarta é recusada: esgotado', 'esgotado', public.demonstracao_gastar_pergunta(m.v3));
  perform pg_temp.registrar('E5 a recusa NÃO gastou: segue em 3', '3',
    (select perguntas_feitas::text from public.demonstracao_visitantes where user_id = m.v3));
  perform pg_temp.registrar('E6 esgotar um visitante não afeta o outro', 'ok', public.demonstracao_gastar_pergunta(m.v4));
  perform pg_temp.registrar('E7 o contador do outro andou só um', '1',
    (select perguntas_feitas::text from public.demonstracao_visitantes where user_id = m.v4));

  -- Expiração: a validade vence mesmo com perguntas sobrando.
  update public.demonstracao_visitantes set expira_em = now() - interval '1 minute' where user_id = m.v4;
  perform pg_temp.registrar('E8 sessão vencida: expirado', 'expirado', public.demonstracao_gastar_pergunta(m.v4));
  perform pg_temp.registrar('E9 e a recusa não gastou', '1',
    (select perguntas_feitas::text from public.demonstracao_visitantes where user_id = m.v4));

  perform pg_temp.registrar('E10 quem nunca entrou: desconhecido', 'desconhecido',
    public.demonstracao_gastar_pergunta(gen_random_uuid()));
  perform pg_temp.registrar('E11 conta real que nunca entrou: desconhecido', 'desconhecido',
    public.demonstracao_gastar_pergunta(m.real));

  -- Tour pausado pela configuração.
  update private.demonstracao_config set ativo = false;
  perform pg_temp.registrar('E12 tour desligado: o contador diz inativo, mesmo com saldo', 'inativo',
    public.demonstracao_gastar_pergunta(m.v1));
  perform pg_temp.registrar('E13 tour desligado: ninguém novo entra', 'demonstracao_inativa',
    pg_temp.msg_de('service_role', format('select public.demonstracao_entrar(%L)::text', m.v1)));
  update private.demonstracao_config set ativo = true;
  perform pg_temp.registrar('E14 religado, o saldo do v1 estava intacto', 'ok', public.demonstracao_gastar_pergunta(m.v1));
end $$;

-- ═══ F. Os vencidos ═════════════════════════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  -- Uma linha de visitante para uma CONTA REAL, vencida: não pode aparecer.
  insert into public.demonstracao_visitantes (user_id, expira_em)
  values (m.real, now() - interval '5 days');

  perform pg_temp.registrar('F1 só o v4 (anônimo e vencido) está na lista', '1',
    (select count(*)::text from public.demonstracao_vencidos()));
  perform pg_temp.registrar('F2 e é o v4', m.v4::text,
    (select user_id::text from public.demonstracao_vencidos() user_id));
  perform pg_temp.registrar('F3 conta real vencida NUNCA entra na lista', '0',
    (select count(*)::text from public.demonstracao_vencidos() u where u = m.real));
  perform pg_temp.registrar('F4 quem está dentro do prazo não entra', '0',
    (select count(*)::text from public.demonstracao_vencidos() u where u in (m.v1, m.v2, m.v3)));
  delete from public.demonstracao_visitantes where user_id = m.real;
end $$;

-- ═══ G. Apagar o visitante ══════════════════════════════════════════════════
do $$
declare m mundo%rowtype; ex uuid := gen_random_uuid();
begin
  select * into m from mundo;
  -- O v4 gastou IA: o razão tem uma linha dele.
  insert into public.ai_ledger (workspace_id, brand_id, user_id, execution_id, task, reserved_micros, currency)
  values (m.conta_a, m.marca_a, m.v4, ex, 'assist', 500, 'USD');

  -- É o que a API de administração faz: apagar a linha de auth.users.
  delete from auth.users where id = m.v4;

  perform pg_temp.registrar('G1 o login do visitante foi apagado', '0',
    (select count(*)::text from auth.users where id = m.v4));
  perform pg_temp.registrar('G2 a sessão dele saiu junto', '0',
    (select count(*)::text from public.demonstracao_visitantes where user_id = m.v4));
  perform pg_temp.registrar('G3 o vínculo de marca saiu junto', '0',
    (select count(*)::text from public.brand_members where user_id = m.v4));
  perform pg_temp.registrar('G4 o vínculo de conta saiu junto', '0',
    (select count(*)::text from public.workspace_members where user_id = m.v4));
  perform pg_temp.registrar('G5 o consumo de IA CONTINUA no razão', '1',
    (select count(*)::text from public.ai_ledger where execution_id = ex));
  perform pg_temp.registrar('G6 com o autor nulo', 'true',
    (select (user_id is null)::text from public.ai_ledger where execution_id = ex));
  perform pg_temp.registrar('G7 e o valor intacto', '500',
    (select reserved_micros::text from public.ai_ledger where execution_id = ex));
  perform pg_temp.registrar('G8 apagar o v4 não tocou nos outros visitantes', '3',
    (select count(*)::text from public.demonstracao_visitantes where user_id in (m.v1, m.v2, m.v3)));
  perform pg_temp.registrar('G9 a lista de vencidos esvaziou', '0',
    (select count(*)::text from public.demonstracao_vencidos()));
end $$;

-- ═══ H. As constraints, pelo nome exato ═════════════════════════════════════
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  perform pg_temp.registrar('H1 uma segunda configuração viola a chave única', 'demonstracao_config_pkey',
    pg_temp.constraint_de(format('insert into private.demonstracao_config (workspace_id, brand_id) values (%L, %L)',
      m.conta_a, m.marca_a)));
  perform pg_temp.registrar('H2 `id` só pode ser verdadeiro', 'demonstracao_config_id_check',
    pg_temp.constraint_de(format('insert into private.demonstracao_config (id, workspace_id, brand_id) values (false, %L, %L)',
      m.conta_a, m.marca_a)));

  -- Para H3–H6 a linha única é trocada por uma válida a cada caso; o `rollback`
  -- do bloco de exceção desfaz cada tentativa.
  perform pg_temp.registrar('H3 perguntas fora de 1..100 são recusadas', 'demonstracao_config_perguntas_por_visitante_check',
    pg_temp.constraint_de(format('update private.demonstracao_config set perguntas_por_visitante = 0')));
  perform pg_temp.registrar('H4 validade fora de 1..168 h é recusada', 'demonstracao_config_validade_horas_check',
    pg_temp.constraint_de(format('update private.demonstracao_config set validade_horas = 169')));
  perform pg_temp.registrar('H5 marca de OUTRA conta viola a composta', 'demonstracao_config_marca_fkey',
    pg_temp.constraint_de(format('update private.demonstracao_config set brand_id = %L', m.marca_b)));
  perform pg_temp.registrar('H6 contador negativo é recusado', 'demonstracao_visitantes_perguntas_feitas_check',
    pg_temp.constraint_de(format('update public.demonstracao_visitantes set perguntas_feitas = -1 where user_id = %L', m.v1)));
end $$;

-- Apagar a marca muda o mundo — por isso fica por último.
-- 
do $$
declare m mundo%rowtype;
begin
  select * into m from mundo;
  delete from public.brands where id = m.marca_a;
  perform pg_temp.registrar('H8 apagada a marca do tour, a configuração some junto', '0',
    (select count(*)::text from private.demonstracao_config));
  perform pg_temp.registrar('H9 e o tour fica desligado: o contador diz inativo', 'inativo',
    public.demonstracao_gastar_pergunta(m.v1));
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
