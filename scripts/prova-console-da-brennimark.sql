-- Prova do Console da Brennimark — 28/09/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE conferido onde há
-- recusa, e `rollback` no fim. Caso cuja preparação falha reprova.
--
-- Três perguntas:
--   1. Só a EQUIPE lê: visitante, cliente e cliente dono de conta recebem
--      42501 — a mesma resposta, sem dizer mais nada.
--   2. A lista da equipe é inalcançável pela API: nenhuma sessão a lê nem a
--      altera, nem a função interna que a consulta.
--   3. Os números batem com o razão: só execuções liquidadas, tokens e custo
--      somados por conta, marca e modelo; o limite do dia com a MESMA conta
--      que a reserva faz; o armazenamento na fotografia mais recente.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (equipe uuid, dono uuid, estranho uuid, w1 uuid, w2 uuid, marca_a uuid, marca_c uuid);

create function pg_temp.como(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text; n integer;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics n = row_count;
    estado := 'ACEITOU ' || n;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
  end;
  return estado;
end $f$;

create function pg_temp.anonimo(p_sql text) returns text
language plpgsql as $f$
declare estado text;
begin
  begin
    execute 'set local role anon';
    execute p_sql;
    estado := 'ACEITOU';
    execute 'reset role';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
  end;
  return estado;
end $f$;

-- Lê uma consulta COMO a equipe e devolve o resultado em texto.
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

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_eq uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeee0001';
  u_dono uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeee0002';
  u_fora uuid := 'eeeeeeee-eeee-4eee-8eee-eeeeeeee0003';
  w1 uuid; w2 uuid; a uuid; c uuid;
  todas text[] := array['consultar','editar','aprovar','administrar'];
begin
  insert into auth.users (id, email, aud, role) values
    (u_eq, 'prova-console-equipe@local.test', 'authenticated', 'authenticated'),
    (u_dono, 'prova-console-dono@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-console-fora@local.test', 'authenticated', 'authenticated');
  insert into public.workspaces (name, slug) values ('Prova Console Um', 'prova-console-um') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Console Dois', 'prova-console-dois') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values (w1, u_dono, 'owner'), (w2, u_fora, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'console-a', 'Marca A', 'A', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w2, 'console-c', 'Marca C', 'C', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (a, w1, u_dono, todas), (c, w2, u_fora, todas)
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  -- A equipe: um membro, e ele NÃO participa de conta nenhuma.
  insert into private.equipe_brennimark (user_id, nome, motivo) values (u_eq, 'Equipe de prova', 'prova');

  -- O razão: 2 liquidadas na marca A (uma sem tokens medidos), 1 reservada,
  -- 1 liberada, 1 liquidada de ONTEM, e 1 liquidada na conta 2.
  insert into public.ai_ledger (workspace_id, brand_id, execution_id, task, provider, model, status,
                                reserved_micros, settled_micros, settled_at, released_at, currency, usage_snapshot, created_at) values
    (w1, a, gen_random_uuid(), 'assist', 'google', 'gemini-x', 'settled', 500, 100, now(), null, 'USD', '{"inputTokens":1000,"outputTokens":200}', now()),
    (w1, a, gen_random_uuid(), 'assist', 'google', 'gemini-x', 'settled', 500, 300, now(), null, 'USD', '{"unknown":true}', now()),
    -- Recusada pelo provedor (503): custo ZERO, medido (28/09/2026).
    (w1, a, gen_random_uuid(), 'assist', 'google', 'gemini-x', 'settled', 500, 0, now(), null, 'USD', '{"inputTokens":0,"outputTokens":0,"recusadoPeloProvedor":503}', now()),
    (w1, a, gen_random_uuid(), 'assist', 'google', 'gemini-x', 'reserved', 700, null, null, null, 'USD', null, now()),
    (w1, a, gen_random_uuid(), 'assist', 'google', 'gemini-x', 'released', 900, null, null, now(), 'USD', null, now()),
    (w1, a, gen_random_uuid(), 'assist', 'google', 'gemini-x', 'settled', 500, 5000, now() - interval '2 days', null, 'USD', '{"inputTokens":9,"outputTokens":9}', now() - interval '2 days'),
    (w2, c, gen_random_uuid(), 'analyse-image', 'groq', 'qwen', 'settled', 50, 40, now(), null, 'USD', '{"inputTokens":10,"outputTokens":5}', now());

  -- Desde 29/09 (`ia_da_plataforma`) toda conta nasce com limites padrão, e o
  -- `do nothing` daqui deixava o padrão no lugar: a prova passou a ler o teto
  -- errado. Corrigido na revisão de 01/10: o teto da prova SUBSTITUI o padrão.
  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency, kill_switch)
  values (w1, null, 'daily', 1000, 'USD', false)
  on conflict (workspace_id, brand_id, period) do update set limit_micros = excluded.limit_micros;

  -- Armazenamento: duas fotografias da conta 1; vale a mais recente.
  insert into public.consumo_de_armazenamento (dia, workspace_id, brand_id, bucket_id, objetos, bytes) values
    (current_date - 1, w1, a, 'brand-assets', 1, 100),
    (current_date,     w1, a, 'brand-assets', 3, 300),
    (current_date,     w1, null, 'brand-imports', 1, 50);

  insert into mundo values (u_eq, u_dono, u_fora, w1, w2, a, c);
end $$;

-- ─── 1. Só a equipe lê ──────────────────────────────────────────────────────
do $$
declare m record; hoje text := quote_literal(date_trunc('day', now())); amanha text := quote_literal(date_trunc('day', now()) + interval '1 day');
begin
  select * into m from mundo;
  perform pg_temp.registrar('dono de conta NAO le custos entre contas', '42501',
    pg_temp.como(m.dono, format('select * from public.console_custos_de_ia(%s, %s)', hoje, amanha)));
  perform pg_temp.registrar('dono de conta NAO le armazenamento entre contas', '42501',
    pg_temp.como(m.dono, 'select * from public.console_armazenamento(current_date)'));
  perform pg_temp.registrar('dono de conta NAO le limites entre contas', '42501',
    pg_temp.como(m.dono, 'select * from public.console_limites()'));
  perform pg_temp.registrar('outro cliente NAO le custos', '42501',
    pg_temp.como(m.estranho, format('select * from public.console_custos_de_ia(%s, %s)', hoje, amanha)));
  perform pg_temp.registrar('visitante sem sessao NAO chama o console', '42501',
    pg_temp.anonimo('select * from public.console_limites()'));
  perform pg_temp.registrar('cliente pergunta "sou da equipe?" e ouve nao', 'false',
    pg_temp.valor(m.dono, 'select public.sou_da_equipe_brennimark()::text'));
  perform pg_temp.registrar('a equipe pergunta e ouve sim', 'true',
    pg_temp.valor(m.equipe, 'select public.sou_da_equipe_brennimark()::text'));
end $$;

-- ─── 2. A lista da equipe é inalcançável ───────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('cliente NAO le a lista da equipe', '42501',
    pg_temp.como(m.dono, 'select * from private.equipe_brennimark'));
  perform pg_temp.registrar('cliente NAO se poe na equipe', '42501',
    pg_temp.como(m.dono, format('insert into private.equipe_brennimark (user_id, nome) values (%L, %L)', m.dono, 'eu')));
  perform pg_temp.registrar('nem a propria equipe altera a lista por sessao', '42501',
    pg_temp.como(m.equipe, format('insert into private.equipe_brennimark (user_id, nome) values (%L, %L)', m.dono, 'eu')));
  perform pg_temp.registrar('cliente NAO chama a funcao interna', '42501',
    pg_temp.como(m.dono, 'select private.eh_da_equipe()'));
end $$;

-- ─── 3. Os números batem com o razão ───────────────────────────────────────
do $$
declare m record; hoje text := quote_literal(date_trunc('day', now())); amanha text := quote_literal(date_trunc('day', now()) + interval '1 day');
begin
  select * into m from mundo;
  perform pg_temp.registrar('conta 1 hoje: 3 liquidadas, tokens 1000/200, custo 400, 1 sem uso medido, 300 incerto, 1 recusada',
    '3 1000 200 400 1 300 1',
    pg_temp.valor(m.equipe, format(
      'select execucoes||'' ''||tokens_entrada||'' ''||tokens_saida||'' ''||custo_micros||'' ''||sem_uso_medido
              ||'' ''||custo_incerto_micros||'' ''||recusadas
         from public.console_custos_de_ia(%s, %s) where workspace_id = %L', hoje, amanha, m.w1)));
  perform pg_temp.registrar('a execucao de anteontem fica fora do intervalo de hoje', '1',
    pg_temp.valor(m.equipe, format('select count(*)::text from public.console_custos_de_ia(%s, %s) where workspace_id = %L', hoje, amanha, m.w1)));
  perform pg_temp.registrar('a equipe ve as DUAS contas, com os nomes', 'Marca A, Marca C',
    pg_temp.valor(m.equipe, format(
      'select string_agg(marca, '', '' order by marca) from public.console_custos_de_ia(%s, %s) where workspace_id in (%L, %L)',
      hoje, amanha, m.w1, m.w2)));
  perform pg_temp.registrar('limite: gasto de hoje = liquidadas + reservada (100+300+700), sem a liberada nem a de anteontem',
    '1000 1100',
    pg_temp.valor(m.equipe, format('select limit_micros||'' ''||gasto_hoje_micros from public.console_limites() where workspace_id = %L and brand_id is null and period = ''daily''', m.w1)));
  perform pg_temp.registrar('armazenamento: vale a fotografia mais recente (300 bytes, nao 100)', '300 50',
    pg_temp.valor(m.equipe, format(
      'select string_agg(bytes::text, '' '' order by bytes desc) from public.console_armazenamento(current_date) where workspace_id = %L', m.w1)));
  perform pg_temp.registrar('armazenamento ate ontem: a fotografia de ontem', '100',
    pg_temp.valor(m.equipe, format(
      'select string_agg(bytes::text, '' '') from public.console_armazenamento(current_date - 1) where workspace_id = %L', m.w1)));
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
