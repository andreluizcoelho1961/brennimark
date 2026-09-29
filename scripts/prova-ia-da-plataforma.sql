-- Prova da IA da plataforma — etapa 2 do Console — 29/09/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e NOME da
-- constraint conferidos onde há recusa, e `rollback` no fim.
--
-- Quatro perguntas:
--   1. Só a EQUIPE muda rotas e limites; o servidor (chave de serviço) lê as
--      rotas; o cliente não lê nem muda nada disso.
--   2. Toda mudança fica no registro da equipe, com quem, antes, depois e
--      motivo — e sem motivo não há mudança.
--   3. O cliente LÊ o próprio limite e NÃO o altera; conta nova nasce com os
--      limites padrão da plataforma.
--   4. A reserva respeita o teto do MÊS, e o painel soma o gasto do período.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (equipe uuid, dono uuid, w1 uuid, marca_a uuid);

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

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_eq uuid := 'fafafafa-fafa-4afa-8afa-fafafafa0001';
  u_dono uuid := 'fafafafa-fafa-4afa-8afa-fafafafa0002';
  w1 uuid; a uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u_eq, 'prova-iaplat-equipe@local.test', 'authenticated', 'authenticated'),
    (u_dono, 'prova-iaplat-dono@local.test', 'authenticated', 'authenticated');
  insert into private.equipe_brennimark (user_id, nome, motivo) values (u_eq, 'Equipe de prova', 'prova');
  insert into public.workspaces (name, slug) values ('Prova IA Plat', 'prova-ia-plat') returning id into w1;
  insert into public.workspace_members (workspace_id, user_id, role) values (w1, u_dono, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'iaplat-a', 'Marca A', 'A', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
  values (a, w1, u_dono, array['consultar','editar','aprovar','administrar'])
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;
  insert into mundo values (u_eq, u_dono, w1, a);
end $$;

-- ─── 1. Quem lê e quem muda as rotas ───────────────────────────────────────
do $$
declare m record; t record;
begin
  select * into m from mundo;
  t := pg_temp.como(m.dono, 'select public.console_ia_da_plataforma()');
  perform pg_temp.registrar('dono de conta NAO le as rotas pelo console', '42501', t.estado);
  t := pg_temp.como(m.dono, $q$select public.console_definir_rotas('chat', '[{"provider":"google","model":"x"}]', 9000, 'tentativa')$q$);
  perform pg_temp.registrar('dono de conta NAO muda as rotas', '42501', t.estado);
  t := pg_temp.como(m.dono, 'select * from public.rotas_de_ia_da_plataforma()');
  perform pg_temp.registrar('sessao de cliente NAO le a leitura do servidor', '42501', t.estado);
  perform pg_temp.registrar('visitante NAO le a leitura do servidor', '42501', pg_temp.papel('anon', 'select * from public.rotas_de_ia_da_plataforma()'));
  perform pg_temp.registrar('o servidor (chave de servico) le as rotas', 'ACEITOU', pg_temp.papel('service_role', 'select * from public.rotas_de_ia_da_plataforma()'));
  t := pg_temp.como(m.dono, 'select * from private.rotas_de_ia');
  perform pg_temp.registrar('cliente NAO le a tabela das rotas', '42501', t.estado);
  perform pg_temp.registrar('as rotas nascem iguais ao Vini de hoje',
    'analysis:google gemini-3.6-flash,analysis:groq qwen/qwen3.8-27b,chat:google gemini-3.6-flash,chat:groq qwen/qwen3.8-27b',
    (select string_agg(tarefa||':'||provider||' '||model, ',' order by tarefa, ordem) from private.rotas_de_ia));
end $$;

-- ─── 2. A equipe muda, e tudo fica registrado ──────────────────────────────
do $$
declare m record; t record;
begin
  select * into m from mundo;
  t := pg_temp.como(m.equipe, $q$select public.console_definir_rotas('chat', '[{"provider":"groq","model":"qwen/qwen3.8-27b"},{"provider":"google","model":"gemini-3.6-flash"}]', 15000, 'Gemini em pico de demanda')$q$);
  perform pg_temp.registrar('a equipe troca a ordem das rotas da conversa', 'ACEITOU 1', t.estado);
  perform pg_temp.registrar('e o servidor ve a ordem nova e a espera nova', '1:groq 2:google 15000',
    (select string_agg(ordem||':'||provider, ' ' order by ordem) || ' ' || max(espera_ms) from public.rotas_de_ia_da_plataforma() where tarefa = 'chat'));
  perform pg_temp.registrar('o registro guarda quem, o antes, o depois e o motivo',
    'Equipe de prova|chat|google|groq|Gemini em pico de demanda',
    (select quem_nome||'|'||alvo||'|'||(antes->'rotas'->0->>'provider')||'|'||(depois->'rotas'->0->>'provider')||'|'||motivo
       from private.registro_da_equipe where acao = 'definir rotas de IA' order by created_at desc limit 1));

  t := pg_temp.como(m.equipe, $q$select public.console_definir_rotas('chat', '[{"provider":"inventado","model":"x"}]', 15000, 'teste')$q$);
  perform pg_temp.registrar('provedor desconhecido e recusado', '23514 rotas_de_ia_provider_check', t.estado || ' ' || t.nome);
  t := pg_temp.como(m.equipe, $q$select public.console_definir_rotas('chat', '[]', 15000, 'teste')$q$);
  perform pg_temp.registrar('lista vazia de modelos e recusada', '22023', t.estado);
  t := pg_temp.como(m.equipe, $q$select public.console_definir_rotas('chat', '[{"provider":"google","model":"gemini-3.6-flash"}]', 15000, 'x')$q$);
  perform pg_temp.registrar('sem motivo de verdade, nada muda', '23514 registro_da_equipe_motivo_check', t.estado || ' ' || t.nome);
  perform pg_temp.registrar('e a recusa desfez a troca (ordem continua groq, google)', '1:groq 2:google',
    (select string_agg(ordem||':'||provider, ' ' order by ordem) from public.rotas_de_ia_da_plataforma() where tarefa = 'chat'));
  t := pg_temp.como(m.dono, 'select * from public.console_registro_da_equipe(10)');
  perform pg_temp.registrar('cliente NAO le o registro da equipe', '42501', t.estado);
  perform pg_temp.registrar('a equipe le o registro', 'true',
    pg_temp.valor(m.equipe, 'select (count(*) >= 1)::text from public.console_registro_da_equipe(10)'));
end $$;

-- ─── 3. Limites: o cliente lê e não altera; conta nova nasce com o padrão ───
do $$
declare m record; t record; w_nova uuid;
begin
  select * into m from mundo;
  perform pg_temp.registrar('conta criada nesta prova ja nasceu com diario e mensal padrao', 'daily:5000000 monthly:60000000',
    (select string_agg(period||':'||limit_micros, ' ' order by period) from public.ai_budgets where workspace_id = m.w1 and brand_id is null));
  perform pg_temp.registrar('o dono LE o proprio limite', '2',
    pg_temp.valor(m.dono, format('select count(*)::text from public.ai_budgets where workspace_id = %L', m.w1)));
  t := pg_temp.como(m.dono, format('update public.ai_budgets set limit_micros = 999000000 where workspace_id = %L', m.w1));
  perform pg_temp.registrar('o dono NAO sobe o proprio limite', '42501', t.estado);
  t := pg_temp.como(m.dono, format('delete from public.ai_budgets where workspace_id = %L', m.w1));
  perform pg_temp.registrar('o dono NAO apaga o proprio limite', '42501', t.estado);
  t := pg_temp.como(m.dono, format('select public.console_definir_limite(%L, ''daily'', 999000000, ''eu mesmo'')', m.w1));
  perform pg_temp.registrar('o dono NAO usa a funcao do console', '42501', t.estado);

  t := pg_temp.como(m.equipe, format('select public.console_definir_limite(%L, ''monthly'', 100, ''prova do teto mensal'')', m.w1));
  perform pg_temp.registrar('a equipe define o mensal da conta', 'ACEITOU 1', t.estado);
  t := pg_temp.como(m.equipe, 'select public.console_definir_limites_padrao(7000000, 80000000, ''piloto com agencias'')');
  perform pg_temp.registrar('a equipe muda o padrao das contas novas', 'ACEITOU 1', t.estado);
  insert into public.workspaces (name, slug) values ('Prova IA Plat Nova', 'prova-ia-plat-nova') returning id into w_nova;
  perform pg_temp.registrar('a conta nova nasce com o padrao novo', 'daily:7000000 monthly:80000000',
    (select string_agg(period||':'||limit_micros, ' ' order by period) from public.ai_budgets where workspace_id = w_nova and brand_id is null));
  perform pg_temp.registrar('e a conta antiga nao mudou de diario', '5000000',
    (select limit_micros::text from public.ai_budgets where workspace_id = m.w1 and brand_id is null and period = 'daily'));
end $$;

-- ─── 4. O teto do mês na reserva, e o painel pelo período ───────────────────
do $$
declare m record; r record;
begin
  select * into m from mundo;
  -- Mensal da conta = 100 micros (acima). Um gasto de 90 NESTE mês, de ontem
  -- ou antes: o diário (5.000.000) não barra, o mensal sim.
  insert into public.ai_ledger (workspace_id, brand_id, execution_id, task, provider, model, status,
                                reserved_micros, settled_micros, settled_at, currency, usage_snapshot, created_at)
  values (m.w1, m.marca_a, gen_random_uuid(), 'assist', 'google', 'g', 'settled', 90, 90, now(), 'USD',
          '{"inputTokens":1,"outputTokens":1}', greatest(date_trunc('month', now()), now() - interval '1 day'));
  select * into r from public.reservar_execucao_de_ia_server(m.dono, m.w1, m.marca_a, gen_random_uuid(), 'assist', 20, 'USD', null);
  perform pg_temp.registrar('a reserva que passaria do teto do MES e recusada', 'false orcamento_mensal_esgotado', r.ok || ' ' || r.motivo);
  select * into r from public.reservar_execucao_de_ia_server(m.dono, m.w1, m.marca_a, gen_random_uuid(), 'assist', 5, 'USD', null);
  perform pg_temp.registrar('a que cabe no mes passa', 'true reservado', r.ok || ' ' || r.motivo);
  perform pg_temp.registrar('o painel soma o gasto do MES na linha mensal (90 + 5 reservado)', '95',
    pg_temp.valor(m.equipe, format('select gasto_hoje_micros::text from public.console_limites() where workspace_id = %L and period = ''monthly''', m.w1)));
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
