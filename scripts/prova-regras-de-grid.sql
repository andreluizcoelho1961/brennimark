-- Prova das regras de grid (o que o Brennimark Grids do assinante aplica) — 14/10/2026.
--
-- O mesmo método da prova das regras do logo (10/10/2026), de onde vêm os
-- utilitários e o mundo: SQLSTATE e NOME da constraint conferidos onde há erro
-- esperado, dados isolados por caso, e `rollback` no fim. Perguntas:
--   1. Isolamento: outra marca da mesma conta e outra conta não alcançam as
--      regras; quem só consulta lê e não escreve; o visitante nem lê.
--   2. Editar × aprovar (ADR-0002): quem edita grava sempre rascunho e nunca
--      aprova; quem aprova sem editar aprova pela função, e só isso.
--   3. Alterar uma regra aprovada a devolve a rascunho; aprovar e alterar no
--      mesmo gesto é recusado; a regra não muda de marca nem de formato.
--   4. A leitura da IA entra só pelo sistema (jsonb) e só onde não há regra;
--      nunca sobrescreve; uma leitura por marca a cada 24 horas; a origem não
--      se forja e regra aprovada não se apaga.
--   5. As constraints: formato malformado, tipo desconhecido, regra geral fora
--      de proporção (e regra de formato em proporção), colunas, linhas,
--      medidas negativas ou acima do teto, linha de base, zonas, duplicata.
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
  u_dona uuid := '88888888-8888-4888-8888-88888887aaaa';
  u_edit uuid := '88888888-8888-4888-8888-88888887bbbb';
  u_le   uuid := '88888888-8888-4888-8888-88888887cccc';
  u_apr  uuid := '88888888-8888-4888-8888-88888887dddd';
  u_fora uuid := '88888888-8888-4888-8888-88888887eeee';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
  todas text[] := array['consultar','editar','aprovar','administrar'];
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-grid-dona@local.test',       'authenticated', 'authenticated'),
    (u_edit, 'prova-grid-editora@local.test',    'authenticated', 'authenticated'),
    (u_le,   'prova-grid-leitora@local.test',    'authenticated', 'authenticated'),
    (u_apr,  'prova-grid-aprovadora@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-grid-fora@local.test',       'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Grid Um', 'prova-grid-um') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Grid Dois', 'prova-grid-dois') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w1, u_dona, 'owner'), (w1, u_edit, 'member'), (w1, u_le, 'member'), (w1, u_apr, 'member'),
    (w2, u_fora, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'grid-a', 'Marca A', 'A', 'Primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'grid-b', 'Marca B', 'B', 'Segunda', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w2, 'grid-c', 'Marca C', 'C', 'Terceira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;

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
create function pg_temp.regra(p_conta uuid, p_marca uuid, p_formato text, p_tipo text, p_unidade text, p_extra text default '')
returns text language sql as $f$
  select format(
    'insert into public.regras_de_grid (workspace_id, brand_id, formato, tipo, unidade%s) values (%L, %L, %L, %L, %L%s)',
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 1) end,
    p_conta, p_marca, p_formato, p_tipo, p_unidade,
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 2) end);
$f$;

do $$
declare
  m record; t record; id_a uuid; id_c uuid; id_ia uuid; e_estado text; e_nome text;
begin
  select * into m from mundo;

  -- ─── 1. Isolamento ───────────────────────────────────────────────────────
  insert into public.regras_de_grid (workspace_id, brand_id, formato, tipo, unidade, colunas, pagina)
  values (m.w1, m.marca_a, 'a4', 'colunas', 'mm', 12, 30) returning id into id_a;
  insert into public.regras_de_grid (workspace_id, brand_id, formato, tipo, unidade, colunas)
  values (m.w2, m.marca_c, 'a4', 'modular', 'mm', 6) returning id into id_c;
  if id_a is null or id_c is null then raise exception 'PREPARAÇÃO FALHOU'; end if;

  perform pg_temp.registrar('quem consulta A le a regra de A', '1',
    pg_temp.contar(m.leitora, format('select count(*)::int from public.regras_de_grid where brand_id = %L', m.marca_a))::text);
  perform pg_temp.registrar('a dona de outra conta NAO le a regra de A', '0',
    pg_temp.contar(m.estranha, format('select count(*)::int from public.regras_de_grid where brand_id = %L', m.marca_a))::text);
  perform pg_temp.registrar('quem le A NAO ve a regra da marca C (outra conta)', '0',
    pg_temp.contar(m.leitora, format('select count(*)::int from public.regras_de_grid where brand_id = %L', m.marca_c))::text);
  perform pg_temp.registrar('o visitante NAO le', '42501',
    pg_temp.tentar_anonimo('select * from public.regras_de_grid'));
  select * into t from pg_temp.tentar(m.leitora, pg_temp.regra(m.w1, m.marca_a, 'post-4x5', 'modular', 'px'));
  perform pg_temp.registrar('quem so consulta NAO cria regra', '42501', t.estado);
  select * into t from pg_temp.tentar(m.editora, pg_temp.regra(m.w1, m.marca_b, 'post-4x5', 'modular', 'px'));
  perform pg_temp.registrar('quem edita A NAO cria regra na marca B (mesma conta)', '42501', t.estado);
  select * into t from pg_temp.tentar(m.estranha, format('update public.regras_de_grid set colunas = 3 where id = %L', id_a));
  perform pg_temp.registrar('a dona de outra conta NAO altera a regra de A', 'ACEITOU-SEM-LINHA', t.estado);

  -- ─── 2. Editar × aprovar ─────────────────────────────────────────────────
  select * into t from pg_temp.tentar(m.editora, pg_temp.regra(m.w1, m.marca_a, 'post-4x5', 'modular', 'px', 'colunas=6'));
  perform pg_temp.registrar('quem edita cria regra', 'ACEITOU', t.estado);
  perform pg_temp.registrar('a regra criada por pessoa e rascunho de origem pessoa', 'draft pessoa',
    (select status || ' ' || origem from public.regras_de_grid where brand_id = m.marca_a and formato = 'post-4x5'));
  select * into t from pg_temp.tentar(m.editora, pg_temp.regra(m.w1, m.marca_a, 'stories', 'colunas', 'px', 'status=''ready'''));
  perform pg_temp.registrar('a regra NAO nasce aprovada', '23514 regras_de_grid_nasce_rascunho', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_de_grid set status = ''ready'' where id = %L', id_a));
  perform pg_temp.registrar('quem edita NAO aprova pela escrita', '42501 regras_de_grid_aprovar_exige_capacidade', t.estado || ' ' || t.nome);
  perform pg_temp.registrar('quem so consulta NAO aprova pela funcao', '0',
    pg_temp.contar(m.leitora, format('select public.aprovar_regras_de_grid(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('quem aprova outra conta NAO aprova a regra de A', '0',
    pg_temp.contar(m.estranha, format('select public.aprovar_regras_de_grid(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('quem aprova (sem editar) aprova pela funcao', '1',
    pg_temp.contar(m.aprovadora, format('select public.aprovar_regras_de_grid(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('a aprovacao guarda quem aprovou', 'ready true',
    (select status || ' ' || (aprovado_por = m.aprovadora)::text from public.regras_de_grid where id = id_a));

  -- ─── 3. A aprovação vale para o que foi aprovado ─────────────────────────
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_de_grid set aprovado_por = %L where id = %L', m.editora, id_a));
  perform pg_temp.registrar('ninguem forja quem aprovou', 'true',
    ((select aprovado_por from public.regras_de_grid where id = id_a) = m.aprovadora)::text);
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_de_grid set zonas = ''{1,2}'' where id = %L', id_a));
  perform pg_temp.registrar('alterar a regra aprovada (ate so as zonas) a devolve a rascunho', 'draft',
    (select status from public.regras_de_grid where id = id_a));
  select * into t from pg_temp.tentar(m.dona, format('update public.regras_de_grid set status = ''ready'', colunas = 6 where id = %L', id_a));
  perform pg_temp.registrar('aprovar e alterar no mesmo gesto e recusado', '23514 regras_de_grid_aprova_sem_alterar', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('update public.regras_de_grid set brand_id = %L where id = %L', m.marca_b, id_a));
  perform pg_temp.registrar('a regra NAO muda de marca', '23514 regras_de_grid_fixa', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('update public.regras_de_grid set formato = ''a3'' where id = %L', id_a));
  perform pg_temp.registrar('a regra NAO muda de formato', '23514 regras_de_grid_fixa', t.estado || ' ' || t.nome);

  -- ─── 4. A leitura da IA ──────────────────────────────────────────────────
  perform pg_temp.registrar('a sessao NAO grava como IA', '42501',
    (select estado from pg_temp.tentar(m.dona, format(
      'select public.registrar_leitura_das_regras_de_grid(%L, %L, ''{"formato":"todos","tipo":"modular","unidade":"proporcao"}'')', m.w1, m.marca_a))));
  perform pg_temp.registrar('o sistema grava a regra geral lida pela IA', 'true',
    public.registrar_leitura_das_regras_de_grid(m.w1, m.marca_a,
      '{"formato":"todos","tipo":"hierarquico","unidade":"proporcao","colunas":12,"medianiz":0.02,"margem_sup":0.08,"margem_inf":0.1,"margem_esq":0.08,"margem_dir":0.08,"zonas":[1,3,1.2],"descricao":"grid de 12 colunas","pagina":31}'::jsonb)::text);
  perform pg_temp.registrar('a leitura da IA entra como rascunho de origem ia, com zonas e pagina', 'draft ia 31 {1,3,1.2}',
    (select status || ' ' || origem || ' ' || pagina || ' ' || zonas::text from public.regras_de_grid where brand_id = m.marca_a and formato = 'todos'));
  perform pg_temp.registrar('a IA NAO sobrescreve o que a pessoa respondeu', 'false 6',
    public.registrar_leitura_das_regras_de_grid(m.w1, m.marca_a, '{"formato":"post-4x5","tipo":"colunas","unidade":"px","colunas":3}'::jsonb)::text || ' '
    || (select colunas::text from public.regras_de_grid where brand_id = m.marca_a and formato = 'post-4x5'));
  begin
    perform public.registrar_leitura_das_regras_de_grid(m.w1, m.marca_a, '{"formato":"a5","tipo":"colunas","unidade":"mm","colunas":99}'::jsonb);
    e_estado := 'ACEITOU'; e_nome := '';
  exception when others then
    get stacked diagnostics e_estado = returned_sqlstate, e_nome = constraint_name;
  end;
  perform pg_temp.registrar('a leitura da IA fora da faixa e recusada pela constraint', '23514 regras_de_grid_colunas_check', e_estado || ' ' || e_nome);
  select id into id_ia from public.regras_de_grid where brand_id = m.marca_a and formato = 'todos';
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_de_grid set colunas = 6 where id = %L', id_ia));
  perform pg_temp.registrar('quem corrige a leitura da IA passa a responder por ela', 'pessoa',
    (select origem from public.regras_de_grid where id = id_ia));

  -- ─── 4b. Origem, apagar, teto da leitura ─────────────────────────────────
  select * into t from pg_temp.tentar(m.editora, format('update public.regras_de_grid set origem = ''ia'' where id = %L', id_ia));
  perform pg_temp.registrar('sem mudar o grid, ninguem troca a origem (nem forja "lida pela IA")', 'pessoa',
    (select origem from public.regras_de_grid where id = id_ia));
  perform pg_temp.contar(m.aprovadora, format('select public.aprovar_regras_de_grid(array[%L]::uuid[])', id_ia));
  select * into t from pg_temp.tentar(m.editora, format('delete from public.regras_de_grid where id = %L', id_ia));
  perform pg_temp.registrar('regra aprovada NAO se apaga', 'ACEITOU-SEM-LINHA 1',
    t.estado || ' ' || (select count(*)::text from public.regras_de_grid where id = id_ia));
  select * into t from pg_temp.tentar(m.editora, format('delete from public.regras_de_grid where brand_id = %L and formato = ''post-4x5''', m.marca_a));
  perform pg_temp.registrar('regra em rascunho se apaga', 'ACEITOU', t.estado);
  perform pg_temp.registrar('a primeira leitura do dia e reservada', 'true',
    public.reservar_leitura_das_regras_de_grid(m.w1, m.marca_a)::text);
  perform pg_temp.registrar('a segunda leitura no mesmo dia NAO e reservada', 'false',
    public.reservar_leitura_das_regras_de_grid(m.w1, m.marca_a)::text);
  update public.leituras_das_regras_de_grid set tentada_em = now() - interval '25 hours' where brand_id = m.marca_a;
  perform pg_temp.registrar('passadas 24 horas, a leitura volta a ser reservada', 'true',
    public.reservar_leitura_das_regras_de_grid(m.w1, m.marca_a)::text);
  perform pg_temp.registrar('a sessao NAO reserva leitura', '42501',
    (select estado from pg_temp.tentar(m.dona, format('select public.reservar_leitura_das_regras_de_grid(%L, %L)', m.w1, m.marca_a))));
  perform pg_temp.registrar('a sessao NAO le as tentativas', '42501',
    (select estado from pg_temp.tentar(m.dona, 'select * from public.leituras_das_regras_de_grid')));

  -- ─── 5. Constraints, pelo nome (cada caso na marca B, com formato próprio) ─
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'A4 grande', 'colunas', 'mm'));
  perform pg_temp.registrar('formato malformado e recusado', '23514 regras_de_grid_formato_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b1', 'radial', 'mm'));
  perform pg_temp.registrar('tipo de grid desconhecido e recusado', '23514 regras_de_grid_tipo_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'todos', 'colunas', 'mm'));
  perform pg_temp.registrar('regra geral fora de proporcao e recusada', '23514 regras_de_grid_unidade_da_geral', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b2', 'colunas', 'proporcao'));
  perform pg_temp.registrar('regra de formato em proporcao e recusada', '23514 regras_de_grid_unidade_da_geral', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b3', 'colunas', 'mm', 'colunas=25'));
  perform pg_temp.registrar('mais de 24 colunas e recusado', '23514 regras_de_grid_colunas_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b4', 'modular', 'mm', 'linhas=0'));
  perform pg_temp.registrar('zero linhas e recusado', '23514 regras_de_grid_linhas_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b5', 'colunas', 'mm', 'medianiz=-1'));
  perform pg_temp.registrar('medida negativa e recusada', '23514 regras_de_grid_medidas_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'todos', 'colunas', 'proporcao', 'margem_sup=0.8'));
  perform pg_temp.registrar('margem proporcional acima da metade e recusada', '23514 regras_de_grid_medidas_teto', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b6', 'colunas', 'mm', 'margem_esq=2000'));
  perform pg_temp.registrar('margem de 2 m e recusada', '23514 regras_de_grid_medidas_teto', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b7', 'colunas', 'mm', 'linha_de_base=0'));
  perform pg_temp.registrar('linha de base zero e recusada', '23514 regras_de_grid_linha_de_base_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b8', 'hierarquico', 'px', 'zonas=''{1}'''));
  perform pg_temp.registrar('uma zona so e recusada', '23514 regras_de_grid_zonas_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b9', 'hierarquico', 'px', 'zonas=''{1,-2}'''));
  perform pg_temp.registrar('zona negativa e recusada', '23514 regras_de_grid_zonas_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_a, 'a4', 'colunas', 'mm'));
  perform pg_temp.registrar('duas regras do mesmo formato, segmento e variante na mesma marca sao recusadas', '23505 regras_de_grid_uma_por_variante', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b10', 'colunas', 'mm', 'pagina=0'));
  perform pg_temp.registrar('pagina zero e recusada', '23514 regras_de_grid_pagina_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.regra(m.w1, m.marca_b, 'b11', 'colunas', 'mm', 'colunas=12'));
  perform pg_temp.registrar('a regra valida da marca B entra (os casos alcancam a constraint, nao a policy)', 'ACEITOU', t.estado);


  -- ─── 6. Vários grids por marca: variante e segmento (16/10/2026) ─────────
  -- Cada caso na marca B, com formato próprio, para alcançar a constraint.
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, variante, tipo, unidade) values (%L, %L, ''c1'', ''Estrutura 3X3'', ''modular'', ''mm'')', m.w1, m.marca_b));
  perform pg_temp.registrar('a primeira variante de um formato entra', 'ACEITOU', t.estado);
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, variante, tipo, unidade) values (%L, %L, ''c1'', ''Estrutura 5X5'', ''modular'', ''mm'')', m.w1, m.marca_b));
  perform pg_temp.registrar('outra variante do MESMO formato entra', 'ACEITOU', t.estado);
  perform pg_temp.registrar('as duas variantes convivem', '2',
    (select count(*)::text from public.regras_de_grid where brand_id = m.marca_b and formato = 'c1'));
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, variante, tipo, unidade) values (%L, %L, ''c1'', ''Estrutura 3X3'', ''modular'', ''mm'')', m.w1, m.marca_b));
  perform pg_temp.registrar('a mesma variante duas vezes e recusada', '23505 regras_de_grid_uma_por_variante', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, variante, segmento, tipo, unidade) values (%L, %L, ''c1'', ''Estrutura 3X3'', ''Wealth'', ''modular'', ''mm'')', m.w1, m.marca_b));
  perform pg_temp.registrar('a mesma variante em OUTRO segmento entra', 'ACEITOU', t.estado);
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, variante, segmento, tipo, unidade) values (%L, %L, ''c1'', ''Estrutura 3X3'', ''Wealth'', ''modular'', ''mm'')', m.w1, m.marca_b));
  perform pg_temp.registrar('variante e segmento repetidos sao recusados', '23505 regras_de_grid_uma_por_variante', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, variante, tipo, unidade) values (%L, %L, ''c2'', ''  Estrutura  '', ''modular'', ''mm'')', m.w1, m.marca_b));
  perform pg_temp.registrar('variante com espaco nas pontas e recusada', '23514 regras_de_grid_variante_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, variante, tipo, unidade) values (%L, %L, ''c2'', %L, ''modular'', ''mm'')', m.w1, m.marca_b, repeat('x', 61)));
  perform pg_temp.registrar('variante com mais de 60 caracteres e recusada', '23514 regras_de_grid_variante_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, segmento, tipo, unidade) values (%L, %L, ''c2'', '' Wealth'', ''modular'', ''mm'')', m.w1, m.marca_b));
  perform pg_temp.registrar('segmento com espaco nas pontas e recusado', '23514 regras_de_grid_segmento_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('insert into public.regras_de_grid (workspace_id, brand_id, formato, segmento, tipo, unidade) values (%L, %L, ''c2'', %L, ''modular'', ''mm'')', m.w1, m.marca_b, repeat('x', 61)));
  perform pg_temp.registrar('segmento com mais de 60 caracteres e recusado', '23514 regras_de_grid_segmento_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('update public.regras_de_grid set variante = ''Outra'' where brand_id = %L and formato = ''c1'' and variante = ''Estrutura 5X5''', m.marca_b));
  perform pg_temp.registrar('a regra NAO muda de variante', '23514 regras_de_grid_fixa', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('update public.regras_de_grid set segmento = ''Atacado'' where brand_id = %L and formato = ''c1'' and variante = ''Estrutura 5X5''', m.marca_b));
  perform pg_temp.registrar('a regra NAO muda de segmento', '23514 regras_de_grid_fixa', t.estado || ' ' || t.nome);
  perform pg_temp.registrar('a IA grava uma variante nova do mesmo formato', 'true',
    public.registrar_leitura_das_regras_de_grid(m.w1, m.marca_b, '{"formato":"c1","variante":"Estrutura 7X7","segmento":" Institucional ","tipo":"modular","unidade":"mm","colunas":7,"linhas":7,"pagina":30}'::jsonb)::text);
  perform pg_temp.registrar('a variante e o segmento da IA entram aparados, como rascunho de origem ia', 'Estrutura 7X7|Institucional|draft|ia',
    (select variante || '|' || segmento || '|' || status || '|' || origem from public.regras_de_grid where brand_id = m.marca_b and formato = 'c1' and variante = 'Estrutura 7X7'));
  perform pg_temp.registrar('a IA NAO sobrescreve a mesma variante', 'false',
    public.registrar_leitura_das_regras_de_grid(m.w1, m.marca_b, '{"formato":"c1","variante":"Estrutura 3X3","tipo":"modular","unidade":"mm","colunas":9}'::jsonb)::text);
  perform pg_temp.registrar('a regra de antes (sem variante) continua com a identidade vazia', '|',
    (select variante || '|' || segmento from public.regras_de_grid where brand_id = m.marca_a and formato = 'a4'));

  -- A marca sair leva as regras.
  delete from public.brands where id = m.marca_c;
  perform pg_temp.registrar('a marca sair leva as regras dela', '0',
    (select count(*)::text from public.regras_de_grid where brand_id = m.marca_c));
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
