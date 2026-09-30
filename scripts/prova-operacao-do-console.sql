-- Prova da operação do Console — etapa 3 — 30/09/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e NOME da
-- constraint conferidos onde há recusa, e `rollback` no fim.
--
-- Cinco perguntas:
--   1. Só a EQUIPE pausa, retoma e lê a ficha; cliente e visitante recebem
--      42501, inclusive o dono da conta pausada.
--   2. Cada trava para o que diz parar, e SÓ isso: a geral para todas as
--      contas; a da conta, só aquela conta; a da marca, só aquela marca.
--   3. Pausar uma marca não inventa teto: a linha nasce com teto vazio, e o
--      teto vazio não limita; a linha de CONTA continua obrigada a ter teto.
--   4. Toda ação fica no registro com motivo — e sem motivo nada muda.
--   5. A ficha conta pessoas, marcas e uso, sem conteúdo de conversa.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (equipe uuid, dono uuid, leitor uuid, w1 uuid, w2 uuid, marca_a uuid, marca_b uuid, marca_c uuid);

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
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado = p_obtido);
$f$;

-- A reserva como o servidor a chama (chave de serviço), para um membro da conta.
create function pg_temp.reserva(p_quem uuid, p_conta uuid, p_marca uuid, p_micros bigint default 10) returns text
language plpgsql as $f$
declare r record;
begin
  select * into r from public.reservar_execucao_de_ia_server(p_quem, p_conta, p_marca, gen_random_uuid(), 'assist', p_micros, 'USD', null);
  return r.ok || ' ' || r.motivo;
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_eq uuid := 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfb0001';
  u_dono uuid := 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfb0002';
  u_leitor uuid := 'fbfbfbfb-fbfb-4bfb-8bfb-fbfbfbfb0003';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u_eq, 'prova-operacao-equipe@local.test', 'authenticated', 'authenticated'),
    (u_dono, 'prova-operacao-dono@local.test', 'authenticated', 'authenticated'),
    (u_leitor, 'prova-operacao-leitor@local.test', 'authenticated', 'authenticated');
  insert into private.equipe_brennimark (user_id, nome, motivo) values (u_eq, 'Equipe de prova', 'prova');
  -- O gatilho do #64 dá às duas contas os limites padrão (dia e mês).
  insert into public.workspaces (name, slug) values ('Prova Operação 1', 'prova-operacao-1') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Operação 2', 'prova-operacao-2') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values (w1, u_dono, 'owner'), (w2, u_dono, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w1, 'operacao-a', 'Marca A', 'A', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w1, 'operacao-b', 'Marca B', 'B', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w2, 'operacao-c', 'Marca C', 'C', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (a, w1, u_leitor, array['consultar'])
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;
  insert into mundo values (u_eq, u_dono, u_leitor, w1, w2, a, b, c);
end $$;

-- ─── 1. Só a equipe ─────────────────────────────────────────────────────────
do $$
declare m mundo; t record;
begin
  select * into m from mundo;
  select * into t from pg_temp.como(m.dono, 'select public.console_pausar_plataforma(true, ''tentativa do cliente'')');
  perform pg_temp.registrar('o dono de conta NAO pausa a plataforma', '42501', t.estado);
  select * into t from pg_temp.como(m.dono, format('select public.console_pausar_conta(%L, false, ''retomar a propria conta'')', m.w1));
  perform pg_temp.registrar('o dono NAO pausa nem retoma a propria conta', '42501', t.estado);
  select * into t from pg_temp.como(m.dono, format('select public.console_pausar_marca(%L, false, ''retomar a propria marca'')', m.marca_a));
  perform pg_temp.registrar('o dono NAO pausa nem retoma a propria marca', '42501', t.estado);
  select * into t from pg_temp.como(m.dono, format('select public.console_ficha_da_conta(%L)', m.w1));
  perform pg_temp.registrar('o dono NAO le a ficha da conta pelo Console', '42501', t.estado);
  select * into t from pg_temp.como(m.leitor, 'select * from public.console_contas()');
  perform pg_temp.registrar('quem so consulta NAO lista as contas', '42501', t.estado);
  perform pg_temp.registrar('visitante NAO pausa nada', '42501', pg_temp.papel('anon', 'select public.console_pausar_plataforma(true, ''visitante'')'));
  select * into t from pg_temp.como(m.dono, 'update private.parametros_da_plataforma set vini_pausado = false');
  perform pg_temp.registrar('cliente NAO mexe direto na trava geral', '42501', t.estado);
  select * into t from pg_temp.como(m.dono, format('update public.ai_budgets set kill_switch = false where workspace_id = %L', m.w1));
  perform pg_temp.registrar('cliente NAO mexe direto na trava da conta', '42501', t.estado);
end $$;

-- ─── 2. Cada trava para o que diz parar ─────────────────────────────────────
do $$
declare m mundo; t record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('antes de tudo, a conta 1 reserva', 'true reservado', pg_temp.reserva(m.dono, m.w1, m.marca_a));

  -- Trava geral.
  select * into t from pg_temp.como(m.equipe, 'select public.console_pausar_plataforma(true, ''chave vazada, prova'')');
  perform pg_temp.registrar('a equipe pausa a plataforma', 'ACEITOU 1', t.estado);
  perform pg_temp.registrar('com a trava geral, a conta 1 NAO reserva', 'false plataforma_pausada', pg_temp.reserva(m.dono, m.w1, m.marca_a));
  perform pg_temp.registrar('e a conta 2 tambem NAO', 'false plataforma_pausada', pg_temp.reserva(m.dono, m.w2, m.marca_c));
  select * into t from pg_temp.como(m.equipe, 'select public.console_pausar_plataforma(false, ''chave trocada, prova'')');
  perform pg_temp.registrar('retomada a plataforma, a conta 2 reserva de novo', 'true reservado', pg_temp.reserva(m.dono, m.w2, m.marca_c));

  -- Trava da conta.
  select * into t from pg_temp.como(m.equipe, format('select public.console_pausar_conta(%L, true, ''uso anormal, prova'')', m.w1));
  perform pg_temp.registrar('a equipe pausa a conta 1', 'ACEITOU 1', t.estado);
  perform pg_temp.registrar('a trava vale no dia e no mes da conta',
    'daily:true monthly:true',
    (select string_agg(period || ':' || kill_switch, ' ' order by period) from public.ai_budgets where workspace_id = m.w1 and brand_id is null));
  perform pg_temp.registrar('com a conta 1 pausada, ela NAO reserva', 'false kill_switch_workspace', pg_temp.reserva(m.dono, m.w1, m.marca_b));
  perform pg_temp.registrar('e a conta 2, do mesmo dono, continua reservando', 'true reservado', pg_temp.reserva(m.dono, m.w2, m.marca_c));
  select * into t from pg_temp.como(m.equipe, 'select public.console_pausar_conta(''00000000-0000-4000-8000-00000000abcd'', true, ''conta que nao existe'')');
  perform pg_temp.registrar('pausar conta inexistente e recusado, nao finge sucesso', 'P0002', t.estado);
  select * into t from pg_temp.como(m.equipe, format('select public.console_pausar_conta(%L, false, ''uso normalizado, prova'')', m.w1));
  perform pg_temp.registrar('retomada, a conta 1 reserva de novo', 'true reservado', pg_temp.reserva(m.dono, m.w1, m.marca_b));

  -- Trava da marca.
  select * into t from pg_temp.como(m.equipe, format('select public.console_pausar_marca(%L, true, ''pedido do cliente, prova'')', m.marca_a));
  perform pg_temp.registrar('a equipe pausa a marca A', 'ACEITOU 1', t.estado);
  perform pg_temp.registrar('com a marca A pausada, ela NAO reserva', 'false kill_switch_marca', pg_temp.reserva(m.dono, m.w1, m.marca_a));
  perform pg_temp.registrar('e a marca B, da mesma conta, continua', 'true reservado', pg_temp.reserva(m.dono, m.w1, m.marca_b));
end $$;

-- ─── 3. Teto vazio só de marca ─────────────────────────────────────────────
do $$
declare m mundo; t record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('a linha da marca pausada nasceu com teto VAZIO', 'daily: true',
    (select period || ':' || coalesce(limit_micros::text, '') || ' ' || kill_switch from public.ai_budgets where brand_id = m.marca_a));
  select * into t from pg_temp.como(m.equipe, format('select public.console_pausar_marca(%L, false, ''pedido atendido, prova'')', m.marca_a));
  -- O teto da conta é US$ 5/dia; 3 dólares passariam de qualquer teto inventado baixo.
  perform pg_temp.registrar('retomada, o teto vazio NAO limita a marca', 'true reservado', pg_temp.reserva(m.dono, m.w1, m.marca_a, 3000000));
  begin
    update public.ai_budgets set limit_micros = null where workspace_id = m.w2 and brand_id is null and period = 'daily';
    perform pg_temp.registrar('linha de CONTA sem teto e recusada', '23514 ai_budgets_teto_vazio_so_de_marca', 'ACEITOU');
  exception when others then
    declare e text; n text;
    begin
      get stacked diagnostics e = returned_sqlstate, n = constraint_name;
      perform pg_temp.registrar('linha de CONTA sem teto e recusada', '23514 ai_budgets_teto_vazio_so_de_marca', e || ' ' || n);
    end;
  end;
end $$;

-- ─── 4. O registro ──────────────────────────────────────────────────────────
do $$
declare m mundo; t record; linhas_antes integer;
begin
  select * into m from mundo;
  perform pg_temp.registrar('cada acao aceita ficou no registro (2 plataforma, 2 conta, 2 marca)', '6',
    (select count(*)::text from private.registro_da_equipe where quem = m.equipe));
  perform pg_temp.registrar('o registro guarda o antes, o depois e o motivo',
    'pausar o Vini|marca|{"pausado": false}|{"pausado": true}|pedido do cliente, prova',
    (select r.acao || '|' || split_part(r.alvo, ' ', 1) || '|' || r.antes::text || '|' || r.depois::text || '|' || r.motivo
       from private.registro_da_equipe r where r.quem = m.equipe and r.motivo = 'pedido do cliente, prova'));
  select count(*) into linhas_antes from private.registro_da_equipe;
  select * into t from pg_temp.como(m.equipe, 'select public.console_pausar_plataforma(true, ''x'')');
  perform pg_temp.registrar('sem motivo de verdade, nada muda', '23514 registro_da_equipe_motivo_check', t.estado || ' ' || t.nome);
  perform pg_temp.registrar('e a plataforma continua sem pausa', 'false',
    (select vini_pausado::text from private.parametros_da_plataforma where id));
  perform pg_temp.registrar('e o registro nao ganhou linha', linhas_antes::text, (select count(*)::text from private.registro_da_equipe));
end $$;

-- ─── 5. A ficha e a lista ───────────────────────────────────────────────────
do $$
declare m mundo; ficha jsonb;
begin
  select * into m from mundo;
  ficha := pg_temp.valor(m.equipe, format('select public.console_ficha_da_conta(%L)::text', m.w1))::jsonb;
  perform pg_temp.registrar('a ficha conta as pessoas pela conta e pela marca (dono + leitor)', '2', ficha->>'pessoas');
  perform pg_temp.registrar('a ficha lista as marcas da conta, e so as dela', 'Marca A,Marca B',
    (select string_agg(x->>'nome', ',' order by x->>'nome') from jsonb_array_elements(ficha->'marcas') x));
  perform pg_temp.registrar('a ficha traz os limites da conta', '5000000 60000000',
    (ficha->'limites'->>'daily') || ' ' || (ficha->'limites'->>'monthly'));
  -- Quatro reservas aceitas na conta 1; as recusadas não viram pedido no razão.
  perform pg_temp.registrar('a ficha conta os pedidos do dia desta conta', '4', ficha->'uso'->>'pedidos_hoje');
  perform pg_temp.registrar('a ficha nao traz texto de conversa', 'false', (ficha::text like '%messages%' or ficha::text like '%content%')::text);
  perform pg_temp.registrar('a lista mostra as duas contas da prova', '2',
    pg_temp.valor(m.equipe, 'select count(*)::text from public.console_contas() where slug like ''prova-operacao-%'''));
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
