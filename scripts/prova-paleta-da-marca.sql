-- Prova da ficha da paleta da marca — 27/09/2026.
--
-- Mesmo método das outras provas do projeto: mundo próprio, SQLSTATE e NOME da
-- constraint conferidos onde há erro esperado, dado isolado por caso, e
-- `rollback` no fim. Caso cuja preparação falha reprova — ele não passa em
-- silêncio.
--
-- Três perguntas:
--   1. Isolamento: nem outra marca da mesma conta, nem outra conta, alcançam a
--      ficha; quem só consulta lê e não escreve.
--   2. Editar × aprovar (ADR-0002): quem edita cria e altera, sempre como
--      rascunho, e NUNCA aprova; quem aprova sem editar aprova pela função, e
--      só isso.
--   3. A aprovação vale para o que foi aprovado: alterar a cor a devolve a
--      rascunho, e ninguém forja quem aprovou.

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

-- Uma cor como comando de inserção. VALUES, nunca `insert ... select`: quem
-- não enxerga a marca faria o select voltar vazio, e a recusa pareceria
-- aceitação sem linha.
create function pg_temp.cor(p_conta uuid, p_marca uuid, p_nome text, p_extra text default '')
returns text language sql as $f$
  select format(
    'insert into public.paleta_da_marca (workspace_id, brand_id, nome, papel, hex%s) values (%L, %L, %L, ''apoio'', ''#CC092F''%s)',
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 1) end,
    p_conta, p_marca, p_nome,
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 2) end);
$f$;

-- Uma cor de cenário, gravada como superusuário; devolve o id.
create function pg_temp.semear(p_nome text, p_marca uuid default null) returns uuid
language plpgsql as $f$
declare m record; id_novo uuid; alvo uuid;
begin
  select * into m from mundo;
  alvo := coalesce(p_marca, m.marca_a);
  insert into public.paleta_da_marca (workspace_id, brand_id, nome, papel, hex)
  values (case when alvo = m.marca_c then m.w2 else m.w1 end, alvo, p_nome, 'principal', '#CC092F')
  returning id into id_novo;
  if id_novo is null then raise exception 'PREPARAÇÃO FALHOU: %', p_nome; end if;
  return id_novo;
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_dona uuid := '88888888-8888-4888-8888-88888888aaaa';
  u_edit uuid := '88888888-8888-4888-8888-88888888bbbb';
  u_le   uuid := '88888888-8888-4888-8888-88888888cccc';
  u_apr  uuid := '88888888-8888-4888-8888-88888888dddd';
  u_fora uuid := '88888888-8888-4888-8888-88888888eeee';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
  todas text[] := array['consultar','editar','aprovar','administrar'];
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-paleta-dona@local.test',       'authenticated', 'authenticated'),
    (u_edit, 'prova-paleta-editora@local.test',    'authenticated', 'authenticated'),
    (u_le,   'prova-paleta-leitora@local.test',    'authenticated', 'authenticated'),
    (u_apr,  'prova-paleta-aprovadora@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-paleta-fora@local.test',       'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Paleta Um', 'prova-paleta-um') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Paleta Dois', 'prova-paleta-dois') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w1, u_dona, 'owner'), (w1, u_edit, 'member'), (w1, u_le, 'member'), (w1, u_apr, 'member'),
    (w2, u_fora, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'paleta-a', 'Marca A', 'A', 'Primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'paleta-b', 'Marca B', 'B', 'Segunda', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w2, 'paleta-c', 'Marca C', 'C', 'Terceira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;

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

-- ─── 1. Isolamento ──────────────────────────────────────────────────────────
do $$
declare m record; t record; n integer;
begin
  select * into m from mundo;
  perform pg_temp.semear('Vermelho A1');
  perform pg_temp.semear('Vermelho A2');
  perform pg_temp.semear('Azul B', m.marca_b);
  perform pg_temp.semear('Verde C', m.marca_c);

  n := pg_temp.contar(m.leitora, format('select count(*) from public.paleta_da_marca where brand_id = %L', m.marca_a));
  perform pg_temp.registrar('quem consulta A LE a paleta de A', '2', n::text);

  n := pg_temp.contar(m.leitora, format('select count(*) from public.paleta_da_marca where brand_id = %L', m.marca_b));
  perform pg_temp.registrar('quem consulta A NAO le a paleta de B, mesma conta', '0', n::text);

  n := pg_temp.contar(m.estranha, format('select count(*) from public.paleta_da_marca where brand_id in (%L, %L)', m.marca_a, m.marca_b));
  perform pg_temp.registrar('outra conta NAO le a paleta desta conta', '0', n::text);

  n := pg_temp.contar(m.dona, format('select count(*) from public.paleta_da_marca where brand_id = %L', m.marca_c));
  perform pg_temp.registrar('e esta conta NAO le a paleta da outra', '0', n::text);

  t := pg_temp.tentar(m.leitora, pg_temp.cor(m.w1, m.marca_a, 'x'));
  perform pg_temp.registrar('quem so consulta NAO cria cor', '42501', t.estado);

  t := pg_temp.tentar(m.leitora, format('update public.paleta_da_marca set nome = ''x'' where brand_id = %L', m.marca_a));
  perform pg_temp.registrar('quem so consulta NAO altera cor', 'ACEITOU-SEM-LINHA', t.estado);

  t := pg_temp.tentar(m.leitora, format('delete from public.paleta_da_marca where brand_id = %L', m.marca_a));
  perform pg_temp.registrar('quem so consulta NAO remove cor', 'ACEITOU-SEM-LINHA', t.estado);

  t := pg_temp.tentar(m.editora, pg_temp.cor(m.w1, m.marca_b, 'x'));
  perform pg_temp.registrar('quem edita A NAO cria cor em B, mesma conta', '42501', t.estado);

  t := pg_temp.tentar(m.estranha, pg_temp.cor(m.w1, m.marca_a, 'x'));
  perform pg_temp.registrar('outra conta NAO cria cor nesta', '42501', t.estado);

  t := pg_temp.tentar(m.estranha, format('update public.paleta_da_marca set nome = ''x'' where brand_id = %L', m.marca_a));
  perform pg_temp.registrar('outra conta NAO altera cor desta', 'ACEITOU-SEM-LINHA', t.estado);

  perform pg_temp.registrar('visitante sem sessao NAO le a paleta', '42501',
    pg_temp.tentar_anonimo('select count(*) from public.paleta_da_marca'));
  perform pg_temp.registrar('visitante sem sessao NAO chama a aprovacao', '42501',
    pg_temp.tentar_anonimo('select public.aprovar_cores_da_paleta(array[]::uuid[])'));
end $$;

-- ─── 2. Editar × aprovar ────────────────────────────────────────────────────
do $$
declare m record; t record; n integer; id_cor uuid; linha record;
begin
  select * into m from mundo;

  t := pg_temp.tentar(m.editora, pg_temp.cor(m.w1, m.marca_a, 'Da editora'));
  perform pg_temp.registrar('quem edita A cria cor em A', 'ACEITOU', t.estado);
  select * into linha from public.paleta_da_marca where nome = 'Da editora';
  perform pg_temp.registrar('e ela nasce rascunho, com a editora como autora', 'draft ' || m.editora,
    coalesce(linha.status, '?') || ' ' || coalesce(linha.created_by::text, '?'));

  t := pg_temp.tentar(m.editora, pg_temp.cor(m.w1, m.marca_a, 'Nasce pronta', 'status=''ready'''));
  perform pg_temp.registrar('cor NAO nasce aprovada', '23514 paleta_da_marca_nasce_rascunho', t.estado || ' ' || t.nome);

  t := pg_temp.tentar(m.dona, pg_temp.cor(m.w1, m.marca_a, 'Nasce pronta 2', 'status=''ready'''));
  perform pg_temp.registrar('nem quando quem cria tambem aprova', '23514 paleta_da_marca_nasce_rascunho', t.estado || ' ' || t.nome);

  t := pg_temp.tentar(m.editora, pg_temp.cor(m.w1, m.marca_a, 'Autoria forjada',
    format('aprovado_por=%L', m.aprovadora)));
  select * into linha from public.paleta_da_marca where nome = 'Autoria forjada';
  perform pg_temp.registrar('quem edita NAO forja quem aprovou', 'ACEITOU sem-aprovador',
    t.estado || ' ' || coalesce(linha.aprovado_por::text, 'sem-aprovador'));

  id_cor := pg_temp.semear('Para aprovar');
  t := pg_temp.tentar(m.editora, format('update public.paleta_da_marca set status = ''ready'' where id = %L', id_cor));
  perform pg_temp.registrar('quem edita NAO aprova pela escrita', '42501 paleta_da_marca_aprovar_exige_capacidade', t.estado || ' ' || t.nome);

  n := pg_temp.contar(m.editora, format('select public.aprovar_cores_da_paleta(array[%L]::uuid[])', id_cor));
  perform pg_temp.registrar('quem edita NAO aprova pela funcao', '0', n::text);

  t := pg_temp.tentar(m.aprovadora, format('update public.paleta_da_marca set status = ''ready'' where id = %L', id_cor));
  perform pg_temp.registrar('quem aprova sem editar NAO escreve na tabela', 'ACEITOU-SEM-LINHA', t.estado);

  n := pg_temp.contar(m.estranha, format('select public.aprovar_cores_da_paleta(array[%L]::uuid[])', id_cor));
  perform pg_temp.registrar('outra conta NAO aprova cor desta', '0', n::text);

  n := pg_temp.contar(m.aprovadora, format('select public.aprovar_cores_da_paleta(array[%L]::uuid[])', id_cor));
  perform pg_temp.registrar('quem aprova, aprova pela funcao', '1', n::text);
  select * into linha from public.paleta_da_marca where id = id_cor;
  perform pg_temp.registrar('e a ficha registra quem e quando', 'ready ' || m.aprovadora || ' com-data',
    linha.status || ' ' || coalesce(linha.aprovado_por::text, '?') || ' ' || case when linha.aprovado_em is null then 'sem-data' else 'com-data' end);

  n := pg_temp.contar(m.aprovadora, format('select public.aprovar_cores_da_paleta(array[%L]::uuid[])', id_cor));
  perform pg_temp.registrar('aprovar de novo nao reescreve a aprovacao', '0', n::text);

  n := pg_temp.contar(m.aprovadora, format('select public.aprovar_cores_da_paleta(array[%L]::uuid[])',
    (select id from public.paleta_da_marca where nome = 'Azul B')));
  perform pg_temp.registrar('quem aprova A NAO aprova cor de B, mesma conta', '0', n::text);

  -- A dona tem `editar` e `aprovar`: pela escrita direta ela aprova.
  id_cor := pg_temp.semear('Da dona');
  t := pg_temp.tentar(m.dona, format('update public.paleta_da_marca set status = ''ready'' where id = %L', id_cor));
  select * into linha from public.paleta_da_marca where id = id_cor;
  perform pg_temp.registrar('quem edita E aprova aprova pela escrita', 'ACEITOU ready ' || m.dona,
    t.estado || ' ' || linha.status || ' ' || coalesce(linha.aprovado_por::text, '?'));
end $$;

-- ─── 3. A aprovação vale para o que foi aprovado ────────────────────────────
do $$
declare m record; t record; id_cor uuid; linha record; antes timestamptz;
begin
  select * into m from mundo;

  id_cor := pg_temp.semear('Muda o codigo');
  update public.paleta_da_marca set status = 'ready' where id = id_cor;
  t := pg_temp.tentar(m.editora, format('update public.paleta_da_marca set hex = ''#003A70'' where id = %L', id_cor));
  select * into linha from public.paleta_da_marca where id = id_cor;
  perform pg_temp.registrar('alterar a cor aprovada a devolve a rascunho', 'ACEITOU draft sem-aprovacao',
    t.estado || ' ' || linha.status || ' ' || case when linha.aprovado_em is null and linha.aprovado_por is null then 'sem-aprovacao' else 'com-aprovacao' end);

  id_cor := pg_temp.semear('So a ordem');
  perform set_config('request.jwt.claims', json_build_object('sub', m.aprovadora, 'role', 'authenticated')::text, true);
  perform public.aprovar_cores_da_paleta(array[id_cor]);
  perform set_config('request.jwt.claims', '', true);
  select aprovado_em into antes from public.paleta_da_marca where id = id_cor;
  t := pg_temp.tentar(m.editora, format('update public.paleta_da_marca set ordem = 5 where id = %L', id_cor));
  select * into linha from public.paleta_da_marca where id = id_cor;
  perform pg_temp.registrar('mudar so a ordem mantem a aprovacao intacta', 'ACEITOU ready ' || m.aprovadora || ' mesma-data',
    t.estado || ' ' || linha.status || ' ' || coalesce(linha.aprovado_por::text, '?') || ' '
    || case when linha.aprovado_em = antes then 'mesma-data' else 'outra-data' end);

  t := pg_temp.tentar(m.editora, format('update public.paleta_da_marca set aprovado_por = %L where id = %L', m.editora, id_cor));
  select * into linha from public.paleta_da_marca where id = id_cor;
  perform pg_temp.registrar('quem edita NAO troca quem aprovou', m.aprovadora::text, coalesce(linha.aprovado_por::text, '?'));

  t := pg_temp.tentar(m.dona, format('update public.paleta_da_marca set brand_id = %L where id = %L', m.marca_b, id_cor));
  perform pg_temp.registrar('a cor NAO muda de marca', '23514 paleta_da_marca_marca_fixa', t.estado || ' ' || t.nome);

  -- Forma
  t := pg_temp.tentar(m.editora, replace(pg_temp.cor(m.w1, m.marca_a, 'Hex minusculo'), '#CC092F', '#cc092f'));
  perform pg_temp.registrar('HEX fora da forma e recusado', '23514 paleta_da_marca_hex_check', t.estado || ' ' || t.nome);

  t := pg_temp.tentar(m.editora, replace(pg_temp.cor(m.w1, m.marca_a, 'Sem codigo'), '''#CC092F''', 'null'));
  perform pg_temp.registrar('cor sem codigo nenhum e recusada', '23514 paleta_da_marca_algum_codigo', t.estado || ' ' || t.nome);

  t := pg_temp.tentar(m.editora, replace(pg_temp.cor(m.w1, m.marca_a, 'Papel errado'), '''apoio''', '''terciaria'''));
  perform pg_temp.registrar('papel fora do vocabulario e recusado', '23514 paleta_da_marca_papel_check', t.estado || ' ' || t.nome);

  t := pg_temp.tentar(m.editora, pg_temp.cor(m.w1, m.marca_a, 'Pagina zero', 'pagina=0'));
  perform pg_temp.registrar('pagina zero e recusada', '23514 paleta_da_marca_pagina_check', t.estado || ' ' || t.nome);
end $$;

-- ─── 3b. A origem da cor (27/09/2026) ───────────────────────────────────────
do $$
declare m record; t record; linha record; id_cor uuid;
begin
  select * into m from mundo;

  t := pg_temp.tentar(m.editora, pg_temp.cor(m.w1, m.marca_a, 'Cor à mão'));
  select * into linha from public.paleta_da_marca where nome = 'Cor à mão';
  perform pg_temp.registrar('cor cadastrada sem origem nasce de pessoa', 'ACEITOU pessoa', t.estado || ' ' || coalesce(linha.origem, '?'));

  t := pg_temp.tentar(m.editora, pg_temp.cor(m.w1, m.marca_a, 'Lida pela IA', 'origem=''ia'''));
  select * into linha from public.paleta_da_marca where nome = 'Lida pela IA';
  perform pg_temp.registrar('a sugestao da IA grava origem ia, e nasce rascunho', 'ACEITOU ia draft',
    t.estado || ' ' || coalesce(linha.origem, '?') || ' ' || coalesce(linha.status, '?'));

  t := pg_temp.tentar(m.editora, pg_temp.cor(m.w1, m.marca_a, 'Origem inventada', 'origem=''robo'''));
  perform pg_temp.registrar('origem fora do vocabulario e recusada', '23514 paleta_da_marca_origem_check', t.estado || ' ' || t.nome);

  id_cor := linha.id;
  t := pg_temp.tentar(m.editora, format('update public.paleta_da_marca set hex = ''#112233'', origem = ''pessoa'' where id = %L', id_cor));
  select * into linha from public.paleta_da_marca where id = id_cor;
  perform pg_temp.registrar('corrigir a cor sugerida NAO apaga que ela veio da IA', 'ACEITOU ia #112233 ' || m.editora,
    t.estado || ' ' || linha.origem || ' ' || coalesce(linha.hex, '?') || ' ' || coalesce(linha.updated_by::text, '?'));
end $$;

-- ─── 4. Conta removida e marca apagada ──────────────────────────────────────
do $$
declare m record; estado text; linha record; n integer;
begin
  select * into m from mundo;

  begin
    delete from auth.users where id = m.aprovadora;
    estado := 'ACEITOU';
  exception when others then
    estado := sqlstate || ' ' || sqlerrm;
  end;
  select * into linha from public.paleta_da_marca where nome = 'So a ordem';
  perform pg_temp.registrar('apagar quem aprovou nao trava e a cor continua aprovada', 'ACEITOU ready sem-aprovador',
    estado || ' ' || linha.status || ' ' || coalesce(linha.aprovado_por::text, 'sem-aprovador'));

  begin
    delete from public.brands where id = m.marca_a;
    estado := 'ACEITOU';
  exception when others then
    estado := sqlstate;
  end;
  select count(*) into n from public.paleta_da_marca where brand_id = m.marca_a;
  perform pg_temp.registrar('apagar a marca leva a paleta junto', 'ACEITOU 0', estado || ' ' || n);
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
