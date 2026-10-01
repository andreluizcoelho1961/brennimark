-- Prova da cobrança — 01/10/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e NOME da
-- constraint (ou o `hint` que a função põe) conferidos onde há recusa, e
-- `rollback` no fim.
--
-- Cinco perguntas:
--   1. Ninguém pela sessão escreve em plano, preço, assinatura ou evento, nem
--      chama as funções de cobrança; o visitante lê só os planos.
--   2. Só o PAGAMENTO abre conta: assinatura incompleta ou em atraso que nunca
--      foi ativa não cria nada; a ativa cria UMA conta, com o titular como
--      administrador e o teto do Vini do plano — e repetir o aviso não cria outra.
--   3. A vida da assinatura: atraso marca o início e não o reescreve; voltar a
--      pagar limpa; trocar de plano troca o teto; cancelar não apaga nada.
--   4. O administrador lê a assinatura da conta dele; outra conta e quem não
--      administra não leem.
--   5. Um aviso repetido não tem efeito duas vezes, e o registro dos avisos
--      não se apaga nem se reescreve depois de concluído.
--   6. (fatia 2) Só a equipe lê e ajusta planos e preços no Console, sempre com
--      motivo registrado; preço novo substitui o antigo sem apagá-lo; o
--      checkout só acha preço ativo, e pelo site só de plano à venda.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (titular uuid, outro uuid, membro uuid, conta uuid, conta_outra uuid, equipe uuid);

create function pg_temp.como(p_quem uuid, p_sql text, out estado text, out nome text)
language plpgsql as $f$
declare n integer;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics n = row_count;
    estado := 'ACEITOU ' || n; nome := '';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
  end;
end $f$;

create function pg_temp.papel(p_papel text, p_sql text) returns text
language plpgsql as $f$
declare estado text;
begin
  begin
    execute format('set local role %I', p_papel);
    execute p_sql;
    estado := 'ACEITOU';
    execute 'reset role';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
  end;
  return estado;
end $f$;

-- Como o servidor (service_role); devolve SQLSTATE e o nome da constraint ou o hint.
create function pg_temp.servidor(p_sql text) returns text
language plpgsql as $f$
declare estado text; nome text; dica text;
begin
  begin
    execute 'set local role service_role';
    execute p_sql;
    execute 'reset role';
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name, dica = pg_exception_hint;
    return estado || ' ' || coalesce(nullif(nome, ''), dica, '');
  end;
end $f$;

-- Direto como dono do banco: para provar constraint e gatilho, que valem
-- até para quem passa por cima de toda permissão.
create function pg_temp.direto(p_sql text) returns text
language plpgsql as $f$
declare estado text; nome text; dica text;
begin
  begin
    execute p_sql;
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name, dica = pg_exception_hint;
    return estado || ' ' || coalesce(nullif(nome, ''), dica, '');
  end;
end $f$;

create function pg_temp.direto_valor(p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  execute p_sql into v;
  return v;
end $f$;

create function pg_temp.valor(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into v;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return v;
end $f$;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

-- A chamada do webhook, com o que muda de caso para caso.
-- A moeda vem do preço, como no Stripe: a assinatura é cobrada na moeda dele.
create function pg_temp.sincronizar(p_assinatura text, p_preco text, p_situacao text, p_titular uuid,
                                    p_email text, p_nome text default 'Agência da Prova',
                                    p_cancelar boolean default false) returns uuid
language plpgsql as $f$
declare conta uuid; a_moeda text := (select lower(moeda) from public.precos_do_plano where id_externo = p_preco);
begin
  execute 'set local role service_role';
  conta := public.cobranca_sincronizar_assinatura('stripe', 'cus_prova', p_assinatura, p_preco, p_situacao,
    now() + interval '30 days', p_cancelar, a_moeda, p_titular, p_email, p_nome);
  execute 'reset role';
  return conta;
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_titular uuid := 'cb0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0001';
  u_outro uuid := 'cb0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0002';
  u_membro uuid := 'cb0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0003';
  u_equipe uuid := 'cb0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0004';
begin
  insert into auth.users (id, email, aud, role) values
    (u_titular, 'prova-cob-titular@local.test', 'authenticated', 'authenticated'),
    (u_outro, 'prova-cob-outro@local.test', 'authenticated', 'authenticated'),
    (u_membro, 'prova-cob-membro@local.test', 'authenticated', 'authenticated'),
    (u_equipe, 'prova-cob-equipe@local.test', 'authenticated', 'authenticated');
  insert into private.equipe_brennimark (user_id, nome, motivo) values (u_equipe, 'Equipe da Prova', 'prova da cobrança');
  insert into public.precos_do_plano (plano, provedor, id_externo, moeda, intervalo) values
    ('basico', 'stripe', 'price_prova_basico_brl', 'BRL', 'mes'),
    ('medio', 'stripe', 'price_prova_medio_brl', 'BRL', 'mes'),
    ('basico', 'stripe', 'price_prova_basico_usd', 'USD', 'mes');
  insert into mundo values (u_titular, u_outro, u_membro, null, null, u_equipe);
end $$;

-- ─── 1. Ninguém pela sessão ─────────────────────────────────────────────────
do $$
declare m mundo; t record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('visitante LE os planos', 'ACEITOU', pg_temp.papel('anon', 'select 1 from public.planos'));
  perform pg_temp.registrar('o site ve 3 planos a venda; o Piloto nao', '3',
    (select count(*)::text from public.planos where a_venda));
  perform pg_temp.registrar('visitante NAO le precos', '42501', pg_temp.papel('anon', 'select 1 from public.precos_do_plano'));
  perform pg_temp.registrar('visitante NAO le assinaturas', '42501', pg_temp.papel('anon', 'select 1 from public.assinaturas'));
  perform pg_temp.registrar('visitante NAO le eventos', '42501', pg_temp.papel('anon', 'select 1 from public.eventos_de_cobranca'));

  select * into t from pg_temp.como(m.titular, 'update public.planos set teto_mensal_do_vini_micros = 999999999');
  perform pg_temp.registrar('logado NAO muda o plano', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, 'insert into public.planos (codigo, nome, teto_mensal_do_vini_micros) values (''gratis'', ''Grátis'', 0)');
  perform pg_temp.registrar('logado NAO cria plano', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, 'select 1 from public.precos_do_plano');
  perform pg_temp.registrar('logado NAO le precos', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, format(
    'insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, titular_email) select id, ''premium'', ''stripe'', ''cus_x'', ''sub_pirata'', ''ativa'', ''a@b.c'' from public.workspaces limit 1'));
  perform pg_temp.registrar('logado NAO se da uma assinatura', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, 'insert into public.eventos_de_cobranca (provedor, id_externo, tipo) values (''stripe'', ''evt_pirata'', ''x'')');
  perform pg_temp.registrar('logado NAO planta aviso', '42501', t.estado);

  select * into t from pg_temp.como(m.titular, format(
    'select public.cobranca_sincronizar_assinatura(''stripe'', ''cus_x'', ''sub_pirata'', ''price_prova_basico_brl'', ''ativa'', now(), false, ''brl'', %L, ''prova-cob-titular@local.test'', ''Pirata'')', m.titular));
  perform pg_temp.registrar('logado NAO chama a sincronizacao (abriria conta sem pagar)', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, 'select public.cobranca_receber_evento(''stripe'', ''evt_x'', ''x'')');
  perform pg_temp.registrar('logado NAO registra aviso', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, 'select public.cobranca_concluir_evento(''stripe'', ''evt_x'', ''processado'')');
  perform pg_temp.registrar('logado NAO conclui aviso', '42501', t.estado);
  perform pg_temp.registrar('visitante NAO chama a sincronizacao', '42501', pg_temp.papel('anon',
    'select public.cobranca_sincronizar_assinatura(''stripe'', ''c'', ''s'', ''price_prova_basico_brl'', ''ativa'', now(), false, ''brl'', null, ''a@b.c'', ''x'')'));
end $$;

-- ─── 2. Só o pagamento abre conta ───────────────────────────────────────────
do $$
declare m mundo; antes integer; c uuid; c2 uuid;
begin
  select * into m from mundo;
  select count(*) into antes from public.workspaces;

  perform pg_temp.registrar('preco que nao e de plano nenhum e recusado', '22023 cobranca_preco_desconhecido',
    pg_temp.servidor(format('select public.cobranca_sincronizar_assinatura(''stripe'', ''c'', ''sub_x'', ''price_inventado'', ''ativa'', now(), false, ''brl'', %L, ''a@b.c'', ''x'')', m.titular)));
  perform pg_temp.registrar('situacao fora do vocabulario e recusada', '22023 cobranca_situacao_desconhecida',
    pg_temp.servidor(format('select public.cobranca_sincronizar_assinatura(''stripe'', ''c'', ''sub_x'', ''price_prova_basico_brl'', ''active'', now(), false, ''brl'', %L, ''a@b.c'', ''x'')', m.titular)));
  perform pg_temp.registrar('ativa sem login do titular e recusada', '22004 cobranca_sem_titular',
    pg_temp.servidor('select public.cobranca_sincronizar_assinatura(''stripe'', ''c'', ''sub_x'', ''price_prova_basico_brl'', ''ativa'', now(), false, ''brl'', null, ''ninguem@local.test'', ''x'')'));

  perform pg_temp.registrar('assinatura INCOMPLETA (Pix nao pago) nao abre conta', null,
    pg_temp.sincronizar('sub_prova_1', 'price_prova_basico_brl', 'incompleta', m.titular, 'prova-cob-titular@local.test')::text);
  perform pg_temp.registrar('assinatura EM ATRASO que nunca foi ativa nao abre conta', null,
    pg_temp.sincronizar('sub_prova_1', 'price_prova_basico_brl', 'em_atraso', m.titular, 'prova-cob-titular@local.test')::text);
  perform pg_temp.registrar('nenhuma conta nasceu ate aqui', antes::text, (select count(*)::text from public.workspaces));

  -- Titular nulo: a função acha o login pelo e-mail, como o webhook faz.
  c := pg_temp.sincronizar('sub_prova_1', 'price_prova_basico_brl', 'ativa', null, 'Prova-Cob-Titular@Local.Test ');
  update mundo set conta = c;
  perform pg_temp.registrar('o pagamento abre UMA conta', (antes + 1)::text, (select count(*)::text from public.workspaces));
  perform pg_temp.registrar('a conta leva o nome da empresa', 'Agência da Prova', (select name from public.workspaces where id = c));
  perform pg_temp.registrar('o titular e o administrador da conta', 'owner',
    (select role from public.workspace_members where workspace_id = c and user_id = m.titular));
  perform pg_temp.registrar('ninguem mais entrou na conta', '1', (select count(*)::text from public.workspace_members where workspace_id = c));
  perform pg_temp.registrar('a assinatura nasce ativa, no plano do preco, com e-mail normalizado',
    'ativa basico BRL prova-cob-titular@local.test',
    (select situacao || ' ' || plano || ' ' || moeda || ' ' || titular_email from public.assinaturas where workspace_id = c));
  perform pg_temp.registrar('o teto mensal do Vini e o do plano, numa linha so', '1 30000000',
    (select count(*) || ' ' || max(limit_micros) from public.ai_budgets where workspace_id = c and brand_id is null and period = 'monthly'));

  c2 := pg_temp.sincronizar('sub_prova_1', 'price_prova_basico_brl', 'ativa', m.titular, 'prova-cob-titular@local.test');
  perform pg_temp.registrar('o mesmo aviso de novo devolve a MESMA conta', c::text, c2::text);
  perform pg_temp.registrar('e nao abre outra', (antes + 1)::text, (select count(*)::text from public.workspaces));

  -- Outra pessoa, outra assinatura: outra conta (para a pergunta 4).
  c2 := pg_temp.sincronizar('sub_prova_2', 'price_prova_basico_usd', 'ativa', m.outro, 'prova-cob-outro@local.test', 'Outra Agência');
  update mundo set conta_outra = c2;
  perform pg_temp.registrar('outra assinatura abre outra conta, em dolar', 'USD', (select moeda from public.assinaturas where workspace_id = c2));
end $$;

-- ─── 3. A vida da assinatura ────────────────────────────────────────────────
do $$
declare m mundo; desde timestamptz;
begin
  select * into m from mundo;

  perform pg_temp.sincronizar('sub_prova_1', 'price_prova_basico_brl', 'em_atraso', m.titular, 'prova-cob-titular@local.test');
  select em_atraso_desde into desde from public.assinaturas where workspace_id = m.conta;
  perform pg_temp.registrar('o atraso marca quando comecou', 'em_atraso true',
    (select situacao || ' ' || (em_atraso_desde is not null) from public.assinaturas where workspace_id = m.conta));
  update public.assinaturas set em_atraso_desde = now() - interval '3 days' where workspace_id = m.conta;
  perform pg_temp.sincronizar('sub_prova_1', 'price_prova_basico_brl', 'em_atraso', m.titular, 'prova-cob-titular@local.test');
  perform pg_temp.registrar('um novo aviso de atraso NAO reinicia a contagem dos 7 dias', '3',
    (select extract(day from now() - em_atraso_desde)::int::text from public.assinaturas where workspace_id = m.conta));

  perform pg_temp.sincronizar('sub_prova_1', 'price_prova_basico_brl', 'ativa', m.titular, 'prova-cob-titular@local.test');
  perform pg_temp.registrar('voltar a pagar limpa o atraso', 'ativa false',
    (select situacao || ' ' || (em_atraso_desde is not null) from public.assinaturas where workspace_id = m.conta));

  update public.ai_budgets set limit_micros = 77000000 where workspace_id = m.conta and brand_id is null and period = 'monthly';
  perform pg_temp.sincronizar('sub_prova_1', 'price_prova_basico_brl', 'ativa', m.titular, 'prova-cob-titular@local.test');
  perform pg_temp.registrar('aviso sem troca de plano preserva o ajuste do Console', '77000000',
    (select limit_micros::text from public.ai_budgets where workspace_id = m.conta and brand_id is null and period = 'monthly'));

  perform pg_temp.sincronizar('sub_prova_1', 'price_prova_medio_brl', 'ativa', m.titular, 'prova-cob-titular@local.test');
  perform pg_temp.registrar('trocar de plano troca o plano e o teto do Vini', 'medio 60000000',
    (select a.plano || ' ' || b.limit_micros from public.assinaturas a
       join public.ai_budgets b on b.workspace_id = a.workspace_id and b.brand_id is null and b.period = 'monthly'
      where a.workspace_id = m.conta));

  perform pg_temp.sincronizar('sub_prova_1', 'price_prova_medio_brl', 'ativa', m.titular, 'prova-cob-titular@local.test', 'x', true);
  perform pg_temp.registrar('pedir cancelamento no fim do periodo so marca', 'ativa true',
    (select situacao || ' ' || cancelar_no_fim from public.assinaturas where workspace_id = m.conta));

  perform pg_temp.sincronizar('sub_prova_1', 'price_prova_medio_brl', 'cancelada', m.titular, 'prova-cob-titular@local.test');
  perform pg_temp.registrar('cancelada registra quando', 'cancelada true',
    (select situacao || ' ' || (cancelada_em is not null) from public.assinaturas where workspace_id = m.conta));
  perform pg_temp.registrar('cancelar NAO apaga a conta nem tira o administrador', '1 owner',
    (select count(*) || ' ' || max(wm.role) from public.workspaces w join public.workspace_members wm on wm.workspace_id = w.id where w.id = m.conta));
  perform pg_temp.registrar('nem a assinatura some', '1', (select count(*)::text from public.assinaturas where workspace_id = m.conta));

  perform pg_temp.registrar('estado incoerente e barrado: atraso sem data', '23514 assinaturas_atraso_coerente',
    pg_temp.direto(format('update public.assinaturas set situacao = ''em_atraso'' where workspace_id = %L', m.conta)));
  perform pg_temp.registrar('estado incoerente e barrado: ativa com data de cancelamento', '23514 assinaturas_cancelamento_coerente',
    pg_temp.direto(format('update public.assinaturas set situacao = ''ativa'' where workspace_id = %L', m.conta)));
  perform pg_temp.registrar('dois precos ATIVOS para o mesmo plano e moeda sao barrados', '23505 precos_do_plano_um_ativo',
    pg_temp.direto('insert into public.precos_do_plano (plano, provedor, id_externo, moeda, intervalo) values (''basico'', ''stripe'', ''price_prova_dup'', ''BRL'', ''mes'')'));
  perform pg_temp.registrar('o mesmo preco do provedor nao vale para dois planos', '23505 precos_do_plano_id_externo_unico',
    pg_temp.direto('insert into public.precos_do_plano (plano, provedor, id_externo, moeda, intervalo) values (''premium'', ''stripe'', ''price_prova_basico_brl'', ''BRL'', ''ano'')'));
end $$;

-- ─── 4. Quem lê a assinatura ────────────────────────────────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  insert into public.workspace_members (workspace_id, user_id, role) values (m.conta, m.membro, 'member');
  perform pg_temp.registrar('o administrador le a assinatura da conta dele', '1',
    pg_temp.valor(m.titular, format('select count(*)::text from public.assinaturas where workspace_id = %L', m.conta)));
  perform pg_temp.registrar('e so a dele', '1', pg_temp.valor(m.titular, 'select count(*)::text from public.assinaturas'));
  perform pg_temp.registrar('o administrador de outra conta NAO le', '0',
    pg_temp.valor(m.outro, format('select count(*)::text from public.assinaturas where workspace_id = %L', m.conta)));
  perform pg_temp.registrar('quem e da conta mas nao administra NAO le', '0',
    pg_temp.valor(m.membro, 'select count(*)::text from public.assinaturas'));
  perform pg_temp.registrar('logado NAO le o registro de avisos', '42501',
    (select estado from pg_temp.como(m.titular, 'select 1 from public.eventos_de_cobranca')));
end $$;

-- ─── 5. Avisos: uma vez só, e para sempre ───────────────────────────────────
do $$
declare r text;
begin
  execute 'set local role service_role';
  r := public.cobranca_receber_evento('stripe', 'evt_prova_1', 'invoice.paid');
  execute 'reset role';
  perform pg_temp.registrar('o primeiro aviso e novo', 'novo', r);

  execute 'set local role service_role';
  perform public.cobranca_concluir_evento('stripe', 'evt_prova_1', 'falhou', 'o provedor nao respondeu');
  r := public.cobranca_receber_evento('stripe', 'evt_prova_1', 'invoice.paid');
  execute 'reset role';
  perform pg_temp.registrar('o aviso que falhou e repetido', 'repetir', r);
  perform pg_temp.registrar('contando a tentativa', '2 falhou',
    (select tentativas || ' ' || resultado from public.eventos_de_cobranca where id_externo = 'evt_prova_1'));

  execute 'set local role service_role';
  perform public.cobranca_concluir_evento('stripe', 'evt_prova_1', 'processado', null, 'sub_prova_1');
  r := public.cobranca_receber_evento('stripe', 'evt_prova_1', 'invoice.paid');
  execute 'reset role';
  perform pg_temp.registrar('o aviso concluido NAO e processado de novo', 'concluido', r);
  perform pg_temp.registrar('e guarda a assinatura a que se refere', 'sub_prova_1',
    (select id_externo_assinatura from public.eventos_de_cobranca where id_externo = 'evt_prova_1'));

  perform pg_temp.registrar('nem o dono do banco apaga um aviso', '42501 eventos_de_cobranca_imutaveis',
    pg_temp.direto('delete from public.eventos_de_cobranca where id_externo = ''evt_prova_1'''));
  perform pg_temp.registrar('nem reescreve um aviso concluido', '42501 eventos_de_cobranca_imutaveis',
    pg_temp.direto('update public.eventos_de_cobranca set resultado = ''ignorado'' where id_externo = ''evt_prova_1'''));
  perform pg_temp.registrar('o mesmo aviso nao entra duas vezes', '23505 eventos_de_cobranca_id_externo_unico',
    pg_temp.direto('insert into public.eventos_de_cobranca (provedor, id_externo, tipo) values (''stripe'', ''evt_prova_1'', ''x'')'));
  perform pg_temp.registrar('concluido exige data, e data exige conclusao', '23514 eventos_de_cobranca_conclusao_coerente',
    pg_temp.direto('insert into public.eventos_de_cobranca (provedor, id_externo, tipo, resultado) values (''stripe'', ''evt_prova_2'', ''x'', ''processado'')'));
end $$;

-- ─── 6. O Console da cobrança e o preço do checkout (fatia 2) ───────────────
do $$
declare m mundo; t record; antigo uuid; n_registro integer;
begin
  select * into m from mundo;
  select count(*) into n_registro from private.registro_da_equipe;

  select * into t from pg_temp.como(m.titular, 'select public.console_cobranca()');
  perform pg_temp.registrar('cliente NAO le o painel da cobranca', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, 'select public.console_definir_plano(''basico'', ''Básico'', 99, 999999999, null, true, 1::smallint, ''tentativa'')');
  perform pg_temp.registrar('cliente NAO ajusta plano', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, 'select public.console_registrar_preco(''premium'', ''price_pirata'', ''BRL'', ''mes'', ''tentativa'')');
  perform pg_temp.registrar('cliente NAO registra preco', '42501', t.estado);
  select * into t from pg_temp.como(m.titular, 'select public.cobranca_preco_ativo(''basico'', ''BRL'', ''mes'', true)');
  perform pg_temp.registrar('cliente NAO consulta o preco do checkout', '42501', t.estado);
  perform pg_temp.registrar('visitante NAO consulta o preco do checkout', '42501',
    pg_temp.papel('anon', 'select public.cobranca_preco_ativo(''basico'', ''BRL'', ''mes'', true)'));

  perform pg_temp.registrar('a equipe le os 4 planos e os precos', '4 3',
    pg_temp.valor(m.equipe, 'select jsonb_array_length(public.console_cobranca()->''planos'') || '' '' || jsonb_array_length(public.console_cobranca()->''precos'')'));
  perform pg_temp.registrar('e as assinaturas, com o nome da conta', 'Agência da Prova',
    pg_temp.valor(m.equipe, format('select x->>''conta'' from jsonb_array_elements(public.console_cobranca()->''assinaturas'') x where x->>''workspace_id'' = %L', m.conta)));

  perform pg_temp.valor(m.equipe, 'select public.console_definir_plano(''medio'', ''Médio'', 20, 70000000, null, true, 2::smallint, ''ajuste da prova'')::text');
  perform pg_temp.registrar('a equipe ajusta o plano', '20 70000000',
    (select maximo_de_marcas || ' ' || teto_mensal_do_vini_micros from public.planos where codigo = 'medio'));
  perform pg_temp.registrar('ajustar o plano NAO mexe no teto de quem ja assina', '60000000',
    (select limit_micros::text from public.ai_budgets where workspace_id = m.conta and brand_id is null and period = 'monthly'));
  perform pg_temp.valor(m.equipe, 'select public.console_definir_plano(''agencia-grande'', ''Agência grande'', null, 200000000, null, false, 9::smallint, ''plano sob medida'')::text');
  perform pg_temp.registrar('a equipe cria um plano novo, sem limite de marcas e fora de venda', 'Agência grande - false',
    (select nome || ' ' || coalesce(maximo_de_marcas::text, '-') || ' ' || a_venda from public.planos where codigo = 'agencia-grande'));
  select * into t from pg_temp.como(m.equipe, 'select public.console_definir_plano(''x'', ''X'', 1, 0, null, false, 0::smallint, ''ajuste'')');
  perform pg_temp.registrar('codigo de plano invalido e recusado', '23514 planos_codigo_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.equipe, 'select public.console_definir_plano(''medio'', ''Médio'', 20, 1, null, true, 2::smallint, ''x'')');
  perform pg_temp.registrar('sem motivo de verdade, nada muda', '23514 registro_da_equipe_motivo_check', t.estado || ' ' || t.nome);
  perform pg_temp.registrar('e o teto ficou como estava', '70000000', (select teto_mensal_do_vini_micros::text from public.planos where codigo = 'medio'));

  select id into antigo from public.precos_do_plano where id_externo = 'price_prova_basico_brl';
  perform pg_temp.valor(m.equipe, 'select public.console_registrar_preco(''basico'', ''price_prova_basico_brl_v2'', ''brl'', ''mes'', ''reajuste da prova'')::text');
  perform pg_temp.registrar('o preco novo substitui o antigo no checkout', 'price_prova_basico_brl_v2',
    pg_temp.direto_valor('select public.cobranca_preco_ativo(''basico'', ''BRL'', ''mes'', true)'));
  perform pg_temp.registrar('o antigo fica, inativo — assinaturas antigas seguem nele', 'false',
    (select ativo::text from public.precos_do_plano where id = antigo));
  perform pg_temp.registrar('e o webhook ainda o reconhece', 'ACEITOU',
    pg_temp.servidor('select public.cobranca_sincronizar_assinatura(''stripe'', ''cus_prova'', ''sub_prova_2'', ''price_prova_basico_brl'', ''ativa'', now(), false, ''brl'', null, ''prova-cob-outro@local.test'', ''x'')'));
  select * into t from pg_temp.como(m.equipe, 'select public.console_registrar_preco(''basico'', ''prod_errado'', ''BRL'', ''mes'', ''engano'')');
  perform pg_temp.registrar('identificador que nao e de preco e recusado', '22023', t.estado);

  perform pg_temp.registrar('o Piloto NAO sai pelo site', null,
    pg_temp.direto_valor('select public.cobranca_preco_ativo(''piloto'', ''BRL'', ''mes'', true)'));
  insert into public.precos_do_plano (plano, provedor, id_externo, moeda, intervalo) values ('piloto', 'stripe', 'price_prova_piloto', 'BRL', 'mes');
  perform pg_temp.registrar('mesmo com preco, o Piloto NAO sai pelo site', null,
    pg_temp.direto_valor('select public.cobranca_preco_ativo(''piloto'', ''BRL'', ''mes'', true)'));
  perform pg_temp.registrar('mas sai pelo link da equipe', 'price_prova_piloto',
    pg_temp.direto_valor('select public.cobranca_preco_ativo(''piloto'', ''BRL'', ''mes'', false)'));
  perform pg_temp.registrar('moeda sem preco nao acha nada', null,
    pg_temp.direto_valor('select public.cobranca_preco_ativo(''medio'', ''USD'', ''mes'', true)'));

  perform pg_temp.valor(m.equipe, format('select public.console_desativar_preco(%L, ''fim da prova'')::text',
    (select id from public.precos_do_plano where id_externo = 'price_prova_piloto')));
  perform pg_temp.registrar('preco desativado sai do checkout', null,
    pg_temp.direto_valor('select public.cobranca_preco_ativo(''piloto'', ''BRL'', ''mes'', false)'));
  select * into t from pg_temp.como(m.equipe, format('select public.console_desativar_preco(%L, ''de novo'')',
    (select id from public.precos_do_plano where id_externo = 'price_prova_piloto')));
  perform pg_temp.registrar('desativar de novo diz que nao achou', 'P0002', t.estado);

  perform pg_temp.registrar('cada acao da equipe que valeu ficou no registro, com quem fez', '4 Equipe da Prova',
    (select count(*) || ' ' || max(quem_nome) from private.registro_da_equipe where quem = m.equipe));
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido from resultado order by ordem;

select case when count(*) filter (where not passou) = 0
            then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*) end as veredito
from resultado;

do $$
declare n integer;
begin
  select count(*) filter (where not passou) into n from resultado;
  if n > 0 then raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001'; end if;
end $$;

rollback;
