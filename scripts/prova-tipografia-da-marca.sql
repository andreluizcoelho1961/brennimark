-- Prova da tipografia da marca (as fontes que o manual define, por uso) — 14/10/2026.
--
-- O mesmo método das provas das regras do logo e de grid: SQLSTATE e NOME da
-- constraint conferidos onde há erro esperado, dados isolados por caso, e
-- `rollback` no fim. Perguntas:
--   1. Isolamento: outra marca da mesma conta e outra conta não alcançam a
--      tipografia; quem só consulta lê e não escreve; o visitante nem lê.
--   2. Editar × aprovar (ADR-0002): quem edita grava sempre rascunho e nunca
--      aprova; quem aprova sem editar aprova pela função, e só isso.
--   3. Alterar uma aprovada a devolve a rascunho, REORDENAR não; aprovar e
--      alterar no mesmo gesto é recusado; a linha não muda de marca, de uso
--      nem de segmento.
--   4. A leitura da IA entra só pelo sistema (jsonb) e só onde não há linha;
--      nunca sobrescreve; uma leitura por marca a cada 24 horas; a origem não
--      se forja e tipografia aprovada não se apaga.
--   5. As constraints: uso, família, segmento, PostScript, substituta, corpo,
--      entrelinha, espacejamento, página, duplicata — e o mesmo uso em outro
--      segmento entra.
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
  u_dona uuid := '99999999-9999-4999-8999-99999997aaaa';
  u_edit uuid := '99999999-9999-4999-8999-99999997bbbb';
  u_le   uuid := '99999999-9999-4999-8999-99999997cccc';
  u_apr  uuid := '99999999-9999-4999-8999-99999997dddd';
  u_fora uuid := '99999999-9999-4999-8999-99999997eeee';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
  todas text[] := array['consultar','editar','aprovar','administrar'];
begin
  insert into auth.users (id, email, aud, role) values
    (u_dona, 'prova-tipo-dona@local.test',       'authenticated', 'authenticated'),
    (u_edit, 'prova-tipo-editora@local.test',    'authenticated', 'authenticated'),
    (u_le,   'prova-tipo-leitora@local.test',    'authenticated', 'authenticated'),
    (u_apr,  'prova-tipo-aprovadora@local.test', 'authenticated', 'authenticated'),
    (u_fora, 'prova-tipo-fora@local.test',       'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Prova Tipografia Um', 'prova-tipo-um') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Tipografia Dois', 'prova-tipo-dois') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values
    (w1, u_dona, 'owner'), (w1, u_edit, 'member'), (w1, u_le, 'member'), (w1, u_apr, 'member'),
    (w2, u_fora, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'tipo-a', 'Marca A', 'A', 'Primeira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w1, 'tipo-b', 'Marca B', 'B', 'Segunda', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (w2, 'tipo-c', 'Marca C', 'C', 'Terceira', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;

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

-- Uma linha como comando de inserção (VALUES, nunca select: quem não enxerga a
-- marca faria o select voltar vazio, e a recusa pareceria aceitação sem linha).
create function pg_temp.linha(p_conta uuid, p_marca uuid, p_uso text, p_familia text, p_extra text default '')
returns text language sql as $f$
  select format(
    'insert into public.tipografia_da_marca (workspace_id, brand_id, uso, familia%s) values (%L, %L, %L, %L%s)',
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 1) end,
    p_conta, p_marca, p_uso, p_familia,
    case when p_extra = '' then '' else ', ' || split_part(p_extra, '=', 2) end);
$f$;

do $$
declare
  m record; t record; id_a uuid; id_c uuid; id_ia uuid; e_estado text; e_nome text; antes timestamptz;
begin
  select * into m from mundo;

  -- ─── 1. Isolamento ───────────────────────────────────────────────────────
  insert into public.tipografia_da_marca (workspace_id, brand_id, uso, familia, estilo, pagina)
  values (m.w1, m.marca_a, 'titulo', 'Acme Sans', 'Bold', 20) returning id into id_a;
  insert into public.tipografia_da_marca (workspace_id, brand_id, uso, familia)
  values (m.w2, m.marca_c, 'titulo', 'Outra Sans') returning id into id_c;
  if id_a is null or id_c is null then raise exception 'PREPARAÇÃO FALHOU'; end if;

  perform pg_temp.registrar('quem consulta A le a tipografia de A', '1',
    pg_temp.contar(m.leitora, format('select count(*)::int from public.tipografia_da_marca where brand_id = %L', m.marca_a))::text);
  perform pg_temp.registrar('a dona de outra conta NAO le a tipografia de A', '0',
    pg_temp.contar(m.estranha, format('select count(*)::int from public.tipografia_da_marca where brand_id = %L', m.marca_a))::text);
  perform pg_temp.registrar('quem le A NAO ve a tipografia da marca C (outra conta)', '0',
    pg_temp.contar(m.leitora, format('select count(*)::int from public.tipografia_da_marca where brand_id = %L', m.marca_c))::text);
  perform pg_temp.registrar('o visitante NAO le', '42501',
    pg_temp.tentar_anonimo('select * from public.tipografia_da_marca'));
  select * into t from pg_temp.tentar(m.leitora, pg_temp.linha(m.w1, m.marca_a, 'texto', 'Acme Serif'));
  perform pg_temp.registrar('quem so consulta NAO cria', '42501', t.estado);
  select * into t from pg_temp.tentar(m.editora, pg_temp.linha(m.w1, m.marca_b, 'texto', 'Acme Serif'));
  perform pg_temp.registrar('quem edita A NAO cria na marca B (mesma conta)', '42501', t.estado);
  select * into t from pg_temp.tentar(m.estranha, format('update public.tipografia_da_marca set familia = ''X'' where id = %L', id_a));
  perform pg_temp.registrar('a dona de outra conta NAO altera a tipografia de A', 'ACEITOU-SEM-LINHA', t.estado);

  -- ─── 2. Editar × aprovar ─────────────────────────────────────────────────
  select * into t from pg_temp.tentar(m.editora, pg_temp.linha(m.w1, m.marca_a, 'texto', 'Acme Serif', 'substituta=''Georgia'''));
  perform pg_temp.registrar('quem edita cria', 'ACEITOU', t.estado);
  perform pg_temp.registrar('a linha criada por pessoa e rascunho de origem pessoa', 'draft pessoa',
    (select status || ' ' || origem from public.tipografia_da_marca where brand_id = m.marca_a and uso = 'texto'));
  select * into t from pg_temp.tentar(m.editora, pg_temp.linha(m.w1, m.marca_a, 'legenda', 'Acme Sans', 'status=''ready'''));
  perform pg_temp.registrar('a linha NAO nasce aprovada', '23514 tipografia_da_marca_nasce_rascunho', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.editora, format('update public.tipografia_da_marca set status = ''ready'' where id = %L', id_a));
  perform pg_temp.registrar('quem edita NAO aprova pela escrita', '42501 tipografia_da_marca_aprovar_exige_capacidade', t.estado || ' ' || t.nome);
  perform pg_temp.registrar('quem so consulta NAO aprova pela funcao', '0',
    pg_temp.contar(m.leitora, format('select public.aprovar_tipografia_da_marca(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('quem aprova outra conta NAO aprova a de A', '0',
    pg_temp.contar(m.estranha, format('select public.aprovar_tipografia_da_marca(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('quem aprova (sem editar) aprova pela funcao', '1',
    pg_temp.contar(m.aprovadora, format('select public.aprovar_tipografia_da_marca(array[%L]::uuid[])', id_a))::text);
  perform pg_temp.registrar('a aprovacao guarda quem aprovou', 'ready true',
    (select status || ' ' || (aprovado_por = m.aprovadora)::text from public.tipografia_da_marca where id = id_a));

  -- ─── 3. A aprovação vale para o que foi aprovado ─────────────────────────
  select * into t from pg_temp.tentar(m.editora, format('update public.tipografia_da_marca set aprovado_por = %L where id = %L', m.editora, id_a));
  perform pg_temp.registrar('ninguem forja quem aprovou', 'true',
    ((select aprovado_por from public.tipografia_da_marca where id = id_a) = m.aprovadora)::text);
  select aprovado_em into antes from public.tipografia_da_marca where id = id_a;
  select * into t from pg_temp.tentar(m.editora, format('update public.tipografia_da_marca set ordem = 5 where id = %L', id_a));
  perform pg_temp.registrar('reordenar NAO devolve a rascunho', 'ready true',
    (select status || ' ' || (aprovado_em = antes)::text from public.tipografia_da_marca where id = id_a));
  select * into t from pg_temp.tentar(m.editora, format('update public.tipografia_da_marca set estilo = ''Black'' where id = %L', id_a));
  perform pg_temp.registrar('alterar o estilo de uma aprovada a devolve a rascunho', 'draft',
    (select status from public.tipografia_da_marca where id = id_a));
  select * into t from pg_temp.tentar(m.dona, format('update public.tipografia_da_marca set status = ''ready'', estilo = ''Bold'' where id = %L', id_a));
  perform pg_temp.registrar('aprovar e alterar no mesmo gesto e recusado', '23514 tipografia_da_marca_aprova_sem_alterar', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('update public.tipografia_da_marca set brand_id = %L where id = %L', m.marca_b, id_a));
  perform pg_temp.registrar('a linha NAO muda de marca', '23514 tipografia_da_marca_fixa', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('update public.tipografia_da_marca set uso = ''texto'' where id = %L', id_a));
  perform pg_temp.registrar('a linha NAO muda de uso', '23514 tipografia_da_marca_fixa', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, format('update public.tipografia_da_marca set segmento = ''digital'' where id = %L', id_a));
  perform pg_temp.registrar('a linha NAO muda de segmento', '23514 tipografia_da_marca_fixa', t.estado || ' ' || t.nome);

  -- ─── 4. A leitura da IA ──────────────────────────────────────────────────
  perform pg_temp.registrar('a sessao NAO grava como IA', '42501',
    (select estado from pg_temp.tentar(m.dona, format(
      'select public.registrar_leitura_da_tipografia(%L, %L, ''{"uso":"destaque","familia":"Acme Display"}'')', m.w1, m.marca_a))));
  perform pg_temp.registrar('o sistema grava a leitura da IA onde nao ha linha', 'true',
    public.registrar_leitura_da_tipografia(m.w1, m.marca_a,
      '{"uso":"subtitulo","segmento":"digital","familia":"Acme Sans","estilo":"Medium","postscript":"AcmeSans-Medium","substituta":"Arial","corpo":18,"entrelinha":24,"espacejamento":-10,"caixa_alta":true,"descricao":"subtítulos em Medium","pagina":21}'::jsonb)::text);
  perform pg_temp.registrar('a leitura entra como rascunho de origem ia, com todos os campos', 'draft ia digital AcmeSans-Medium Arial 18 24 -10 true 21',
    (select status || ' ' || origem || ' ' || segmento || ' ' || postscript || ' ' || substituta || ' ' || corpo || ' ' || entrelinha || ' ' || espacejamento || ' ' || caixa_alta || ' ' || pagina
       from public.tipografia_da_marca where brand_id = m.marca_a and uso = 'subtitulo'));
  perform pg_temp.registrar('a IA NAO sobrescreve o que a pessoa respondeu', 'false Acme Serif',
    public.registrar_leitura_da_tipografia(m.w1, m.marca_a, '{"uso":"texto","familia":"Inventada"}'::jsonb)::text || ' '
    || (select familia from public.tipografia_da_marca where brand_id = m.marca_a and uso = 'texto' and segmento = ''));
  begin
    perform public.registrar_leitura_da_tipografia(m.w1, m.marca_a, '{"uso":"apoio","familia":"Acme","postscript":"Acme Sans Bold"}'::jsonb);
    e_estado := 'ACEITOU'; e_nome := '';
  exception when others then
    get stacked diagnostics e_estado = returned_sqlstate, e_nome = constraint_name;
  end;
  perform pg_temp.registrar('a leitura da IA com PostScript invalido e recusada pela constraint', '23514 tipografia_da_marca_postscript_check', e_estado || ' ' || e_nome);
  select id into id_ia from public.tipografia_da_marca where brand_id = m.marca_a and uso = 'subtitulo';
  select * into t from pg_temp.tentar(m.editora, format('update public.tipografia_da_marca set estilo = ''SemiBold'' where id = %L', id_ia));
  perform pg_temp.registrar('quem corrige a leitura da IA passa a responder por ela', 'pessoa',
    (select origem from public.tipografia_da_marca where id = id_ia));

  -- ─── 4b. Origem, apagar, teto da leitura ─────────────────────────────────
  select * into t from pg_temp.tentar(m.editora, format('update public.tipografia_da_marca set origem = ''ia'' where id = %L', id_ia));
  perform pg_temp.registrar('sem mudar a fonte, ninguem troca a origem (nem forja "lida pela IA")', 'pessoa',
    (select origem from public.tipografia_da_marca where id = id_ia));
  perform pg_temp.contar(m.aprovadora, format('select public.aprovar_tipografia_da_marca(array[%L]::uuid[])', id_ia));
  select * into t from pg_temp.tentar(m.editora, format('delete from public.tipografia_da_marca where id = %L', id_ia));
  perform pg_temp.registrar('tipografia aprovada NAO se apaga', 'ACEITOU-SEM-LINHA 1',
    t.estado || ' ' || (select count(*)::text from public.tipografia_da_marca where id = id_ia));
  select * into t from pg_temp.tentar(m.editora, format('delete from public.tipografia_da_marca where brand_id = %L and uso = ''texto''', m.marca_a));
  perform pg_temp.registrar('tipografia em rascunho se apaga', 'ACEITOU', t.estado);
  perform pg_temp.registrar('a primeira leitura do dia e reservada', 'true',
    public.reservar_leitura_da_tipografia(m.w1, m.marca_a)::text);
  perform pg_temp.registrar('a segunda leitura no mesmo dia NAO e reservada', 'false',
    public.reservar_leitura_da_tipografia(m.w1, m.marca_a)::text);
  update public.leituras_da_tipografia set tentada_em = now() - interval '25 hours' where brand_id = m.marca_a;
  perform pg_temp.registrar('passadas 24 horas, a leitura volta a ser reservada', 'true',
    public.reservar_leitura_da_tipografia(m.w1, m.marca_a)::text);
  perform pg_temp.registrar('a sessao NAO reserva leitura', '42501',
    (select estado from pg_temp.tentar(m.dona, format('select public.reservar_leitura_da_tipografia(%L, %L)', m.w1, m.marca_a))));
  perform pg_temp.registrar('a sessao NAO le as tentativas', '42501',
    (select estado from pg_temp.tentar(m.dona, 'select * from public.leituras_da_tipografia')));

  -- ─── 5. Constraints, pelo nome (cada caso na marca B, com uso/segmento próprio) ─
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'rodape', 'X'));
  perform pg_temp.registrar('uso desconhecido e recusado', '23514 tipografia_da_marca_uso_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', '   '));
  perform pg_temp.registrar('familia em branco e recusada', '23514 tipografia_da_marca_familia_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', 'X', 'segmento='' digital'''));
  perform pg_temp.registrar('segmento com espaco sobrando e recusado', '23514 tipografia_da_marca_segmento_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', 'X', 'postscript=''Acme Bold'''));
  perform pg_temp.registrar('PostScript com espaco e recusado', '23514 tipografia_da_marca_postscript_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', 'X', 'substituta='' '''));
  perform pg_temp.registrar('substituta em branco e recusada', '23514 tipografia_da_marca_substituta_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', 'X', 'corpo=0'));
  perform pg_temp.registrar('corpo zero e recusado', '23514 tipografia_da_marca_corpo_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', 'X', 'entrelinha=-1'));
  perform pg_temp.registrar('entrelinha negativa e recusada', '23514 tipografia_da_marca_entrelinha_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', 'X', 'espacejamento=5000'));
  perform pg_temp.registrar('espacejamento fora da faixa e recusado', '23514 tipografia_da_marca_espacejamento_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', 'X', 'pagina=0'));
  perform pg_temp.registrar('pagina zero e recusada', '23514 tipografia_da_marca_pagina_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_a, 'titulo', 'Acme Sans'));
  perform pg_temp.registrar('o mesmo uso e segmento duas vezes na mesma marca e recusado', '23505 tipografia_da_marca_um_por_uso', t.estado || ' ' || t.nome);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_a, 'titulo', 'Acme Sans', 'segmento=''digital'''));
  perform pg_temp.registrar('o mesmo uso em outro segmento entra', 'ACEITOU', t.estado);
  select * into t from pg_temp.tentar(m.dona, pg_temp.linha(m.w1, m.marca_b, 'titulo', 'Acme Sans', 'postscript=''AcmeSans-Bold'''));
  perform pg_temp.registrar('a linha valida da marca B entra (os casos alcancam a constraint, nao a policy)', 'ACEITOU', t.estado);

  delete from public.brands where id = m.marca_c;
  perform pg_temp.registrar('a marca sair leva a tipografia dela', '0',
    (select count(*)::text from public.tipografia_da_marca where brand_id = m.marca_c));
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
