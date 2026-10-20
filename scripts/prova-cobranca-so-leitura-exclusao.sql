-- Prova: conta só para leitura não apaga nada — 20/10/2026 (revisão de 18/10, achado 1).
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e HINT conferidos
-- (a recusa da cobrança tem o hint `cobranca_conta_so_leitura`; uma recusa por
-- outra causa, como falta de capacidade, não pode passar por ela), e `rollback`
-- no fim.
--
-- Cada classe de exclusão é provada em três tempos, com linhas DIFERENTES:
--   1. conta em dia: apagar a linha A funciona (controle — sem ele, "recusou"
--      poderia ser só "o usuário nunca pôde apagar isso");
--   2. conta em atraso há 8 dias: apagar a linha B é recusado e a linha B continua;
--   3. conta cancelada: o mesmo, para uma classe.
-- E as exceções, que seguem funcionando em conta só leitura.
--
-- Antes da migration `cobranca_so_leitura_nao_apaga`, os casos do tempo 2 e 3
-- ACEITAM a exclusão: é assim que a prova reproduz a falha.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

-- Como uma pessoa: 'ACEITOU n' (n = linhas afetadas) ou 'SQLSTATE hint'.
create function pg_temp.como(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text; dica text; n integer;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics n = row_count;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    return 'ACEITOU ' || n;
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, dica = pg_exception_hint;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    return estado || ' ' || coalesce(dica, '');
  end;
end $f$;

-- Como o dono do banco: gatilho vale até para quem passa por cima da permissão.
create function pg_temp.direto(p_sql text) returns text
language plpgsql as $f$
declare estado text; dica text; n integer;
begin
  begin
    execute p_sql;
    get diagnostics n = row_count;
    return 'ACEITOU ' || n;
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, dica = pg_exception_hint;
    return estado || ' ' || coalesce(dica, '');
  end;
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

create function pg_temp.sincronizar(p_assinatura text, p_situacao text, p_titular uuid, p_email text, p_nome text) returns uuid
language plpgsql as $f$
declare conta uuid;
begin
  execute 'set local role service_role';
  conta := public.cobranca_sincronizar_assinatura('stripe', 'cus_prova_sl', p_assinatura, 'price_prova_sl_brl', p_situacao,
    now() + interval '30 days', false, 'brl', p_titular, p_email, p_nome);
  execute 'reset role';
  return conta;
end $f$;

create function pg_temp.arquivo(p_bucket text, p_nome text) returns void
language sql as $f$
  insert into storage.objects (bucket_id, name, owner_id) values (p_bucket, p_nome, null);
$f$;

create temp table linhas (classe text, ativa uuid, leitura uuid);

insert into public.precos_do_plano (plano, provedor, id_externo, moeda, intervalo) values
  ('basico', 'stripe', 'price_prova_sl_brl', 'BRL', 'mes');

do $$
declare
  u uuid := 'cb0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0a01';   -- titular da conta A
  u_b uuid := 'cb0b0b0b-0b0b-4b0b-8b0b-0b0b0b0b0a02'; -- titular da conta B (em dia)
  a uuid; b uuid; marca uuid; marca_b uuid; marca_apagar uuid; item uuid; item_b uuid; novo uuid; i integer;
  asset_de_link uuid; link uuid; cmp_a uuid; cmp_b uuid; conv uuid;
  hash64 text := repeat('a', 64);
  recusa constant text := '42501 cobranca_conta_so_leitura';
  marca_sql text := 'insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values (%L, %L, ''M'', ''M'', ''x'', ''pt-BR'', ''{}'',''{}'',''{}'',''{}'',''{}'') returning id';
  n_antes integer;
  orfao text;
begin
  insert into auth.users (id, email, aud, role) values
    (u, 'prova-sl-a@local.test', 'authenticated', 'authenticated'),
    (u_b, 'prova-sl-b@local.test', 'authenticated', 'authenticated');
  a := pg_temp.sincronizar('sub_prova_sl_a', 'ativa', u, 'prova-sl-a@local.test', 'Conta A da Prova');
  b := pg_temp.sincronizar('sub_prova_sl_b', 'ativa', u_b, 'prova-sl-b@local.test', 'Conta B da Prova');

  execute format(marca_sql, a, 'sl-a') into marca;
  execute format(marca_sql, a, 'sl-a-apagar') into marca_apagar;
  execute format(marca_sql, b, 'sl-b') into marca_b;

  -- ─── O acervo, em pares (A: controle em dia; B: o que deve resistir) ─────
  -- brand_asset_items (sem asset ligado, para poder apagar)
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome) values (a, marca, 'icone', 'Item A') returning id into novo;
  insert into linhas values ('brand_asset_items', novo, null);
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome) values (a, marca, 'icone', 'Item B') returning id into novo;
  update linhas set leitura = novo where classe = 'brand_asset_items';

  -- brand_assets (direto na tabela) — um item próprio para cada
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome) values (a, marca, 'foto', 'Foto') returning id into item;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status)
  values (a, marca, item, 'A', a || '/' || marca || '/asset-a.png', 'a.png', 'image/png', 10, 'ready') returning id into novo;
  insert into linhas values ('brand_assets', novo, null);
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status)
  values (a, marca, item, 'B', a || '/' || marca || '/asset-b.png', 'b.png', 'image/png', 10, 'ready') returning id into novo;
  update linhas set leitura = novo where classe = 'brand_assets';
  -- brand_assets (pela RPC delete_asset_with_file): outro par
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status)
  values (a, marca, item, 'RA', a || '/' || marca || '/rpc-a.png', 'ra.png', 'image/png', 10, 'ready') returning id into novo;
  insert into linhas values ('rpc_delete_asset', novo, null);
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status)
  values (a, marca, item, 'RB', a || '/' || marca || '/rpc-b.png', 'rb.png', 'image/png', 10, 'ready') returning id into novo;
  update linhas set leitura = novo where classe = 'rpc_delete_asset';
  asset_de_link := novo;

  -- brand_documents (o gatilho de auditoria quer saber quem edita)
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name, title, status)
  values (a, marca, 'sl-a', 'doc-a', 'g', 'Doc A', 'draft') returning id into novo;
  insert into linhas values ('brand_documents', novo, null);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name, title, status)
  values (a, marca, 'sl-a', 'doc-b', 'g', 'Doc B', 'draft') returning id into novo;
  update linhas set leitura = novo where classe = 'brand_documents';
  perform set_config('request.jwt.claims', '', true);

  -- brand_imports
  insert into public.brand_imports (workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count)
  values (a, marca, a || '/imp-a/m.pdf', hash64, 1, 1) returning id into novo;
  insert into linhas values ('brand_imports', novo, null);
  insert into public.brand_imports (workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count)
  values (a, marca, a || '/imp-b/m.pdf', hash64, 1, 1) returning id into novo;
  update linhas set leitura = novo where classe = 'brand_imports';

  -- paleta, tipografia, regras do logo, regras de grid (rascunhos)
  insert into public.paleta_da_marca (workspace_id, brand_id, nome, papel, hex) values (a, marca, 'Cor A', 'principal', '#112233') returning id into novo;
  insert into linhas values ('paleta_da_marca', novo, null);
  insert into public.paleta_da_marca (workspace_id, brand_id, nome, papel, hex) values (a, marca, 'Cor B', 'principal', '#445566') returning id into novo;
  update linhas set leitura = novo where classe = 'paleta_da_marca';

  insert into public.tipografia_da_marca (workspace_id, brand_id, uso, familia) values (a, marca, 'titulo', 'Fonte A') returning id into novo;
  insert into linhas values ('tipografia_da_marca', novo, null);
  insert into public.tipografia_da_marca (workspace_id, brand_id, uso, familia) values (a, marca, 'texto', 'Fonte B') returning id into novo;
  update linhas set leitura = novo where classe = 'tipografia_da_marca';

  insert into public.regras_do_logo (workspace_id, brand_id, chave, valor) values (a, marca, 'area_de_protecao', 1) returning id into novo;
  insert into linhas values ('regras_do_logo', novo, null);
  insert into public.regras_do_logo (workspace_id, brand_id, chave, valor) values (a, marca, 'reducao_minima_logo', 20) returning id into novo;
  update linhas set leitura = novo where classe = 'regras_do_logo';

  insert into public.regras_de_grid (workspace_id, brand_id, formato, tipo, unidade) values (a, marca, 'a4', 'colunas', 'mm') returning id into novo;
  insert into linhas values ('regras_de_grid', novo, null);
  insert into public.regras_de_grid (workspace_id, brand_id, formato, tipo, unidade) values (a, marca, 'a3', 'colunas', 'mm') returning id into novo;
  update linhas set leitura = novo where classe = 'regras_de_grid';

  -- analysis_runs
  insert into public.analysis_runs (workspace_id, brand_id, created_by, file_name, image_media_type, image_size_bytes, image_fingerprint, question, analysis, provider, model, elapsed_ms)
  values (a, marca, u, 'p.png', 'image/png', 1, 'f1', 'q', '{}', 'x', 'y', 1) returning id into novo;
  insert into linhas values ('analysis_runs', novo, null);
  insert into public.analysis_runs (workspace_id, brand_id, created_by, file_name, image_media_type, image_size_bytes, image_fingerprint, question, analysis, provider, model, elapsed_ms)
  values (a, marca, u, 'p.png', 'image/png', 1, 'f2', 'q', '{}', 'x', 'y', 1) returning id into novo;
  update linhas set leitura = novo where classe = 'analysis_runs';

  -- complementos (criados pela RPC, que é a porta de entrada deles)
  cmp_a := pg_temp.valor(u, format('select public.criar_complemento(%L, ''Complemento A'', ''texto'')', marca))::uuid;
  cmp_b := pg_temp.valor(u, format('select public.criar_complemento(%L, ''Complemento B'', ''texto'')', marca))::uuid;
  insert into linhas values ('complementos', cmp_a, cmp_b);

  -- Exceções: um link de entrega, uma conversa, uma concessão e um item na fila.
  link := pg_temp.valor(u, format('select public.criar_link_de_entrega(%L, ''Gráfica'', ''Carla'', 7, %L::uuid[], %L)', marca, array[asset_de_link], hash64))::uuid;
  insert into public.conversas (workspace_id, brand_id, autor, titulo) values (a, marca, u, 'Conversa') returning id into conv;
  perform pg_temp.valor(u, format('select public.conceder_acesso(%L, ''prova-sl-convidado@local.test'', ''consulta'', array[%L]::uuid[])', a, marca));

  -- Arquivos do Storage: um da marca viva A (controle) e outro (deve resistir);
  -- um órfão (marca que não existe mais) com sua linha na fila.
  perform pg_temp.arquivo('brand-assets', a || '/' || marca || '/controle.png');
  perform pg_temp.arquivo('brand-assets', a || '/' || marca || '/resiste.png');
  orfao := a || '/' || gen_random_uuid() || '/orfao.png';
  perform pg_temp.arquivo('brand-assets', orfao);
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by) values (a, 'brand-assets', orfao, u);
  perform set_config('storage.allow_delete_query', 'true', true);

  -- ═══ Tempo 1: conta em dia — o controle ══════════════════════════════════
  perform pg_temp.registrar('em dia: pode apagar cor (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.paleta_da_marca where id = %L', (select ativa from linhas where classe = 'paleta_da_marca'))));
  perform pg_temp.registrar('em dia: pode apagar item (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.brand_asset_items where id = %L', (select ativa from linhas where classe = 'brand_asset_items'))));
  perform pg_temp.registrar('em dia: pode apagar asset direto (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.brand_assets where id = %L', (select ativa from linhas where classe = 'brand_assets'))));
  perform pg_temp.registrar('em dia: pode apagar asset pela RPC (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('select public.delete_asset_with_file(%L)', (select ativa from linhas where classe = 'rpc_delete_asset'))));
  perform pg_temp.registrar('em dia: pode apagar documento (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.brand_documents where id = %L', (select ativa from linhas where classe = 'brand_documents'))));
  perform pg_temp.registrar('em dia: pode apagar importação (controle; só o dono do banco: o usuário não tem DELETE direto)', 'ACEITOU 1',
    pg_temp.direto(format('delete from public.brand_imports where id = %L', (select ativa from linhas where classe = 'brand_imports'))));
  perform pg_temp.registrar('em dia: pode apagar tipografia em rascunho (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.tipografia_da_marca where id = %L', (select ativa from linhas where classe = 'tipografia_da_marca'))));
  perform pg_temp.registrar('em dia: pode apagar regra do logo em rascunho (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.regras_do_logo where id = %L', (select ativa from linhas where classe = 'regras_do_logo'))));
  perform pg_temp.registrar('em dia: pode apagar regra de grid em rascunho (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.regras_de_grid where id = %L', (select ativa from linhas where classe = 'regras_de_grid'))));
  perform pg_temp.registrar('em dia: pode apagar análise (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.analysis_runs where id = %L', (select ativa from linhas where classe = 'analysis_runs'))));
  perform pg_temp.registrar('em dia: pode descartar complemento (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('select public.descartar_rascunho_de_complemento(%L)', cmp_a)));
  perform pg_temp.registrar('em dia: pode apagar arquivo do Storage (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('delete from storage.objects where bucket_id = ''brand-assets'' and name = %L', a || '/' || marca || '/controle.png')));
  perform pg_temp.registrar('em dia: pode excluir uma marca pela RPC (controle)', 'ACEITOU 1',
    pg_temp.como(u, format('select public.delete_brand_with_files(%L)', marca_apagar)));

  -- ═══ Tempo 2: atraso há 8 dias — só leitura ═════════════════════════════
  perform pg_temp.sincronizar('sub_prova_sl_a', 'em_atraso', u, 'prova-sl-a@local.test', 'Conta A da Prova');
  update public.assinaturas set em_atraso_desde = now() - interval '8 days' where workspace_id = a;
  perform pg_temp.registrar('conta A está só para leitura', 'so_leitura',
    pg_temp.valor(u, format('select public.situacao_de_cobranca_da_conta(%L)->>''acesso''', a)));

  select count(*) into n_antes from public.brand_deletions where workspace_id = a;

  perform pg_temp.registrar('só leitura: NÃO apaga cor', recusa,
    pg_temp.como(u, format('delete from public.paleta_da_marca where id = %L', (select leitura from linhas where classe = 'paleta_da_marca'))));
  perform pg_temp.registrar('só leitura: NÃO apaga item', recusa,
    pg_temp.como(u, format('delete from public.brand_asset_items where id = %L', (select leitura from linhas where classe = 'brand_asset_items'))));
  perform pg_temp.registrar('só leitura: NÃO apaga asset direto', recusa,
    pg_temp.como(u, format('delete from public.brand_assets where id = %L', (select leitura from linhas where classe = 'brand_assets'))));
  perform pg_temp.registrar('só leitura: NÃO apaga asset pela RPC', recusa,
    pg_temp.como(u, format('select public.delete_asset_with_file(%L)', (select leitura from linhas where classe = 'rpc_delete_asset'))));
  perform pg_temp.registrar('só leitura: NÃO apaga documento', recusa,
    pg_temp.como(u, format('delete from public.brand_documents where id = %L', (select leitura from linhas where classe = 'brand_documents'))));
  perform pg_temp.registrar('só leitura: NÃO apaga importação', recusa,
    pg_temp.direto(format('delete from public.brand_imports where id = %L', (select leitura from linhas where classe = 'brand_imports'))));
  perform pg_temp.registrar('só leitura: NÃO apaga tipografia', recusa,
    pg_temp.como(u, format('delete from public.tipografia_da_marca where id = %L', (select leitura from linhas where classe = 'tipografia_da_marca'))));
  perform pg_temp.registrar('só leitura: NÃO apaga regra do logo', recusa,
    pg_temp.como(u, format('delete from public.regras_do_logo where id = %L', (select leitura from linhas where classe = 'regras_do_logo'))));
  perform pg_temp.registrar('só leitura: NÃO apaga regra de grid', recusa,
    pg_temp.como(u, format('delete from public.regras_de_grid where id = %L', (select leitura from linhas where classe = 'regras_de_grid'))));
  perform pg_temp.registrar('só leitura: NÃO apaga análise', recusa,
    pg_temp.como(u, format('delete from public.analysis_runs where id = %L', (select leitura from linhas where classe = 'analysis_runs'))));
  perform pg_temp.registrar('só leitura: NÃO descarta complemento', recusa,
    pg_temp.como(u, format('select public.descartar_rascunho_de_complemento(%L)', cmp_b)));
  perform pg_temp.registrar('só leitura: NÃO exclui marca pela RPC', recusa,
    pg_temp.como(u, format('select public.delete_brand_with_files(%L)', marca)));
  perform pg_temp.registrar('só leitura: NÃO exclui marca direto', recusa,
    pg_temp.como(u, format('delete from public.brands where id = %L', marca)));
  perform pg_temp.registrar('só leitura: NEM o dono do banco apaga (o gatilho vale para todos)', recusa,
    pg_temp.direto(format('delete from public.paleta_da_marca where id = %L', (select leitura from linhas where classe = 'paleta_da_marca'))));
  perform pg_temp.registrar('só leitura: NÃO apaga o arquivo da marca viva no Storage', 'ACEITOU 0',
    pg_temp.como(u, format('delete from storage.objects where bucket_id = ''brand-assets'' and name = %L', a || '/' || marca || '/resiste.png')));

  -- Nada sumiu, e a tentativa não deixou fila de exclusão para trás.
  perform pg_temp.registrar('as 11 linhas B continuam todas lá', '11',
    ((select count(*) from public.paleta_da_marca where id = (select leitura from linhas where classe = 'paleta_da_marca'))
   + (select count(*) from public.brand_asset_items where id = (select leitura from linhas where classe = 'brand_asset_items'))
   + (select count(*) from public.brand_assets where id = (select leitura from linhas where classe = 'brand_assets'))
   + (select count(*) from public.brand_assets where id = (select leitura from linhas where classe = 'rpc_delete_asset'))
   + (select count(*) from public.brand_documents where id = (select leitura from linhas where classe = 'brand_documents'))
   + (select count(*) from public.brand_imports where id = (select leitura from linhas where classe = 'brand_imports'))
   + (select count(*) from public.tipografia_da_marca where id = (select leitura from linhas where classe = 'tipografia_da_marca'))
   + (select count(*) from public.regras_do_logo where id = (select leitura from linhas where classe = 'regras_do_logo'))
   + (select count(*) from public.regras_de_grid where id = (select leitura from linhas where classe = 'regras_de_grid'))
   + (select count(*) from public.analysis_runs where id = (select leitura from linhas where classe = 'analysis_runs'))
   + (select count(*) from public.complementos where id = cmp_b))::text);
  perform pg_temp.registrar('a marca continua lá', '1', (select count(*)::text from public.brands where id = marca));
  perform pg_temp.registrar('o arquivo da marca viva continua no Storage', '1',
    (select count(*)::text from storage.objects where name = a || '/' || marca || '/resiste.png'));
  perform pg_temp.registrar('recusar a exclusão não deixou fila de arquivos', n_antes::text,
    (select count(*)::text from public.brand_deletions where workspace_id = a));

  -- Escrita (lacuna vizinha): estas quatro tabelas agora também param.
  perform pg_temp.registrar('só leitura: NÃO cria regra de grid', recusa,
    pg_temp.direto(format('insert into public.regras_de_grid (workspace_id, brand_id, formato, tipo, unidade) values (%L, %L, ''a5'', ''colunas'', ''mm'')', a, marca)));
  perform pg_temp.registrar('só leitura: NÃO edita tipografia', recusa,
    pg_temp.direto(format('update public.tipografia_da_marca set familia = ''Outra'' where id = %L', (select leitura from linhas where classe = 'tipografia_da_marca'))));
  perform pg_temp.registrar('só leitura: NÃO edita regra do logo', recusa,
    pg_temp.direto(format('update public.regras_do_logo set valor = 2 where id = %L', (select leitura from linhas where classe = 'regras_do_logo'))));
  perform pg_temp.registrar('só leitura: NÃO grava análise', recusa,
    pg_temp.direto(format('update public.analysis_runs set question = ''outra'' where id = %L', (select leitura from linhas where classe = 'analysis_runs'))));

  -- ─── As exceções seguem funcionando em conta só leitura ─────────────────
  perform pg_temp.registrar('exceção: revogar link de entrega', 'ACEITOU 1',
    pg_temp.como(u, format('select public.revogar_link_de_entrega(%L)', link)));
  perform pg_temp.registrar('o link ficou revogado', 'true',
    (select (revogado_em is not null)::text from public.links_de_entrega where id = link));
  perform pg_temp.registrar('exceção: revogar acesso de uma pessoa', 'ACEITOU 1',
    pg_temp.como(u, format('select public.revogar_acesso(%L, ''prova-sl-convidado@local.test'')', a)));
  perform pg_temp.registrar('exceção: o autor apaga a própria conversa', 'ACEITOU 1',
    pg_temp.como(u, format('select public.apagar_conversa(%L)', conv)));
  perform pg_temp.registrar('exceção: o arquivo órfão (marca já inexistente) sai do Storage', 'ACEITOU 1',
    pg_temp.como(u, format('delete from storage.objects where bucket_id = ''brand-assets'' and name = %L', orfao)));

  -- ─── Outra conta não é afetada ──────────────────────────────────────────
  insert into public.paleta_da_marca (workspace_id, brand_id, nome, papel, hex) values (b, marca_b, 'Cor da B', 'principal', '#778899') returning id into novo;
  perform pg_temp.registrar('a conta B (em dia) continua apagando', 'ACEITOU 1',
    pg_temp.como(u_b, format('delete from public.paleta_da_marca where id = %L', novo)));
  perform pg_temp.registrar('o titular de A não apaga nada na B (autorização, não só cobrança)', 'ACEITOU 0',
    pg_temp.como(u, format('delete from public.brands where id = %L', marca_b)));

  -- ═══ Tempo 3: cancelada — só leitura também ═════════════════════════════
  perform pg_temp.sincronizar('sub_prova_sl_a', 'cancelada', u, 'prova-sl-a@local.test', 'Conta A da Prova');
  perform pg_temp.registrar('cancelada: NÃO apaga a cor', recusa,
    pg_temp.como(u, format('delete from public.paleta_da_marca where id = %L', (select leitura from linhas where classe = 'paleta_da_marca'))));
  perform pg_temp.registrar('cancelada: NÃO exclui a marca', recusa,
    pg_temp.como(u, format('select public.delete_brand_with_files(%L)', marca)));
  perform pg_temp.registrar('cancelada: arquivo da marca viva também resiste', 'ACEITOU 0',
    pg_temp.como(u, format('delete from storage.objects where bucket_id = ''brand-assets'' and name = %L', a || '/' || marca || '/resiste.png')));

  -- ═══ Tempo 4: voltou a pagar — tudo volta ═══════════════════════════════
  perform pg_temp.sincronizar('sub_prova_sl_a', 'ativa', u, 'prova-sl-a@local.test', 'Conta A da Prova');
  perform pg_temp.registrar('voltou a pagar: apaga a cor', 'ACEITOU 1',
    pg_temp.como(u, format('delete from public.paleta_da_marca where id = %L', (select leitura from linhas where classe = 'paleta_da_marca'))));

  -- ═══ A forma ═════════════════════════════════════════════════════════════
  perform pg_temp.registrar('o gatilho de exclusão está nas 12 tabelas de conteúdo', '12',
    (select count(*)::text from pg_trigger where tgname = 'cobranca_so_leitura_exclusao'));
  perform pg_temp.registrar('o de escrita passou das 9 para as 13 tabelas', '13',
    (select count(*)::text from pg_trigger where tgname = 'cobranca_so_leitura'));
  perform pg_temp.registrar('registros, pessoas, conversas, fila e links NÃO têm trava de exclusão', '0',
    (select count(*)::text from pg_trigger t where t.tgname = 'cobranca_so_leitura_exclusao' and t.tgrelid in
      ('public.brand_deletions'::regclass, 'public.conversas'::regclass, 'public.concessoes_de_acesso'::regclass,
       'public.brand_members'::regclass, 'public.links_de_entrega'::regclass, 'public.brand_asset_downloads'::regclass,
       'public.registros_de_acesso'::regclass)));
  perform pg_temp.registrar('as funções novas não são chamáveis por anon', 'false',
    coalesce((select has_function_privilege('anon', f, 'execute')::text from (select to_regprocedure('public.arquivo_pode_ser_apagado(text,text)') f) x where f is not null), 'inexistente'));
  perform pg_temp.registrar('a decisão em private não é chamável por authenticated', 'false',
    coalesce((select (has_function_privilege('authenticated', f, 'execute')
                   or has_function_privilege('authenticated', to_regprocedure('private.exclusao_da_conta_em_curso(uuid)'), 'execute'))::text
                from (select to_regprocedure('private.barrar_exclusao_por_cobranca()') f) x where f is not null), 'inexistente'));
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
