-- Prova dos complementos — 01/10/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e NOME da
-- constraint conferidos onde há recusa, e `rollback` no fim.
--
-- Cinco perguntas:
--   1. Só quem EDITA a marca cria, salva, publica, descarta e arquiva — e só
--      na marca em que edita; o endereço (slug) nasce do título e não repete.
--   2. Rascunho é só de quem edita: quem consulta não o lê, e ele nunca vira
--      trecho do Vini. Quem consulta lê só o publicado e não arquivado.
--   3. Publicar cria a versão seguinte, guarda cópia no histórico e refaz os
--      trechos; um rascunho novo não mexe no publicado até ser publicado.
--   4. Arquivar tira da leitura e do Vini sem apagar nada; reativar devolve; o
--      arquivado não se edita nem se publica.
--   5. Ninguém escreve direto nas tabelas nem reescreve o histórico; outra
--      conta não vê nada; o visitante não lê.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (dono1 uuid, dono2 uuid, editor uuid, leitor uuid, w1 uuid, w2 uuid, marca_a uuid, marca_b uuid, marca_c uuid, comp uuid);

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

-- O que a pessoa enxerga, numa frase: complementos, rascunhos, versões e trechos da marca.
create function pg_temp.enxerga(p_quem uuid, p_marca uuid) returns text
language sql as $f$
  select pg_temp.valor(p_quem, format(
    'select (select count(*) from public.complementos where brand_id = %1$L) || '' '' ||
            (select count(*) from public.rascunhos_de_complemento where brand_id = %1$L) || '' '' ||
            (select count(*) from public.versoes_de_complemento where brand_id = %1$L) || '' '' ||
            (select count(*) from public.trechos_de_complemento where brand_id = %1$L)', p_marca))
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u1 uuid := 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c10001';
  u2 uuid := 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c10002';
  u_editor uuid := 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c10003';
  u_leitor uuid := 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c10004';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u1, 'prova-comp-dono1@local.test', 'authenticated', 'authenticated'),
    (u2, 'prova-comp-dono2@local.test', 'authenticated', 'authenticated'),
    (u_editor, 'prova-comp-editor@local.test', 'authenticated', 'authenticated'),
    (u_leitor, 'prova-comp-leitor@local.test', 'authenticated', 'authenticated');
  insert into public.workspaces (name, slug) values ('Prova Comp 1', 'prova-comp-1') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Comp 2', 'prova-comp-2') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values (w1, u1, 'owner'), (w2, u2, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w1, 'comp-a', 'Marca A', 'A', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w1, 'comp-b', 'Marca B', 'B', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w2, 'comp-c', 'Marca C', 'C', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (a, w1, u_editor, array['consultar', 'editar']),
    (b, w1, u_editor, array['consultar']),
    (a, w1, u_leitor, array['consultar'])
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;
  insert into mundo values (u1, u2, u_editor, u_leitor, w1, w2, a, b, c, null);
end $$;

-- ─── 1. Criar ───────────────────────────────────────────────────────────────
do $$
declare m mundo; t record; novo uuid; outro uuid;
begin
  select * into m from mundo;
  select * into t from pg_temp.como(m.leitor, format('select public.criar_complemento(%L, ''Foto'', ''x'')', m.marca_a));
  perform pg_temp.registrar('quem so consulta NAO cria complemento', '42501', t.estado);
  select * into t from pg_temp.como(m.dono2, format('select public.criar_complemento(%L, ''Foto'', ''x'')', m.marca_a));
  perform pg_temp.registrar('dono de outra conta NAO cria na marca A', '42501', t.estado);
  select * into t from pg_temp.como(m.editor, format('select public.criar_complemento(%L, ''Foto'', ''x'')', m.marca_b));
  perform pg_temp.registrar('quem edita A NAO cria na B, onde so consulta', '42501', t.estado);
  select * into t from pg_temp.como(m.editor, format('select public.criar_complemento(%L, ''   '', ''x'')', m.marca_a));
  perform pg_temp.registrar('titulo vazio NAO vale', '23514 rascunhos_de_complemento_titulo_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.editor, format('select public.criar_complemento(%L, ''Longo'', repeat(''a'', 20001))', m.marca_a));
  perform pg_temp.registrar('texto acima de 20 mil NAO vale', '23514 rascunhos_de_complemento_texto_check', t.estado || ' ' || t.nome);

  novo := pg_temp.valor(m.editor, format('select public.criar_complemento(%L, ''Símbolo sobre foto'', %L)', m.marca_a,
    E'Use o símbolo sobre foto só em áreas escuras.\n\n## Fundo\nSempre sobre área escura e sem textura.\n\n## Versão\nA versão branca, sem gradiente.'))::uuid;
  update mundo set comp = novo;
  perform pg_temp.registrar('o endereco nasce do titulo, sem acento', 'simbolo-sobre-foto',
    (select slug from public.complementos where id = novo));
  outro := pg_temp.valor(m.editor, format('select public.criar_complemento(%L, ''Símbolo sobre foto'', ''x'')', m.marca_a))::uuid;
  perform pg_temp.registrar('o mesmo titulo de novo ganha outro endereco', 'simbolo-sobre-foto-2',
    (select slug from public.complementos where id = outro));
  perform pg_temp.registrar('nasce sem versao publicada', '0', (select versao::text from public.complementos where id = novo));
end $$;

-- ─── 2. Rascunho é só de quem edita ─────────────────────────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  -- complementos rascunhos versoes trechos
  perform pg_temp.registrar('quem edita ve os 2 rascunhos; nada publicado nem trecho', '2 2 0 0', pg_temp.enxerga(m.editor, m.marca_a));
  perform pg_temp.registrar('quem so consulta NAO ve rascunho nem complemento nao publicado', '0 0 0 0', pg_temp.enxerga(m.leitor, m.marca_a));
  perform pg_temp.registrar('o Vini de quem consulta nao acha nada', '0',
    pg_temp.valor(m.leitor, format('select count(*)::text from public.buscar_complementos(%L, ''foto'', 6)', m.marca_a)));
end $$;

-- ─── 3. Publicar ────────────────────────────────────────────────────────────
do $$
declare m mundo; t record;
begin
  select * into m from mundo;
  select * into t from pg_temp.como(m.leitor, format('select public.publicar_complemento(%L)', m.comp));
  perform pg_temp.registrar('quem so consulta NAO publica', '42501', t.estado);
  perform pg_temp.registrar('quem edita publica a versao 1', '1', pg_temp.valor(m.editor, format('select public.publicar_complemento(%L)::text', m.comp)));
  perform pg_temp.registrar('quem consulta passa a ler o publicado', 'Símbolo sobre foto',
    pg_temp.valor(m.leitor, format('select titulo from public.complementos where id = %L', m.comp)));
  perform pg_temp.registrar('o publicado vira 3 trechos (abertura e 2 secoes)', 'abertura,Fundo,Versão',
    (select string_agg(coalesce(secao, 'abertura'), ',' order by ordinal) from public.trechos_de_complemento where complemento_id = m.comp));
  perform pg_temp.registrar('o rascunho publicado sai da mesa; a versao entra no historico', '1 0 1',
    (select (select count(*) from public.complementos where id = m.comp) || ' ' ||
            (select count(*) from public.rascunhos_de_complemento where complemento_id = m.comp) || ' ' ||
            (select count(*) from public.versoes_de_complemento where complemento_id = m.comp)));
  perform pg_temp.registrar('quem consulta NAO le o historico', '0',
    pg_temp.valor(m.leitor, format('select count(*)::text from public.versoes_de_complemento where complemento_id = %L', m.comp)));
  perform pg_temp.registrar('o Vini acha pelo assunto, a secao certa primeiro', 'Versão',
    pg_temp.valor(m.leitor, format('select secao from public.buscar_complementos(%L, ''qual versão usar? branca?'', 6) limit 1', m.marca_a)));
  select * into t from pg_temp.como(m.editor, format('select public.publicar_complemento(%L)', m.comp));
  perform pg_temp.registrar('publicar sem rascunho NAO vale', '23514 complementos_sem_rascunho', t.estado || ' ' || t.nome);

  -- Um rascunho novo não mexe no publicado.
  perform pg_temp.como(m.editor, format('select public.salvar_rascunho_de_complemento(%L, ''Símbolo sobre foto'', %L)', m.comp,
    E'Texto novo com a palavra zebra.\n\n## Fundo\nNunca sobre rosto.'));
  perform pg_temp.registrar('com rascunho novo, quem consulta segue no publicado', 'true',
    pg_temp.valor(m.leitor, format('select (texto like ''%%áreas escuras%%'')::text from public.complementos where id = %L', m.comp)));
  perform pg_temp.registrar('e o Vini nao ve o rascunho', '0',
    (select count(*)::text from public.trechos_de_complemento where complemento_id = m.comp and conteudo like '%zebra%'));
  perform pg_temp.registrar('quem consulta NAO le o rascunho novo', '0',
    pg_temp.valor(m.leitor, 'select count(*)::text from public.rascunhos_de_complemento'));
  perform pg_temp.registrar('publicar o rascunho novo cria a versao 2', '2', pg_temp.valor(m.editor, format('select public.publicar_complemento(%L)::text', m.comp)));
  perform pg_temp.registrar('e os trechos passam a ser os da versao 2', 'abertura,Fundo',
    (select string_agg(coalesce(secao, 'abertura'), ',' order by ordinal) from public.trechos_de_complemento where complemento_id = m.comp));
end $$;

-- ─── 4. Arquivar, reativar, descartar ───────────────────────────────────────
do $$
declare m mundo; t record; outro uuid;
begin
  select * into m from mundo;
  select * into t from pg_temp.como(m.leitor, format('select public.arquivar_complemento(%L, true)', m.comp));
  perform pg_temp.registrar('quem so consulta NAO arquiva', '42501', t.estado);
  select * into t from pg_temp.como(m.editor, format('select public.arquivar_complemento(%L, true)', m.comp));
  perform pg_temp.registrar('quem edita arquiva', 'ACEITOU 1', t.estado);
  perform pg_temp.registrar('arquivado: quem consulta nao le, o Vini nao acha', '0 0',
    pg_temp.valor(m.leitor, format('select (select count(*) from public.complementos where id = %L) || '' '' || (select count(*) from public.buscar_complementos(%L, ''foto'', 6))', m.comp, m.marca_a)));
  perform pg_temp.registrar('arquivar nao apaga: o texto e o historico ficam', 'true 3',
    (select (texto is not null)::text || ' ' || (select count(*) from public.versoes_de_complemento where complemento_id = m.comp) from public.complementos where id = m.comp));
  select * into t from pg_temp.como(m.editor, format('select public.salvar_rascunho_de_complemento(%L, ''x'', ''y'')', m.comp));
  perform pg_temp.registrar('arquivado NAO se edita', '23514 complementos_arquivado', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.editor, format('select public.arquivar_complemento(%L, false)', m.comp));
  perform pg_temp.registrar('reativar devolve a leitura e os trechos', '1 2',
    pg_temp.valor(m.leitor, format('select (select count(*) from public.complementos where id = %L) || '' '' || (select count(*) from public.trechos_de_complemento where complemento_id = %L)', m.comp, m.comp)));
  perform pg_temp.registrar('o historico tem publicar, publicar, arquivar, reativar', 'publicado,publicado,arquivado,reativado',
    (select string_agg(acao, ',' order by created_at) from public.versoes_de_complemento where complemento_id = m.comp));

  outro := (select id from public.complementos where slug = 'simbolo-sobre-foto-2');
  select * into t from pg_temp.como(m.editor, format('select public.arquivar_complemento(%L, true)', outro));
  perform pg_temp.registrar('o que nunca foi publicado NAO se arquiva', '23514 complementos_arquivo_coerente', t.estado || ' ' || t.nome);
  perform pg_temp.como(m.editor, format('select public.descartar_rascunho_de_complemento(%L)', outro));
  perform pg_temp.registrar('descartar o que nunca foi publicado o tira inteiro', '0',
    (select count(*)::text from public.complementos where id = outro));
end $$;

-- ─── 5. Ninguém escreve direto; outra conta não vê; visitante não lê ─────────
do $$
declare m mundo; t record;
begin
  select * into m from mundo;
  select * into t from pg_temp.como(m.editor, format('update public.complementos set texto = ''trocado'' where id = %L', m.comp));
  perform pg_temp.registrar('quem edita NAO troca o publicado direto na tabela', '42501', t.estado);
  select * into t from pg_temp.como(m.editor, format('update public.versoes_de_complemento set texto = ''reescrito'' where complemento_id = %L', m.comp));
  perform pg_temp.registrar('ninguem reescreve o historico', '42501', t.estado);
  select * into t from pg_temp.como(m.dono1, format('delete from public.versoes_de_complemento where complemento_id = %L', m.comp));
  perform pg_temp.registrar('nem o dono apaga o historico', '42501', t.estado);
  select * into t from pg_temp.como(m.editor, format('insert into public.trechos_de_complemento (complemento_id, workspace_id, brand_id, slug, titulo, ordinal, conteudo, tsv) values (%L, %L, %L, ''x'', ''x'', 9, ''falso'', ''''::tsvector)', m.comp, m.w1, m.marca_a));
  perform pg_temp.registrar('ninguem planta trecho para o Vini', '42501', t.estado);

  perform pg_temp.registrar('o dono da conta 1 ve o complemento e o historico', '1 0 4 2', pg_temp.enxerga(m.dono1, m.marca_a));
  perform pg_temp.registrar('dono de outra conta NAO ve nada da marca A', '0 0 0 0', pg_temp.enxerga(m.dono2, m.marca_a));
  perform pg_temp.registrar('nem pela busca do Vini', '0',
    pg_temp.valor(m.dono2, format('select count(*)::text from public.buscar_complementos(%L, ''foto'', 6)', m.marca_a)));
  perform pg_temp.registrar('visitante NAO le complemento', '42501', pg_temp.papel('anon', 'select 1 from public.complementos limit 1'));
  perform pg_temp.registrar('visitante NAO busca', '42501',
    pg_temp.papel('anon', format('select 1 from public.buscar_complementos(%L, ''foto'', 6)', m.marca_a)));
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
