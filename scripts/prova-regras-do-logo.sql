-- Prova das regras do logo (o que o Brennimark Kit aplica) — 10/10/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e NOME da constraint
-- conferidos onde há erro esperado, e `rollback` no fim. Perguntas:
--   1. Isolamento: outra marca da mesma conta e outra conta não alcançam as
--      regras; quem só consulta lê e não escreve; o visitante nem lê.
--   2. Editar × aprovar (ADR-0002): quem edita grava sempre rascunho e nunca
--      aprova; quem aprova sem editar aprova pela função, e só isso.
--   3. Alterar uma regra aprovada a devolve a rascunho; ninguém forja quem
--      aprovou; aprovar e alterar no mesmo gesto é recusado.
--   4. A leitura da IA entra só pelo sistema e só onde não há regra — nunca
--      sobrescreve o que uma pessoa respondeu; uma leitura por marca a cada
--      24 horas; a origem não se forja e regra aprovada não se apaga.
--   5. As constraints barram valor fora da faixa, tipo desconhecido e duas
--      regras do mesmo tipo na mesma marca.
\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (
  ordem serial, caso text, esperado text, obtido text, passou boolean
);

create temp table mundo (
  dona uuid, editora uuid, leitora uuid, aprovadora uuid, estranha uuid,
  w1 uuid, w2 uuid, marca_a uuid, marca_b uuid, marca_c uuid
);

-- Executa um comando COMO uma pessoa (ver `prova-item-e-variante.sql`: a
-- subtransação devolve papel e sessão numa recusa).
create function pg_temp.tentar(p_quem uuid, p_sql text,
                               out estado text, out nome text, out linhas integer)
language plpgsql as $f$
begin
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics linhas = row_count;
    -- Aceitar sem gravar nada não é aceitar: o caso não chegou à regra.
    estado := case when linhas > 0 then 'ACEITOU' else 'ACEITOU-SEM-LINHA' end; nome := '';
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
    linhas := 0;
  end;
end $f$;

create function pg_temp.contar(p_quem uuid, p_sql text) returns integer
language plpgsql as $f$
declare n integer;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into n;
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  return n;
end $f$;

-- O mesmo, como visitante sem sessão (`anon`).
create function pg_temp.tentar_anonimo(p_sql text) returns text
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

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, p_obtido, p_esperado = p_obtido);
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_dona uuid := '77777777-7777-4777-8777-77777777aaaa';
  u_edit uuid := '77777777-7777-4777-8777-77777777bbbb';
  u_le   uuid := '77777777-7777-4777-8777-77777777cccc';
  u_apr  uuid := '77777777-7777-4777-8777-77777777dddd';
  u_fora uuid := '77777777-7777-4777-8777-77777777eeee';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
  todas text[] := array['consultar','editar','aprovar','administrar'];
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-regras-dona@local.test',       'authenticated', 'authenticated'),
    (u_edit, 'prova-regras-editora@local.test',    'authenticated', 'authenticated'),
    (u_le,   'prova-regras-leitora@local.test',    'authenticated', 'authenticated'),
    (u_apr,  'prova-regras-aprovadora@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-regras-fora@local.test',       'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Regras Um', 'prova-regras-um') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Regras Dois', 'prova-regras-dois') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w1, u_dona, 'owner'), (w1, u_edit, 'member'), (w1, u_le, 'member'), (w1, u_apr, 'member'),
    (w2, u_fora, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'regras-a', 'Marca A', 'A', 'Primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'regras-b', 'Marca B', 'B', 'Segunda', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w2, 'regras-c', 'Marca C', 'C', 'Terceira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;

  -- A aprovadora é o dono da marca do lado do cliente: consulta e aprova,
  -- não edita. A editora é a agência: consulta e edita, não aprova.
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (a, w1, u_dona, todas), (b, w1, u_dona, todas),
    (a, w1, u_edit, array['consultar','editar']),
    (a, w1, u_le,   array['consultar']),
    (a, w1, u_apr,  array['consultar','aprovar']),
    (c, w2, u_fora, todas)
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;
  -- A semeadura por conta dá `consultar` a todo membro em toda marca; a marca B
  -- fica só com a dona, para o caso "mesma conta, outra marca" valer.
  delete from public.brand_members where brand_id = b and user_id <> u_dona;

  insert into mundo values (u_dona, u_edit, u_le, u_apr, u_fora, w1, w2, a, b, c);
end $$;

-- Uma regra como comando de inserção (VALUES, nunca select: quem não enxerga a
-- marca faria o select voltar vazio, e a recusa pareceria aceitação sem linha).
create function pg_temp.regra(p_conta uuid, p_marca uuid, p_chave text, p_valor numeric, p_extra text default '')
returns text language sql as $f$
  select format(
    'insert into public.regras_do_logo (workspace_id, brand_id, chave, valor%s) values (%L, %L, %L, %s%s)',
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 1) end,
    p_conta, p_marca, p_chave, p_valor,
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 2) end);
$f$;

do $$
declare
  m record; t record; id_a uuid; id_c uuid; id_ia uuid; n integer;
begin
  select * into m from mundo;

  -- ─── 1. Isolamento ───────────────────────────────────────────────────────
  insert into public.regras_do_logo (workspace_id, brand_id, chave, valor, pagina)
  values (m.w1, m.marca_a, 'area_de_protecao', 0.25, 12) returning id into id_a;
  insert into public.regras_do_logo (workspace_id, brand_id, chave, valor)
  values (m.w2, m.marca_c, 'area_de_protecao', 0.5) returning id into id_c;
  if id_a is null or id_c is null then raise exception 'PREPARAÇÃO FALHOU'; end if;

  perform pg_temp.registrar('quem consulta A le a regra de A', '1',
    pg_temp.contar(m.leitora, format('select count(*)::int from public.regras_do_logo where brand_id = %L', m.marca_a))::text);
  perform pg_temp.registrar('a dona de outra conta NAO le a regra de A', '0',
    pg_temp.contar(m.estranha, format('select count(*)::int from public.regras_do_logo where brand_id = %L', m.marca_a))::text);
  perform pg_temp.registrar('quem le A NAO ve a regra da marca C (outra conta)', '0',
    pg_temp.contar(m.leitora, format('select count(*)::int from public.regras_do_logo where brand_id = %L', m.marca_c))::text);
  perform pg_temp.registrar('o visitante NAO le', '42501',
    pg_temp.tentar_anonimo('select * from public.regras_do_logo'));
  select * into t from pg_temp.tentar(m.leitora, pg_temp.regra(m.w1, m.marca_a, 'reducao_minima_logo', 120));
  perform pg_temp.registrar('quem so consulta NAO cria regra', '42501', t.estado);
  select * into t from pg_temp.tentar(m.editora, pg_temp.regra(m.w1, m.marca_b, 'reducao_minima_logo', 120));
  perform pg_temp.registrar('quem edita A NAO cria regra na marca B (mesma conta)', '42501', t.estado);
  select * into t from pg_temp.tentar(m.estranha, format('update public.regras_do_logo set valor = 0.9 where id = %L', id_a));
  perform pg_temp.registrar('a dona de outra conta NAO altera a regra de A', 'ACEITOU-SEM-LINHA', t.estado);

  -- ─── 2. Editar × aprovar ─────────────────────────────────────────────────
  select * into t from pg_temp.tentar(m.editora, pg_temp.regra(m.w1, m.marca_a, 'reducao_minima_logo', 120, 'pagina=14'));
  perform pg_temp.registrar('quem edita cria regra', 'ACEITOU', t.estado);
  perform pg_temp.registrar('a regra criada por pessoa e rascunho de origem pessoa', 'draft pessoa',
    (select status || ' ' || origem from public.regras_do_logo where brand_id = m.marca_a and chave = 'reducao_minima_logo'));
  select * into t from pg_temp.tentar(m.editora, pg_temp.regra(m.w1, m.marca_a, 'reducao_minima_simbolo', 24, 'status=''ready'''));
  perform pg_temp.registrar('a regra NAO nasce aprovada', '23514 regras_do_logo_nasce_rascunho', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_do_logo set status = ''ready'' where id = %L', id_a));
  perform pg_temp.registrar('quem edita NAO aprova pela escrita', '42501 regras_do_logo_aprovar_exige_capacidade', t.estado || ' ' || t.nome);
  perform pg_temp.registrar('quem so consulta NAO aprova pela funcao', '0',
    pg_temp.contar(m.leitora, format('select public.aprovar_regras_do_logo(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('quem aprova outra conta NAO aprova a regra de A', '0',
    pg_temp.contar(m.estranha, format('select public.aprovar_regras_do_logo(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('quem aprova (sem editar) aprova pela funcao', '1',
    pg_temp.contar(m.aprovadora, format('select public.aprovar_regras_do_logo(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('a aprovacao guarda quem aprovou', 'ready true',
    (select status || ' ' || (aprovado_por = m.aprovadora)::text from public.regras_do_logo where id = id_a));

  -- ─── 3. A aprovação vale para o que foi aprovado ─────────────────────────
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_do_logo set aprovado_por = %L where id = %L', m.editora, id_a));
  perform pg_temp.registrar('ninguem forja quem aprovou', 'true',
    ((select aprovado_por from public.regras_do_logo where id = id_a) = m.aprovadora)::text);
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_do_logo set valor = 0.3 where id = %L', id_a));
  perform pg_temp.registrar('alterar a regra aprovada a devolve a rascunho', 'draft',
    (select status from public.regras_do_logo where id = id_a));
  select * into t from pg_temp.tentar(m.dona, format('update public.regras_do_logo set status = ''ready'', valor = 0.4 where id = %L', id_a));
  perform pg_temp.registrar('aprovar e alterar no mesmo gesto e recusado', '23514 regras_do_logo_aprova_sem_alterar', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('update public.regras_do_logo set brand_id = %L where id = %L', m.marca_b, id_a));
  perform pg_temp.registrar('a regra NAO muda de marca', '23514 regras_do_logo_fixa', t.estado || ' ' || t.nome);

  -- ─── 4. A leitura da IA ──────────────────────────────────────────────────
  perform pg_temp.registrar('a sessao NAO grava como IA', '42501',
    (select estado from pg_temp.tentar(m.dona, format(
      'select public.registrar_leitura_das_regras_do_logo(%L, %L, ''reducao_minima_simbolo'', 24, ''x'', 3)', m.w1, m.marca_a))));
  perform pg_temp.registrar('o sistema grava a leitura da IA onde nao ha regra', 'true',
    public.registrar_leitura_das_regras_do_logo(m.w1, m.marca_a, 'reducao_minima_simbolo', 24, 'símbolo: 24 px', 11)::text);
  perform pg_temp.registrar('a leitura da IA entra como rascunho de origem ia', 'draft ia 11',
    (select status || ' ' || origem || ' ' || pagina from public.regras_do_logo where brand_id = m.marca_a and chave = 'reducao_minima_simbolo'));
  perform pg_temp.registrar('a IA NAO sobrescreve o que a pessoa respondeu', 'false 120',
    public.registrar_leitura_das_regras_do_logo(m.w1, m.marca_a, 'reducao_minima_logo', 999, 'x', 1)::text || ' '
    || (select valor::int from public.regras_do_logo where brand_id = m.marca_a and chave = 'reducao_minima_logo'));
  select id into id_ia from public.regras_do_logo where brand_id = m.marca_a and chave = 'reducao_minima_simbolo';
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_do_logo set valor = 32 where id = %L', id_ia));
  perform pg_temp.registrar('quem corrige a leitura da IA passa a responder por ela', 'pessoa',
    (select origem from public.regras_do_logo where id = id_ia));

  -- ─── 4b. Revisão de segurança: origem, apagar, teto da leitura ───────────
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_do_logo set origem = ''ia'' where id = %L', id_ia));
  perform pg_temp.registrar('sem mudar o valor, ninguem troca a origem (nem forja "lido pela IA")', 'pessoa',
    (select origem from public.regras_do_logo where id = id_ia));
  perform pg_temp.contar(m.aprovadora, format('select public.aprovar_regras_do_logo(array[%L]::uuid[])', id_ia));
  select * into t from pg_temp.tentar(m.editora, format('delete from public.regras_do_logo where id = %L', id_ia));
  perform pg_temp.registrar('regra aprovada NAO se apaga', 'ACEITOU-SEM-LINHA 1',
    t.estado || ' ' || (select count(*)::text from public.regras_do_logo where id = id_ia));
  select * into t from pg_temp.tentar(m.editora, format('delete from public.regras_do_logo where brand_id = %L and chave = ''reducao_minima_logo''', m.marca_a));
  perform pg_temp.registrar('regra em rascunho se apaga', 'ACEITOU', t.estado);
  perform pg_temp.registrar('a primeira leitura do dia e reservada', 'true',
    public.reservar_leitura_das_regras_do_logo(m.w1, m.marca_a)::text);
  perform pg_temp.registrar('a segunda leitura no mesmo dia NAO e reservada', 'false',
    public.reservar_leitura_das_regras_do_logo(m.w1, m.marca_a)::text);
  update public.leituras_das_regras_do_logo set tentada_em = now() - interval '25 hours' where brand_id = m.marca_a;
  perform pg_temp.registrar('passadas 24 horas, a leitura volta a ser reservada', 'true',
    public.reservar_leitura_das_regras_do_logo(m.w1, m.marca_a)::text);
  perform pg_temp.registrar('a sessao NAO reserva leitura', '42501',
    (select estado from pg_temp.tentar(m.dona, format('select public.reservar_leitura_das_regras_do_logo(%L, %L)', m.w1, m.marca_a))));
  perform pg_temp.registrar('a sessao NAO le as tentativas', '42501',
    (select estado from pg_temp.tentar(m.dona, 'select * from public.leituras_das_regras_do_logo')));

  -- ─── 5. Constraints, pelo nome ───────────────────────────────────────────
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'area_de_protecao', 3));
  perform pg_temp.registrar('area de protecao acima de 2 e recusada', '23514 regras_do_logo_valor_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'reducao_minima_logo', 2));
  perform pg_temp.registrar('reducao minima abaixo de 4 px e recusada', '23514 regras_do_logo_valor_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'cor_do_fundo', 1));
  perform pg_temp.registrar('tipo de regra desconhecido e recusado', '23514 regras_do_logo_chave_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_a, 'area_de_protecao', 0.5));
  perform pg_temp.registrar('duas regras do mesmo tipo na mesma marca sao recusadas', '23505 regras_do_logo_uma_por_marca', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'area_de_protecao', 0.2, 'pagina=0'));
  perform pg_temp.registrar('pagina zero e recusada', '23514 regras_do_logo_pagina_check', t.estado || ' ' || t.nome);

  -- A marca sair leva as regras.
  delete from public.brands where id = m.marca_c;
  perform pg_temp.registrar('a marca sair leva as regras dela', '0',
    (select count(*)::text from public.regras_do_logo where brand_id = m.marca_c));
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
