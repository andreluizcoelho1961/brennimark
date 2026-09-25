-- Prova da conta removida — LGPD, decisões do André em 24/09/2026.
--
-- Uma pessoa (Bia) deixa TODO rastro possível: material, item, manual
-- importado, consumo de IA, análise de peça, concessão dada e recebida,
-- registros de acesso e de download, conversa com o Vini. Outra pessoa (Caio)
-- faz o mesmo tipo de coisa na mesma marca, de controle. Apaga-se o login da
-- Bia, e a prova confere:
--
--   1. a exclusão FUNCIONA (até aqui, travava);
--   2. autoria e trilhas ficam, com a referência nula ("conta removida");
--   3. as cópias de e-mail viram o apelido anônimo, ESTÁVEL por pessoa;
--   4. as análises ficam com a marca;
--   5. o que era pessoal some: perfil, participações, conversas;
--   6. a concessão PARA ela termina; a que ela deu continua;
--   7. nada do Caio muda.
--
-- Mundo próprio, `rollback` no fim. A exclusão roda como superusuário porque é
-- assim que ela acontece hoje (painel do Supabase); a prova de que nenhum
-- papel comum alcança as funções novas está no fim.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (conta uuid, marca uuid, bia uuid, caio uuid, dono uuid, item uuid, asset uuid,
                         importacao uuid, execucao uuid, analise uuid, concessao_da_bia uuid, concessao_para_bia uuid,
                         documento uuid);

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text)
returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;

create function pg_temp.entrar(p_id uuid, p_email text) returns void
language plpgsql as $f$
begin
  insert into auth.users (id, email, aud, role) values (p_id, p_email, 'authenticated', 'authenticated');
  insert into public.profiles (id, email, full_name) values (p_id, p_email, split_part(p_email,'@',1));
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u_dono uuid := 'f0f0f0f0-0000-4000-8000-00000000000d';
  u_bia  uuid := 'f0f0f0f0-0000-4000-8000-0000000000b1';
  u_caio uuid := 'f0f0f0f0-0000-4000-8000-0000000000c1';
  ca uuid; mb uuid; it uuid; va uuid; imp uuid; ex uuid; an uuid; cdb uuid; cpb uuid; doc uuid;
  sha text := repeat('a', 64);
begin
  perform pg_temp.entrar(u_dono, 'cr-dono@local.test');
  perform pg_temp.entrar(u_bia,  'cr-bia@local.test');
  perform pg_temp.entrar(u_caio, 'cr-caio@local.test');
  ca := private.abrir_conta_de_assinatura('Conta da Prova LGPD', 'cr-dono@local.test', u_dono);
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
  values (ca, 'cr-marca', 'Marca', 'M', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into mb;

  -- A Bia e o Caio recebem acesso de consulta; a Bia, depois, concede a outro.
  perform set_config('request.jwt.claims', json_build_object('sub', u_dono, 'role', 'authenticated')::text, true);
  perform public.conceder_acesso(ca, 'cr-bia@local.test', 'consulta', array[mb]);
  perform public.conceder_acesso(ca, 'cr-caio@local.test', 'consulta', array[mb]);
  perform set_config('request.jwt.claims', '', true);
  -- A conversão (login existente → acesso): o que o primeiro acesso faz.
  update public.concessoes_de_acesso set convertida_em = now(), convertida_para = u_bia
   where email = 'cr-bia@local.test' returning id into cpb;
  update public.concessoes_de_acesso set convertida_em = now(), convertida_para = u_caio
   where email = 'cr-caio@local.test';
  if cpb is null then raise exception 'premissa falhou: concessão para a Bia'; end if;
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
  values (mb, ca, u_bia, array['consultar','editar'], u_dono), (mb, ca, u_caio, array['consultar'], u_dono)
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  -- Uma concessão que a BIA deu (como se administrasse): deve continuar.
  insert into public.concessoes_de_acesso (workspace_id, email, papel, brand_id, concedida_por)
  values (ca, 'cr-convidado@local.test', 'consulta', mb, u_bia) returning id into cdb;

  -- Autoria da Bia em tudo.
  insert into public.brand_asset_items (workspace_id, brand_id, tipo, nome, created_by)
  values (ca, mb, 'logo', 'Logo', u_bia) returning id into it;
  insert into public.brand_assets (workspace_id, brand_id, item_id, label, storage_path, file_name, mime_type, size_bytes,
    status, created_by, hierarquia, lockup, cor, polaridade, espaco_de_cor)
  values (ca, mb, it, 'Logo', ca::text || '/' || mb::text || '/' || gen_random_uuid()::text || '-l.svg', 'l.svg',
    'image/svg+xml', 1, 'ready', u_bia, 'principal', 'horizontal', 'colorido', 'positivo', 'rgb') returning id into va;
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('brand-imports', ca::text || '/imp/' || sha || '.pdf', u_bia::text, '{"size": 1}');
  insert into public.brand_imports (workspace_id, brand_id, storage_path, pdf_sha256, page_count, document_count, created_by)
  values (ca, mb, ca::text || '/imp/' || sha || '.pdf', sha, 1, 0, u_bia) returning id into imp;
  -- O documento pede editor na sessão (histórico editorial): a Bia edita.
  perform set_config('request.jwt.claims', json_build_object('sub', u_bia, 'role', 'authenticated')::text, true);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name, title, status, updated_by)
  values (ca, mb, 'cr', 'cores', 'Marca', 'Cores', 'draft', u_bia) returning id into doc;
  perform set_config('request.jwt.claims', '', true);
  insert into public.ai_ledger (workspace_id, brand_id, user_id, execution_id, task, reserved_micros, currency, status, settled_micros, settled_at)
  values (ca, mb, u_bia, gen_random_uuid(), 'assist', 100, 'USD', 'settled', 80, now()) returning id into ex;
  insert into public.analysis_runs (workspace_id, brand_id, created_by, file_name, image_media_type, image_size_bytes,
    image_fingerprint, question, analysis, provider, model, elapsed_ms)
  values (ca, mb, u_bia, 'peca.png', 'image/png', 1, repeat('b', 64), 'confere?', '{}', 'google', 'gemini', 1)
  returning id into an;
  insert into public.brand_access_log (workspace_id, brand_id, pessoa, pessoa_email, autor, autor_email, acao, capacidades_antes, capacidades_depois)
  values (ca, mb, u_caio, 'cr-caio@local.test', u_bia, 'cr-bia@local.test', 'concedido', null, array['consultar']);
  perform set_config('request.jwt.claims', json_build_object('sub', u_bia, 'role', 'authenticated')::text, true);
  insert into public.brand_asset_downloads (asset_id, brand_id, workspace_id, pessoa, pessoa_email, asset_label, file_name)
  values (va, mb, ca, u_bia, '', '', ''), (va, mb, ca, u_bia, '', '', '');
  insert into public.downloads_do_manual (import_id, brand_id, workspace_id, pessoa, pessoa_email, file_name)
  values (imp, mb, ca, u_bia, '', '');
  perform set_config('request.jwt.claims', '', true);
  insert into public.conversas (workspace_id, brand_id, autor, titulo) values (ca, mb, u_bia, 'da Bia');

  -- O Caio também baixa: controle.
  perform set_config('request.jwt.claims', json_build_object('sub', u_caio, 'role', 'authenticated')::text, true);
  insert into public.brand_asset_downloads (asset_id, brand_id, workspace_id, pessoa, pessoa_email, asset_label, file_name)
  values (va, mb, ca, u_caio, '', '', '');
  perform set_config('request.jwt.claims', '', true);

  insert into mundo values (ca, mb, u_bia, u_caio, u_dono, it, va, imp, ex, an, cdb, cpb, doc);
end $$;

-- ─── A exclusão ────────────────────────────────────────────────────────────
do $$
declare m record; ok text := 'apagou'; versoes_antes int; versoes_depois int;
begin
  select * into m from mundo;
  select count(*) into versoes_antes from public.brand_document_versions where source_document_id = m.documento;
  begin
    delete from auth.users where id = m.bia;
  exception when others then
    ok := 'travou: ' || sqlstate || ' ' || sqlerrm;
  end;
  perform pg_temp.registrar('apagar o login da Bia FUNCIONA', 'apagou', ok);
  select count(*) into versoes_depois from public.brand_document_versions where source_document_id = m.documento;
  perform pg_temp.registrar('esquecer o autor não cria versão nova do documento', versoes_antes::text, versoes_depois::text);
end $$;

-- ─── 2. Autoria e trilhas ficam, sem a pessoa ──────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('o material fica, autor esquecido', 'fica/nulo',
    (select 'fica/' || coalesce(created_by::text, 'nulo') from public.brand_assets where id = m.asset));
  perform pg_temp.registrar('o item fica, autor esquecido', 'fica/nulo',
    (select 'fica/' || coalesce(created_by::text, 'nulo') from public.brand_asset_items where id = m.item));
  perform pg_temp.registrar('o manual importado fica, autor esquecido', 'fica/nulo',
    (select 'fica/' || coalesce(created_by::text, 'nulo') from public.brand_imports where id = m.importacao));
  perform pg_temp.registrar('o documento fica, quem editou esquecido', 'fica/nulo',
    (select 'fica/' || coalesce(updated_by::text, 'nulo') from public.brand_documents where id = m.documento));
  perform pg_temp.registrar('o consumo de IA fica no razão, pessoa esquecida', 'fica/nulo',
    (select 'fica/' || coalesce(user_id::text, 'nulo') from public.ai_ledger where id = m.execucao));
end $$;

-- ─── 3. O apelido anônimo, estável por pessoa ──────────────────────────────
do $$
declare m record; apelido text; apelidos int;
begin
  select * into m from mundo;
  apelido := private.apelido_de_conta_removida(m.bia);
  perform pg_temp.registrar('o apelido tem forma de e-mail que nunca entrega', 'sim',
    case when apelido ~ '^conta-removida-[0-9a-f]{6}@removida\.invalid$' then 'sim' else apelido end);
  perform pg_temp.registrar('nenhum registro guarda mais o e-mail da Bia', '0',
    ((select count(*) from public.brand_access_log where pessoa_email = 'cr-bia@local.test' or autor_email = 'cr-bia@local.test')
   + (select count(*) from public.brand_asset_downloads where pessoa_email = 'cr-bia@local.test')
   + (select count(*) from public.downloads_do_manual where pessoa_email = 'cr-bia@local.test')
   + (select count(*) from public.concessoes_de_acesso where email = 'cr-bia@local.test'))::text);
  select count(*) into apelidos from public.brand_asset_downloads where pessoa_email = apelido;
  perform pg_temp.registrar('os dois downloads dela continuam juntos, sob o MESMO apelido', '2', apelidos::text);
  perform pg_temp.registrar('o download do manual também leva o apelido', '1',
    (select count(*)::text from public.downloads_do_manual where pessoa_email = apelido));
  perform pg_temp.registrar('como autora de concessão, no registro de acesso, também', '1',
    (select count(*)::text from public.brand_access_log where autor_email = apelido));
  perform pg_temp.registrar('o apelido do Caio seria outro', 'outro',
    case when private.apelido_de_conta_removida(m.caio) <> apelido then 'outro' else 'igual' end);
end $$;

-- ─── 4 a 6. Análise fica; pessoal some; concessões ─────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('a análise de peça fica com a marca, autora esquecida', 'fica/nulo',
    (select 'fica/' || coalesce(created_by::text, 'nulo') from public.analysis_runs where id = m.analise));
  perform pg_temp.registrar('o perfil some', '0', (select count(*)::text from public.profiles where id = m.bia));
  perform pg_temp.registrar('a participação na marca some', '0', (select count(*)::text from public.brand_members where user_id = m.bia));
  -- A saída é o registro sem capacidades DEPOIS (o acesso acabou). A preparação
  -- também deixou "concedido"/"alterado" dela — todos agora sob o apelido.
  perform pg_temp.registrar('a saída ficou no registro de acesso, com o apelido', '1',
    (select count(*)::text from public.brand_access_log
      where pessoa_email = private.apelido_de_conta_removida(m.bia) and capacidades_depois is null));
  perform pg_temp.registrar('e todo registro de acesso dela está sob o apelido, sem a pessoa', '0',
    (select count(*)::text from public.brand_access_log where pessoa = m.bia));
  perform pg_temp.registrar('as conversas somem', '0', (select count(*)::text from public.conversas where titulo = 'da Bia'));
  perform pg_temp.registrar('a concessão PARA ela termina, e esquece o e-mail', 'revogada/apelido',
    (select situacao || '/' || case when email = private.apelido_de_conta_removida(m.bia) then 'apelido' else email end
       from public.concessoes_de_acesso where id = m.concessao_para_bia));
  perform pg_temp.registrar('a concessão que ela DEU continua, autora esquecida', 'pendente/nulo',
    (select situacao || '/' || coalesce(concedida_por::text, 'nulo') from public.concessoes_de_acesso where id = m.concessao_da_bia));
end $$;

-- ─── 7. Nada do Caio muda ──────────────────────────────────────────────────
do $$
declare m record;
begin
  select * into m from mundo;
  perform pg_temp.registrar('o download do Caio guarda o e-mail dele', 'cr-caio@local.test',
    (select pessoa_email from public.brand_asset_downloads where pessoa = m.caio));
  perform pg_temp.registrar('o Caio continua na marca', '1', (select count(*)::text from public.brand_members where user_id = m.caio));
  perform pg_temp.registrar('a concessão do Caio continua ativa', 'ativa',
    (select situacao from public.concessoes_de_acesso where convertida_para = m.caio));
end $$;

-- ─── Nenhum papel comum alcança as funções novas ───────────────────────────
do $$
declare r text;
begin
  begin
    set local role authenticated;
    perform private.apelido_de_conta_removida(gen_random_uuid());
    r := 'executou';
  exception when others then r := sqlstate;
  end;
  reset role;
  perform pg_temp.registrar('authenticated não executa o apelido', '42501', r);
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
