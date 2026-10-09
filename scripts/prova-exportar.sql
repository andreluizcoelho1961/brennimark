-- Prova da exportação pelo navegador — 08/10/2026.
--
-- Mundo próprio, SQLSTATE e NOME da constraint (ou a dica, `hint`), e
-- `rollback` no fim. Perguntas:
--   1. Só a DONA inicia, e só pela própria conta; o membro, a dona de outra
--      conta e o visitante não iniciam.
--   2. O manifesto traz os originais certos: o PDF que é importação e
--      documento aparece uma vez, o descontinuado entra, a versão 0 de
--      complemento não, o link vem sem o endereço; nada da outra conta.
--   3. A troca de chave por caminho só devolve o que é da conta da
--      exportação, só à dona, até 6 horas, até 50 por vez, dentro do teto de
--      endereços; bucket estranho e caminho com `..` nunca chegam a ela.
--   4. Concluir: só a dona, a primeira data vale.
--   5. Ninguém escreve direto; a dona de outra conta e o membro não leem.
--   6. O limite diário, a exclusão em andamento e as constraints, pelo nome.
--   7. A função privada não é chamável pela sessão; a conta sair leva o registro.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);

create function pg_temp.como(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text; n integer;
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
    get stacked diagnostics estado = returned_sqlstate;
    return estado;
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

create function pg_temp.papel(p_papel text, p_sql text) returns text
language plpgsql as $f$
declare estado text;
begin
  begin
    execute format('set local role %I', p_papel);
    execute p_sql;
    execute 'reset role';
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    return estado;
  end;
end $f$;

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

-- Erro como a pessoa: SQLSTATE e a dica (`hint`) ou o nome da constraint.
create function pg_temp.dica(p_quem uuid, p_sql text) returns text
language plpgsql as $f$
declare estado text; d text; nome text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, d = pg_exception_hint, nome = constraint_name;
    return estado || ' ' || coalesce(nullif(d, ''), nome, '');
  end;
end $f$;

create function pg_temp.erro(p_sql text) returns text
language plpgsql as $f$
declare estado text; nome text;
begin
  begin
    execute p_sql;
    return 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, nome = constraint_name;
    return estado || ' ' || coalesce(nome, '');
  end;
end $f$;

do $$
declare
  dona_a uuid := 'a0a0a0a0-0000-4000-8000-0000000e0001';
  membro_a uuid := 'a0a0a0a0-0000-4000-8000-0000000e0002';
  dona_b uuid := 'b0b0b0b0-0000-4000-8000-0000000e0003';
  a uuid; b uuid; ma uuid; mb uuid; item_a uuid; item_b uuid;
  doc uuid; imp_dup uuid; imp_solta uuid; mat uuid; mat_desc uuid; analise uuid; mat_b uuid;
  sha text := repeat('a', 64);
  man jsonb; exp_a uuid; exp_b uuid; chaves text[]; primeira timestamptz; fora_bucket uuid; fora_caminho uuid; fora_doc boolean := true;
begin
  insert into public.workspaces (name) values ('Prova Exportar A') returning id into a;
  insert into public.workspaces (name) values ('Prova Exportar B') returning id into b;
  insert into auth.users (id, email, aud, role) values
    (dona_a, 'prova-exportar-dona-a@local.test', 'authenticated', 'authenticated'),
    (membro_a, 'prova-exportar-membro-a@local.test', 'authenticated', 'authenticated'),
    (dona_b, 'prova-exportar-dona-b@local.test', 'authenticated', 'authenticated');
  insert into public.workspace_members (workspace_id, user_id, role) values
    (a, dona_a, 'owner'), (a, membro_a, 'member'), (b, dona_b, 'owner');
  -- Assinatura ativa nas duas: a conta só para leitura não aceita escrita.
  insert into public.assinaturas (workspace_id, plano, provedor, id_externo_cliente, id_externo_assinatura, situacao, titular_email)
  values (a, 'basico', 'stripe', 'cus_exp_a', 'sub_exportar_a', 'ativa', 'prova-exportar-dona-a@local.test'),
         (b, 'basico', 'stripe', 'cus_exp_b', 'sub_exportar_b', 'ativa', 'prova-exportar-dona-b@local.test');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (a, 'prova-exportar-a', 'Marca A', 'A', 'a', 'pt-BR', '{}', '{}', '{}', '{}', '{}') returning id into ma;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (b, 'prova-exportar-b', 'Marca B', 'B', 'b', 'pt-BR', '{}', '{}', '{}', '{}', '{}') returning id into mb;

  -- Conta A: um manual (que também é importação), uma importação solta, dois
  -- materiais (um descontinuado), uma análise, dois complementos (um nunca
  -- publicado) e um link.
  insert into public.brand_source_documents (workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count, titulo)
  values (a, ma, a || '/imp1/' || sha || '.pdf', sha, 1000, 10, 'Manual A') returning id into doc;
  insert into public.brand_imports (workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count, report, source_document_id)
  values (a, ma, a || '/imp1/' || sha || '.pdf', sha, 10, 1, '{}', doc) returning id into imp_dup;
  insert into public.brand_imports (workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count, report)
  values (a, ma, a || '/imp2/' || repeat('b', 64) || '.pdf', repeat('b', 64), 3, 1, '{}') returning id into imp_solta;
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome) values (a, ma, 'foto', 'Fotos') returning id into item_a;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status)
  values (a, ma, item_a, 'Logo', a || '/' || ma || '/u1-logo.svg', 'logo.svg', 'image/svg+xml', 200, 'ready') returning id into mat;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status, descontinuado_em)
  values (a, ma, item_a, 'Logo velho', a || '/' || ma || '/u2-velho.svg', 'velho.svg', 'image/svg+xml', 300, 'ready', now()) returning id into mat_desc;
  insert into public.analysis_runs (workspace_id, brand_id, file_name, image_media_type, image_size_bytes, image_fingerprint,
                                    image_path, question, analysis, provider, model, elapsed_ms)
  values (a, ma, 'peca.png', 'image/png', 400, 'f', a || '/' || ma || '/r1-peca.png', 'está ok?', '{}', 'x', 'y', 1) returning id into analise;
  insert into public.complementos (workspace_id, brand_id, slug, versao, titulo, texto, publicado_em, publicado_por_email)
  values (a, ma, 'tom-de-voz', 2, 'Tom de voz', 'Falamos simples.', now(), 'prova@local.test'),
         (a, ma, 'rascunho', 0, null, null, null, null);
  insert into public.links_de_entrega (workspace_id, brand_id, nome, destinatario, token_hash, expira_em, criado_por_email)
  values (a, ma, 'Para a gráfica', 'Gráfica X', repeat('c', 64), now() + interval '7 days', 'prova@local.test');

  -- Fora da regra, na conta A: um material com `..` no caminho e um documento
  -- num bucket estranho. Nenhum dos dois pode chegar a ser assinado.
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status)
  values (a, ma, item_a, 'Sobe', a || '/../' || b || '/x.svg', 'sobe.svg', 'image/svg+xml', 1, 'ready') returning id into fora_caminho;
  begin
    insert into public.brand_source_documents (workspace_id, brand_id, bucket_id, storage_path, pdf_sha256, byte_size, page_count, titulo)
    values (a, ma, 'outro-bucket', a || '/imp9/' || repeat('d', 64) || '.pdf', repeat('d', 64), 1, 1, 'Fora') returning id into fora_bucket;
  exception when others then
    fora_doc := false;  -- o banco já recusa o bucket estranho; o filtro fica de segunda linha
  end;

  -- Conta B: um material.
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome) values (b, mb, 'foto', 'Fotos B') returning id into item_b;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes, status)
  values (b, mb, item_b, 'Logo B', b || '/' || mb || '/u3-b.svg', 'b.svg', 'image/svg+xml', 500, 'ready') returning id into mat_b;

  -- 1. Quem inicia.
  perform pg_temp.registrar('o membro (nao dona) de A NAO inicia', '42501', pg_temp.como(membro_a, format('select public.iniciar_exportacao(%L)', a)));
  perform pg_temp.registrar('a dona de B NAO inicia pela conta A', '42501', pg_temp.como(dona_b, format('select public.iniciar_exportacao(%L)', a)));
  perform pg_temp.registrar('o visitante NAO inicia', '42501', pg_temp.papel('anon', format('select public.iniciar_exportacao(%L)', a)));
  perform pg_temp.registrar('nenhuma exportacao registrada pelas tentativas', '0', (select count(*)::text from public.exportacoes_da_conta where workspace_id = a));

  man := pg_temp.valor(dona_a, format('select public.iniciar_exportacao(%L)::text', a))::jsonb;
  exp_a := (man ->> 'id')::uuid;
  perform pg_temp.registrar('a dona de A inicia: registro com 5 arquivos e os bytes conhecidos', '1 5 1900',
    (select count(*)::text || ' ' || max(arquivos) || ' ' || max(bytes) from public.exportacoes_da_conta where workspace_id = a));
  perform pg_temp.registrar('o registro guarda quem iniciou', 'prova-exportar-dona-a@local.test',
    (select u.email from public.exportacoes_da_conta x join auth.users u on u.id = x.iniciada_por where x.id = exp_a));

  -- 2. O manifesto.
  perform pg_temp.registrar('o manifesto traz so a marca de A', '1 Marca A',
    jsonb_array_length(man -> 'marcas') || ' ' || (man -> 'marcas' -> 0 ->> 'nome'));
  select array_agg(f ->> 'chave' order by f ->> 'chave') into chaves from jsonb_array_elements(man -> 'marcas' -> 0 -> 'arquivos') f;
  perform pg_temp.registrar('os arquivos de A, um por chave',
    array_to_string(array(select unnest(array['analise:' || analise, 'documento:' || doc, 'importacao:' || imp_solta,
                                              'material:' || mat, 'material:' || mat_desc]) order by 1), ','),
    array_to_string(chaves, ','));
  perform pg_temp.registrar('caminho com .. NAO entra no manifesto', 'false', ('material:' || fora_caminho = any(chaves))::text);
  perform pg_temp.registrar('bucket estranho NAO entra no manifesto', 'false', (fora_doc and 'documento:' || fora_bucket = any(chaves))::text);
  perform pg_temp.registrar('a importacao que ja e documento NAO aparece de novo', 'false', ('importacao:' || imp_dup = any(chaves))::text);
  perform pg_temp.registrar('o material da conta B NAO aparece', 'false', (man::text like '%' || mat_b || '%')::text);
  perform pg_temp.registrar('o manifesto NAO traz caminho do Storage', 'false', (man::text like '%' || a || '/%')::text);
  perform pg_temp.registrar('o descontinuado vem marcado', 'true',
    ((select f -> 'detalhes' ->> 'descontinuado_em' from jsonb_array_elements(man -> 'marcas' -> 0 -> 'arquivos') f
       where f ->> 'chave' = 'material:' || mat_desc) is not null)::text);
  perform pg_temp.registrar('so o complemento publicado entra', '1 tom-de-voz Falamos simples.',
    jsonb_array_length(man -> 'marcas' -> 0 -> 'complementos') || ' ' || (man -> 'marcas' -> 0 -> 'complementos' -> 0 ->> 'slug')
      || ' ' || (man -> 'marcas' -> 0 -> 'complementos' -> 0 ->> 'texto'));
  perform pg_temp.registrar('o link entra, sem o hash do endereco', '1 false',
    jsonb_array_length(man -> 'marcas' -> 0 -> 'links') || ' ' || (man::text like '%' || repeat('c', 64) || '%')::text);

  -- 3. A troca de chave por caminho.
  perform pg_temp.registrar('a dona troca as chaves de A pelos caminhos de A', '2',
    pg_temp.valor(dona_a, format('select count(*)::text from public.caminhos_da_exportacao(%L, %L) where caminho like %L',
      exp_a, array['material:' || mat, 'documento:' || doc], a || '/%')));
  perform pg_temp.registrar('o bucket de cada um vem do banco', 'brand-assets,brand-imports',
    pg_temp.valor(dona_a, format('select string_agg(bucket, '','' order by bucket) from public.caminhos_da_exportacao(%L, %L)',
      exp_a, array['material:' || mat, 'documento:' || doc])));
  perform pg_temp.registrar('a chave da conta B, pela exportacao de A, NAO volta', '0',
    pg_temp.valor(dona_a, format('select count(*)::text from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || mat_b])));
  perform pg_temp.registrar('a dona de B NAO usa a exportacao de A', '42501',
    pg_temp.como(dona_b, format('select * from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || mat])));
  perform pg_temp.registrar('o membro de A NAO usa a exportacao de A', '42501',
    pg_temp.como(membro_a, format('select * from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || mat])));
  perform pg_temp.registrar('o visitante NAO troca chaves', '42501',
    pg_temp.papel('anon', format('select * from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || mat])));
  perform pg_temp.registrar('mais de 50 chaves de uma vez e barrado', '22023',
    pg_temp.como(dona_a, format('select * from public.caminhos_da_exportacao(%L, %L)', exp_a, array(select 'x:' || g from generate_series(1, 51) g))));

  perform pg_temp.registrar('a troca devolve a conta da exportacao', a::text,
    pg_temp.valor(dona_a, format('select distinct conta::text from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || mat])));
  perform pg_temp.registrar('a chave fora da regra NAO volta nem pela chave', '0',
    pg_temp.valor(dona_a, format('select count(*)::text from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || fora_caminho])));
  -- O teto por exportação: 2 x 5 arquivos + 50 = 60 endereços.
  update public.exportacoes_da_conta set chaves_entregues = 59 where id = exp_a;
  perform pg_temp.registrar('passar do teto de enderecos e barrado', 'P0001 exportacao_limite_de_arquivos',
    pg_temp.dica(dona_a, format('select * from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || mat, 'documento:' || doc])));
  perform pg_temp.registrar('ate o teto, passa', '1',
    pg_temp.valor(dona_a, format('select count(*)::text from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || mat])));
  perform pg_temp.registrar('o teto conta o que foi entregue', '60', (select chaves_entregues::text from public.exportacoes_da_conta where id = exp_a));

  -- 4. Concluir.
  perform pg_temp.registrar('a dona de B NAO conclui a de A', '42501', pg_temp.como(dona_b, format('select public.concluir_exportacao(%L)', exp_a)));
  perform pg_temp.registrar('a dona conclui', 'ACEITOU 1', pg_temp.como(dona_a, format('select public.concluir_exportacao(%L)', exp_a)));
  select concluida_em into primeira from public.exportacoes_da_conta where id = exp_a;
  perform pg_sleep(0.01);
  perform pg_temp.como(dona_a, format('select public.concluir_exportacao(%L)', exp_a));
  perform pg_temp.registrar('concluir de novo mantem a primeira data', 'true',
    ((select concluida_em from public.exportacoes_da_conta where id = exp_a) = primeira and primeira is not null)::text);

  -- 5. Ninguém escreve direto; só a dona lê.
  perform pg_temp.registrar('a dona le a exportacao de A', '1', pg_temp.valor(dona_a, 'select count(*)::text from public.exportacoes_da_conta'));
  perform pg_temp.registrar('a dona de B NAO ve a de A', '0',
    pg_temp.valor(dona_b, format('select count(*)::text from public.exportacoes_da_conta where workspace_id = %L', a)));
  perform pg_temp.registrar('o membro de A NAO ve', '0', pg_temp.valor(membro_a, 'select count(*)::text from public.exportacoes_da_conta'));
  perform pg_temp.registrar('a dona NAO insere direto', '42501',
    pg_temp.como(dona_a, format('insert into public.exportacoes_da_conta (workspace_id, marcas, arquivos, bytes) values (%L, 0, 0, 0)', a)));
  perform pg_temp.registrar('a dona NAO altera o registro', '42501', pg_temp.como(dona_a, 'update public.exportacoes_da_conta set arquivos = 0'));
  perform pg_temp.registrar('a dona NAO apaga o registro', '42501', pg_temp.como(dona_a, 'delete from public.exportacoes_da_conta'));
  perform pg_temp.registrar('a funcao privada NAO e chamavel pela sessao', '42501',
    pg_temp.como(dona_a, format('select * from private.arquivos_da_exportacao(%L)', a)));

  -- 6. Prazo, limite, exclusão em andamento, constraints.
  update public.exportacoes_da_conta set iniciada_em = now() - interval '7 hours', concluida_em = null where id = exp_a;
  perform pg_temp.registrar('a exportacao de 6 horas atras expirou', 'P0001 exportacao_expirada',
    pg_temp.dica(dona_a, format('select * from public.caminhos_da_exportacao(%L, %L)', exp_a, array['material:' || mat])));
  for i in 1..4 loop
    perform pg_temp.valor(dona_a, format('select public.iniciar_exportacao(%L)::text', a));
  end loop;
  perform pg_temp.registrar('cinco no dia: a sexta e barrada', 'P0001 exportacao_limite_diario',
    pg_temp.dica(dona_a, format('select public.iniciar_exportacao(%L)', a)));
  update public.exportacoes_da_conta set iniciada_em = now() - interval '25 hours' where workspace_id = a;
  perform pg_temp.registrar('passadas 24 horas, volta a poder', 'ACEITOU', pg_temp.dica(dona_a, format('select public.iniciar_exportacao(%L)', a)));

  exp_b := (pg_temp.valor(dona_b, format('select public.iniciar_exportacao(%L)::text', b))::jsonb ->> 'id')::uuid;
  update public.assinaturas set situacao = 'cancelada', cancelada_em = now() - interval '13 months',
         exclusao_avisada_em = now() - interval '31 days', exclusao_iniciada_em = now()
   where workspace_id = b;
  perform pg_temp.registrar('com a exclusao em andamento, NAO inicia', 'P0001 exportacao_exclusao_em_andamento',
    pg_temp.dica(dona_b, format('select public.iniciar_exportacao(%L)', b)));

  perform pg_temp.registrar('exclusao comecou no meio: a troca de chaves para', 'P0001 exportacao_exclusao_em_andamento',
    pg_temp.dica(dona_b, format('select * from public.caminhos_da_exportacao(%L, %L)', exp_b, array['material:' || mat_b])));

  perform pg_temp.registrar('contagem negativa e barrada', '23514 exportacoes_da_conta_contagens',
    pg_temp.erro(format('insert into public.exportacoes_da_conta (workspace_id, marcas, arquivos, bytes) values (%L, 0, -1, 0)', a)));
  perform pg_temp.registrar('conclusao antes do inicio e barrada', '23514 exportacoes_da_conta_conclusao_depois_do_inicio',
    pg_temp.erro(format($s$insert into public.exportacoes_da_conta (workspace_id, marcas, arquivos, bytes, concluida_em) values (%L, 0, 0, 0, now() - interval '1 day')$s$, a)));

  -- 7. A conta sair leva o registro.
  -- (a assinatura sai antes: conta só some pela exclusão, e isso é outra prova)
  delete from public.assinaturas where workspace_id = a;
  delete from public.workspaces where id = a;
  perform pg_temp.registrar('a conta sair leva as exportacoes', '0', (select count(*)::text from public.exportacoes_da_conta where workspace_id = a));
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
