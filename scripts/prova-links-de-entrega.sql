-- Prova dos links de entrega — ADR-0007 §2.5 — 30/09/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e NOME da
-- constraint conferidos onde há recusa, e `rollback` no fim.
--
-- Cinco perguntas:
--   1. Só quem ADMINISTRA a marca cria link, e só com arquivos em uso DAQUELA
--      marca, sem fonte, com 1 a 60 arquivos e prazo de 1 a 30 dias (7 se
--      ninguém escolher). O código chega só como SHA-256.
--   2. Quem administra lê os links e os acessos da marca; outra conta, quem
--      só consulta e quem administra OUTRA marca não leem; ninguém escreve
--      direto; o visitante e a sessão comum não chamam as funções do servidor.
--   3. Abrir devolve o estado certo (inexistente, ativo, revogado, expirado);
--      no ativo, os arquivos na versão ATUAL (substituído → o novo, com data;
--      retirado → marcado e não entregue) e as páginas que regem cada item.
--   4. Baixar exige nome e e-mail, só serve arquivo DO link, registra ANTES de
--      devolver o caminho, e o registro guarda cópia do que foi entregue.
--   5. Revogar é de quem administra, vale na hora e não reescreve a data.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (
  dono1 uuid, dono2 uuid, leitor uuid, admin_a uuid, w1 uuid, w2 uuid, marca_a uuid, marca_b uuid, marca_c uuid,
  arq1 uuid, arq2 uuid, arq3 uuid, arq_b uuid, arq_c uuid, arq_velho uuid, arq_fonte uuid, link uuid
);

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

-- Como a rota de servidor chama: com a chave de serviço.
create function pg_temp.servico(p_sql text) returns text
language plpgsql as $f$
declare v text;
begin
  execute 'set local role service_role';
  execute p_sql into v;
  execute 'reset role';
  return v;
end $f$;

create function pg_temp.servico_erro(p_sql text, out estado text, out nome text)
language plpgsql as $f$
begin
  begin
    execute 'set local role service_role';
    execute p_sql;
    estado := 'ACEITOU'; nome := '';
    execute 'reset role';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
  end;
end $f$;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado = p_obtido);
$f$;

create function pg_temp.hash(p text) returns text
language sql as $f$ select encode(extensions.digest(p, 'sha256'), 'hex') $f$;

-- A chamada de criar, como a rota faz, com a sessão de quem administra.
create function pg_temp.criar(p_marca uuid, p_dias integer, p_arquivos uuid[], p_token text default null) returns text
language sql as $f$
  select format('select public.criar_link_de_entrega(%L, ''Grafica Pampa'', ''Carla'', %s, %L::uuid[], %L)',
                p_marca, coalesce(p_dias::text, 'null'), p_arquivos, coalesce(p_token, pg_temp.hash(gen_random_uuid()::text)))
$f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u1 uuid := 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e10001';
  u2 uuid := 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e10002';
  u_leitor uuid := 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e10003';
  u_admin uuid := 'e1e1e1e1-e1e1-4e1e-8e1e-e1e1e1e10004';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
  item_a uuid; item_b uuid; item_c uuid; item_fonte uuid;
  a1 uuid; a2 uuid; a3 uuid; ab uuid; ac uuid; avelho uuid; afonte uuid;
  doc uuid; secao uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u1, 'prova-links-dono1@local.test', 'authenticated', 'authenticated'),
    (u2, 'prova-links-dono2@local.test', 'authenticated', 'authenticated'),
    (u_leitor, 'prova-links-leitor@local.test', 'authenticated', 'authenticated'),
    (u_admin, 'prova-links-admin@local.test', 'authenticated', 'authenticated');
  insert into public.workspaces (name, slug) values ('Prova Links 1', 'prova-links-1') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Links 2', 'prova-links-2') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values (w1, u1, 'owner'), (w2, u2, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w1, 'links-a', 'Marca A', 'A', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w1, 'links-b', 'Marca B', 'B', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w2, 'links-c', 'Marca C', 'C', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (a, w1, u_leitor, array['consultar']),
    (a, w1, u_admin, array['consultar', 'editar', 'aprovar', 'administrar']),
    (b, w1, u_admin, array['consultar'])
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  -- O manual da marca A: uma página que rege o item (p. 9, com seção
  -- aprovada e imagem de leitura) e outra sem seção (p. 12).
  insert into public.brand_source_documents (workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count, created_by)
    values (w1, a, w1 || '/' || a || '/manual.pdf', repeat('a', 64), 1000, 33, u1) returning id into doc;
  insert into public.brand_imports (workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count, created_by, source_document_id)
    values (w1, a, w1 || '/' || a || '/manual.pdf', repeat('a', 64), 33, 1, u1, doc);
  -- A seção é criada em nome do dono: o gatilho de auditoria editorial exige quem edita.
  perform set_config('request.jwt.claims', json_build_object('sub', u1, 'role', 'authenticated')::text, true);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name, title, status, body, sort_order)
    values (w1, a, 'links-a', 'area-de-protecao', 'Marca', 'Área de proteção', 'ready', '[]', 1) returning id into secao;
  perform set_config('request.jwt.claims', '', true);
  insert into public.brand_source_pages (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto, cobertura, motivo_da_cobertura, document_id, miniatura_path)
    values (w1, a, doc, 9, 842, 595, true, 'secao', '', secao, w1 || '/' || a || '/pagina-' || doc || '-9.jpg'),
           (w1, a, doc, 12, 842, 595, true, 'sem-secao', 'capa de capítulo', null, null);

  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by, regra_paginas)
    values (w1, a, 'icone', 'Ícones', u1, array[9, 12]) returning id into item_a;
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
    values (w1, b, 'icone', 'Ícones B', u1) returning id into item_b;
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
    values (w2, c, 'icone', 'Ícones C', u2) returning id into item_c;

  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, created_by, cor, polaridade, espaco_de_cor) values
    (w1, a, item_a, 'Seta', w1 || '/' || a || '/seta.svg', 'seta.svg', 'image/svg+xml', 100, 'ready', u1, 'colorido', 'positivo', 'rgb') returning id into a1;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, created_by, cor, polaridade, espaco_de_cor) values
    (w1, a, item_a, 'Casa', w1 || '/' || a || '/casa.svg', 'casa.svg', 'image/svg+xml', 100, 'ready', u1, 'colorido', 'positivo', 'rgb') returning id into a2;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, created_by, cor, polaridade, espaco_de_cor) values
    (w1, a, item_a, 'Seta nova', w1 || '/' || a || '/seta-nova.svg', 'seta-nova.svg', 'image/svg+xml', 100, 'ready', u1, 'colorido', 'positivo', 'rgb') returning id into a3;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, created_by, cor, polaridade, espaco_de_cor) values
    (w1, a, item_a, 'Antiga', w1 || '/' || a || '/antiga.svg', 'antiga.svg', 'image/svg+xml', 100, 'ready', u1, 'colorido', 'positivo', 'rgb') returning id into avelho;
  update public.brand_assets set descontinuado_em = now(), descontinuado_por = u1 where id = avelho;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, created_by, cor, polaridade, espaco_de_cor) values
    (w1, b, item_b, 'Da B', w1 || '/' || b || '/b.svg', 'b.svg', 'image/svg+xml', 100, 'ready', u1, 'colorido', 'positivo', 'rgb') returning id into ab;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, created_by, cor, polaridade, espaco_de_cor) values
    (w2, c, item_c, 'Da C', w2 || '/' || c || '/c.svg', 'c.svg', 'image/svg+xml', 100, 'ready', u2, 'colorido', 'positivo', 'rgb') returning id into ac;

  -- Fonte ainda não é aceita no envio (espera o termo, ADR-0007 §3). Para
  -- provar que o LINK a recusa quando ela existir, a linha entra sem os
  -- gatilhos — só aqui, dentro da prova que termina em rollback.
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
    values (w1, a, 'fonte', 'Fonte', u1) returning id into item_fonte;
  set local session_replication_role = replica;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, created_by, cor, polaridade, espaco_de_cor) values
    (w1, a, item_fonte, 'Fonte', w1 || '/' || a || '/fonte.otf', 'fonte.otf', 'font/otf', 100, 'ready', u1, 'colorido', 'positivo', 'rgb') returning id into afonte;
  set local session_replication_role = origin;

  insert into mundo values (u1, u2, u_leitor, u_admin, w1, w2, a, b, c, a1, a2, a3, ab, ac, avelho, afonte, null);
end $$;

-- ─── 1. Criar ───────────────────────────────────────────────────────────────
do $$
declare m mundo; t record; novo uuid;
begin
  select * into m from mundo;

  select * into t from pg_temp.como(m.leitor, pg_temp.criar(m.marca_a, null, array[m.arq1]));
  perform pg_temp.registrar('quem so consulta NAO cria link', '42501', t.estado);
  select * into t from pg_temp.como(m.dono2, pg_temp.criar(m.marca_a, null, array[m.arq1]));
  perform pg_temp.registrar('dono de outra conta NAO cria link na marca A', '42501', t.estado);
  select * into t from pg_temp.como(m.admin_a, pg_temp.criar(m.marca_b, null, array[m.arq_b]));
  perform pg_temp.registrar('quem administra A NAO cria link na B, onde so consulta', '42501', t.estado);

  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, null, array[m.arq1, m.arq_b]));
  perform pg_temp.registrar('arquivo da marca B NAO entra em link da A', '23514 arquivos_do_link_da_marca', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, null, array[m.arq1, m.arq_c]));
  perform pg_temp.registrar('arquivo de outra conta NAO entra', '23514 arquivos_do_link_da_marca', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, null, array[]::uuid[]));
  perform pg_temp.registrar('selecao vazia NAO cria link', '23514 links_de_entrega_selecao_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, null, array[m.arq1, m.arq1]));
  perform pg_temp.registrar('arquivo repetido NAO cria link', '23514 links_de_entrega_selecao_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, null, (select array_agg(m.arq1) from generate_series(1, 61))));
  perform pg_temp.registrar('mais de 60 arquivos NAO cria link', '23514 links_de_entrega_selecao_check', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, null, array[m.arq_velho]));
  perform pg_temp.registrar('arquivo fora de uso NAO entra', '23514 arquivos_do_link_em_uso', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, null, array[m.arq_fonte]));
  perform pg_temp.registrar('fonte NAO entra em link', '23514 arquivos_do_link_sem_fonte', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, 31, array[m.arq1]));
  perform pg_temp.registrar('prazo de 31 dias NAO cria link', '23514 links_de_entrega_prazo_maximo', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, 0, array[m.arq1]));
  perform pg_temp.registrar('prazo de 0 dia NAO cria link', '23514 links_de_entrega_prazo_maximo', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, 7, array[m.arq1], 'codigo-em-claro'));
  perform pg_temp.registrar('codigo em claro (nao SHA-256) NAO e aceito', '23514 links_de_entrega_token_forma', t.estado || ' ' || t.nome);
  select * into t from pg_temp.como(m.dono1, format(
    'insert into public.links_de_entrega (workspace_id, brand_id, nome, token_hash, expira_em, criado_por_email) values (%L, %L, ''direto'', %L, now() + interval ''1 day'', ''x'')',
    m.w1, m.marca_a, pg_temp.hash('direto')));
  perform pg_temp.registrar('ninguem insere link direto na tabela', '42501', t.estado);

  -- Os que valem: 30 dias, prazo padrão, e quem administra só a marca A.
  select * into t from pg_temp.como(m.dono1, pg_temp.criar(m.marca_a, 30, array[m.arq1]));
  perform pg_temp.registrar('prazo de 30 dias cria link', 'ACEITOU 1', t.estado);
  select * into t from pg_temp.como(m.admin_a, pg_temp.criar(m.marca_a, null, array[m.arq2]));
  perform pg_temp.registrar('quem administra A cria link na A', 'ACEITOU 1', t.estado);
  perform pg_temp.registrar('sem prazo escolhido, sao 7 dias', '7',
    (select round(extract(epoch from expira_em - created_at) / 86400)::text from public.links_de_entrega where brand_id = m.marca_a and criado_por = m.admin_a));

  novo := pg_temp.valor(m.dono1, format('select public.criar_link_de_entrega(%L, ''  Grafica Pampa  '', ''Carla'', 7, %L::uuid[], %L)',
                                        m.marca_a, array[m.arq1, m.arq2], pg_temp.hash('codigo-da-prova')))::uuid;
  update mundo set link = novo;
  perform pg_temp.registrar('o link guarda so o hash do codigo', pg_temp.hash('codigo-da-prova'),
    (select token_hash from public.links_de_entrega where id = novo));
  perform pg_temp.registrar('o nome sai aparado e o autor vem da sessao', 'Grafica Pampa prova-links-dono1@local.test',
    (select nome || ' ' || criado_por_email from public.links_de_entrega where id = novo));
  perform pg_temp.registrar('a selecao guarda os dois arquivos na ordem', m.arq1 || ',' || m.arq2,
    (select string_agg(asset_id::text, ',' order by ordem) from public.arquivos_do_link where link_id = novo));
end $$;

-- ─── 2. Quem lê, quem não lê, e ninguém escreve ─────────────────────────────
do $$
declare m mundo; t record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('dono 1 le os 3 links da marca A', '3',
    pg_temp.valor(m.dono1, format('select count(*)::text from public.links_de_entrega where brand_id = %L', m.marca_a)));
  perform pg_temp.registrar('quem administra A le os 3 links da A', '3',
    pg_temp.valor(m.admin_a, format('select count(*)::text from public.links_de_entrega where brand_id = %L', m.marca_a)));
  perform pg_temp.registrar('dono 2 NAO le link da conta 1', '0',
    pg_temp.valor(m.dono2, 'select count(*)::text from public.links_de_entrega'));
  perform pg_temp.registrar('quem so consulta NAO le link', '0',
    pg_temp.valor(m.leitor, 'select count(*)::text from public.links_de_entrega'));
  perform pg_temp.registrar('quem so consulta NAO le os arquivos dos links', '0',
    pg_temp.valor(m.leitor, 'select count(*)::text from public.arquivos_do_link'));
  perform pg_temp.registrar('ninguem le o codigo em claro: so existe o hash', '0',
    (select count(*)::text from public.links_de_entrega where token_hash = 'codigo-da-prova'));
  select * into t from pg_temp.como(m.dono1, format('update public.links_de_entrega set expira_em = now() + interval ''29 days'' where id = %L', m.link));
  perform pg_temp.registrar('dono NAO estica o prazo direto na tabela', '42501', t.estado);
  select * into t from pg_temp.como(m.dono1, format('delete from public.arquivos_do_link where link_id = %L', m.link));
  perform pg_temp.registrar('dono NAO mexe na selecao direto', '42501', t.estado);
  perform pg_temp.registrar('visitante NAO le link', '42501', pg_temp.papel('anon', 'select 1 from public.links_de_entrega limit 1'));
  perform pg_temp.registrar('visitante NAO abre link pela funcao do servidor', '42501',
    pg_temp.papel('anon', format('select public.abrir_link_de_entrega(%L)', pg_temp.hash('codigo-da-prova'))));
  select * into t from pg_temp.como(m.dono1, format('select public.abrir_link_de_entrega(%L)', pg_temp.hash('codigo-da-prova')));
  perform pg_temp.registrar('sessao comum NAO chama a funcao do servidor (abrir)', '42501', t.estado);
  select * into t from pg_temp.como(m.dono1, format('select * from public.registrar_acesso_ao_link(%L, ''abriu'', null, null, null)', pg_temp.hash('codigo-da-prova')));
  perform pg_temp.registrar('sessao comum NAO chama a funcao do servidor (registrar)', '42501', t.estado);
end $$;

-- ─── 3. Abrir ───────────────────────────────────────────────────────────────
do $$
declare m mundo; j jsonb;
begin
  select * into m from mundo;
  perform pg_temp.registrar('codigo errado: inexistente', 'inexistente',
    pg_temp.servico(format('select public.abrir_link_de_entrega(%L)->>''estado''', pg_temp.hash('outro-codigo'))));

  j := pg_temp.servico(format('select public.abrir_link_de_entrega(%L)::text', pg_temp.hash('codigo-da-prova')))::jsonb;
  perform pg_temp.registrar('codigo certo: ativo, com marca e nome', 'ativo Marca A Grafica Pampa',
    (j->>'estado') || ' ' || (j->'link'->>'marca') || ' ' || (j->'link'->>'nome'));
  perform pg_temp.registrar('traz os dois arquivos, em ordem', 'seta.svg,casa.svg',
    (select string_agg(x->>'file_name', ',') from jsonb_array_elements(j->'arquivos') x));
  perform pg_temp.registrar('traz as paginas que regem: a 9 com titulo, status e imagem; a 12 sem secao',
    '9 Área de proteção ready t | 12 - - f',
    (select string_agg((x->>'pagina') || ' ' || coalesce(x->>'titulo', '-') || ' ' || coalesce(x->>'status', '-') || ' '
                       || ((x->>'imagem_path') is not null)::text::char, ' | ' order by (x->>'pagina')::int)
       from jsonb_array_elements(j->'paginas') x));
  perform pg_temp.registrar('abrir NAO registra nada sozinho', '0',
    (select count(*)::text from public.acessos_de_link where link_id = m.link));

  -- Substituição: a Seta vira a Seta nova; a Casa é retirada sem substituto.
  update public.brand_assets set descontinuado_em = now(), descontinuado_por = m.dono1, substituido_por = m.arq3 where id = m.arq1;
  update public.brand_assets set descontinuado_em = now(), descontinuado_por = m.dono1 where id = m.arq2;
  j := pg_temp.servico(format('select public.abrir_link_de_entrega(%L)::text', pg_temp.hash('codigo-da-prova')))::jsonb;
  perform pg_temp.registrar('substituido: o link mostra a versao atual, com data', 'seta-nova.svg true',
    (select (x->>'file_name') || ' ' || ((x->>'atualizado_em') is not null)::text from jsonb_array_elements(j->'arquivos') x where (x->>'id')::uuid = m.arq1));
  perform pg_temp.registrar('retirado sem substituto: marcado como retirado', 'true',
    (select x->>'retirado' from jsonb_array_elements(j->'arquivos') x where (x->>'id')::uuid = m.arq2));
end $$;

-- ─── 4. Registrar e baixar ──────────────────────────────────────────────────
do $$
declare m mundo; t record; h text := pg_temp.hash('codigo-da-prova');
begin
  select * into m from mundo;
  perform pg_temp.registrar('abrir a pagina registra "abriu"', '0',
    pg_temp.servico(format('select count(*)::text from public.registrar_acesso_ao_link(%L, ''abriu'', null, null, null)', h)));
  perform pg_temp.registrar('e o registro existe, sem identificacao', 'abriu -',
    (select evento || ' ' || coalesce(email, '-') from public.acessos_de_link where link_id = m.link));

  select * into t from pg_temp.servico_erro(format('select * from public.registrar_acesso_ao_link(%L, ''baixou'', '''', ''carla@grafica.com'', %L::uuid[])', h, array[m.arq1]));
  perform pg_temp.registrar('baixar sem nome NAO vale', '23514 acessos_de_link_identificacao', btrim(t.estado) || ' ' || t.nome);
  select * into t from pg_temp.servico_erro(format('select * from public.registrar_acesso_ao_link(%L, ''baixou'', ''Carla'', ''carla-sem-arroba'', %L::uuid[])', h, array[m.arq1]));
  perform pg_temp.registrar('baixar com e-mail malformado NAO vale', '23514 acessos_de_link_identificacao', btrim(t.estado) || ' ' || t.nome);
  select * into t from pg_temp.servico_erro(format('select * from public.registrar_acesso_ao_link(%L, ''baixou'', ''Carla'', ''carla@grafica.com'', %L::uuid[])', h, array[m.arq_b]));
  perform pg_temp.registrar('arquivo de fora do link NAO e servido', '23514 arquivos_do_link_pertence', btrim(t.estado) || ' ' || t.nome);
  select * into t from pg_temp.servico_erro(format('select * from public.registrar_acesso_ao_link(%L, ''baixou'', ''Carla'', ''carla@grafica.com'', %L::uuid[])', h, array[m.arq3]));
  perform pg_temp.registrar('nem a versao nova pedida pelo id dela (so o id escolhido vale)', '23514 arquivos_do_link_pertence', btrim(t.estado) || ' ' || t.nome);

  select * into t from pg_temp.servico_erro(format('select * from public.registrar_acesso_ao_link(%L, ''baixou'', ''Carla'', ''carla@grafica.com'', %L::uuid[], %L::uuid[])', h, array[m.arq1], array[m.arq1]));
  perform pg_temp.registrar('versao assinada que ja nao e a atual NAO e registrada', '23514 arquivos_do_link_versao_mudou', btrim(t.estado) || ' ' || t.nome);
  perform pg_temp.registrar('e nada foi gravado por ela', '0',
    (select count(*)::text from public.acessos_de_link where link_id = m.link and evento = 'baixou'));
  perform pg_temp.registrar('com a versao certa informada, registra e entrega', '1',
    pg_temp.servico(format('select count(*)::text from public.registrar_acesso_ao_link(%L, ''baixou'', ''Carla'', ''carla@grafica.com'', %L::uuid[], %L::uuid[])', h, array[m.arq1], array[m.arq3])));
  delete from public.acessos_de_link where link_id = m.link and evento = 'baixou';
  perform pg_temp.registrar('baixar a Seta entrega a versao atual, pelo caminho da marca A', m.w1 || '/' || m.marca_a || '/seta-nova.svg seta-nova.svg',
    pg_temp.servico(format('select storage_path || '' '' || file_name from public.registrar_acesso_ao_link(%L, ''baixou'', '' Carla '', ''Carla@Grafica.com'', %L::uuid[])', h, array[m.arq1])));
  perform pg_temp.registrar('o download ficou registrado com copia do que saiu', 'baixou Carla carla@grafica.com Seta nova seta-nova.svg',
    (select evento || ' ' || nome || ' ' || email || ' ' || asset_label || ' ' || file_name from public.acessos_de_link where link_id = m.link and evento = 'baixou'));
  perform pg_temp.registrar('a Casa, retirada, NAO e entregue', '0',
    pg_temp.servico(format('select count(*)::text from public.registrar_acesso_ao_link(%L, ''baixou'', ''Carla'', ''carla@grafica.com'', %L::uuid[])', h, array[m.arq2])));
  perform pg_temp.registrar('e nada se registra por ela', '1',
    (select count(*)::text from public.acessos_de_link where link_id = m.link and evento = 'baixou'));

  perform pg_temp.registrar('dono 1 le os acessos do link', '2',
    pg_temp.valor(m.dono1, format('select count(*)::text from public.acessos_de_link where link_id = %L', m.link)));
  perform pg_temp.registrar('dono 2 NAO le acessos da conta 1', '0', pg_temp.valor(m.dono2, 'select count(*)::text from public.acessos_de_link'));
  perform pg_temp.registrar('quem so consulta NAO le acessos', '0', pg_temp.valor(m.leitor, 'select count(*)::text from public.acessos_de_link'));
  select * into t from pg_temp.como(m.dono1, format('delete from public.acessos_de_link where link_id = %L', m.link));
  perform pg_temp.registrar('ninguem apaga acesso registrado', '42501', t.estado);
  select * into t from pg_temp.como(m.dono1, format('update public.acessos_de_link set email = ''outro@x.com'' where link_id = %L', m.link));
  perform pg_temp.registrar('ninguem reescreve acesso registrado', '42501', t.estado);
end $$;

-- ─── 5. Revogar e vencer ────────────────────────────────────────────────────
do $$
declare m mundo; t record; h text := pg_temp.hash('codigo-da-prova'); primeira timestamptz; vencido text;
begin
  select * into m from mundo;
  select * into t from pg_temp.como(m.leitor, format('select public.revogar_link_de_entrega(%L)', m.link));
  perform pg_temp.registrar('quem so consulta NAO revoga', '42501', t.estado);
  select * into t from pg_temp.como(m.dono2, format('select public.revogar_link_de_entrega(%L)', m.link));
  perform pg_temp.registrar('dono de outra conta NAO revoga', '42501', t.estado);
  select * into t from pg_temp.como(m.dono1, format('select public.revogar_link_de_entrega(%L)', m.link));
  perform pg_temp.registrar('dono revoga', 'ACEITOU 1', t.estado);
  select revogado_em into primeira from public.links_de_entrega where id = m.link;
  perform pg_temp.como(m.dono1, format('select public.revogar_link_de_entrega(%L)', m.link));
  perform pg_temp.registrar('revogar de novo NAO muda a data', 'true',
    ((select revogado_em from public.links_de_entrega where id = m.link) = primeira)::text);
  perform pg_temp.registrar('revogado: a pagina diz revogado', 'revogado',
    pg_temp.servico(format('select public.abrir_link_de_entrega(%L)->>''estado''', h)));
  select * into t from pg_temp.servico_erro(format('select * from public.registrar_acesso_ao_link(%L, ''baixou'', ''Carla'', ''carla@grafica.com'', %L::uuid[])', h, array[m.arq1]));
  perform pg_temp.registrar('revogado: nada se baixa', 'P0002', btrim(t.estado));

  -- Vencido: o link de 30 dias, com o relógio empurrado para trás.
  update public.links_de_entrega set created_at = now() - interval '31 days', expira_em = now() - interval '1 day'
   where brand_id = m.marca_a and criado_por = m.dono1 and revogado_em is null
     and expira_em > now() + interval '29 days';
  select token_hash into vencido from public.links_de_entrega where expira_em < now();
  perform pg_temp.registrar('vencido: a pagina diz expirado', 'expirado',
    pg_temp.servico(format('select public.abrir_link_de_entrega(%L)->>''estado''', vencido)));
  select * into t from pg_temp.servico_erro(format(
    'select * from public.registrar_acesso_ao_link(%L, ''abriu'', null, null, null)', vencido));
  perform pg_temp.registrar('vencido: nem a abertura se registra', 'P0002', btrim(t.estado));
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
