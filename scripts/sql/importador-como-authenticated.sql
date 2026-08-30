-- O ciclo do importador, executado com o PAPEL REAL.
--
-- `set local role authenticated` é o que faltava na primeira versão deste
-- arquivo. Definir request.jwt.claims simula auth.uid() e NÃO simula os
-- privilégios do papel: rodando como postgres, grants e RLS são ignorados, e
-- um teste de autorização que roda como superusuário não testa autorização.
--
-- Este arquivo acompanha a assinatura ATUAL de publish_brand_import — com
-- import_id e sem storage_path. A versão anterior ficou inválida quando a
-- migração 20260830120000 removeu a assinatura antiga, e um artefato
-- reproduzível que não roda é pior que nenhum: ele afirma uma execução que já
-- não acontece.
--
-- Termina em RAISE de propósito: tudo é revertido.
--
-- O QUE ELE NÃO PROVA: o caso POSITIVO com um objeto de verdade no bucket.
-- Criar esse objeto exige a API do Storage, que não se alcança de dentro do
-- Postgres — e escrever direto em storage.objects criaria metadado sem
-- arquivo, que é exatamente a mentira que a política existe para impedir.
-- Esse caso é o primeiro ciclo autenticado, pela interface.
do $$
declare
  dono uuid := gen_random_uuid();
  membro uuid := gen_random_uuid();
  ws uuid;
  imp uuid := gen_random_uuid();
  r text := '';
  n int;
  tema jsonb := '{"background":"#000","backgroundSecondary":"#000","surface":"#111","surfaceLight":"#222","foreground":"#fff","muted":"#999","accent":"#f00","accentSecondary":"#0f0","border":"#333","focus":"#fff"}'::jsonb;
  docs jsonb := '[{"slug":"abertura","group":"Manual","title":"Abertura","status":"draft","body":["t"]}]'::jsonb;
  h text := repeat('a', 64);
  caminho text;
begin
  insert into auth.users (id, email, aud, role)
    values (dono, 'dono@exemplo.invalid', 'authenticated', 'authenticated');
  insert into auth.users (id, email, aud, role)
    values (membro, 'membro@exemplo.invalid', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('conta') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, dono, 'owner');
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, membro, 'member');
  caminho := ws::text || '/' || imp::text || '/' || h || '.pdf';

  -- ── 1. A fonte precisa existir ─────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.publish_brand_import(
      ws, imp, 'm', 'Marca', 'Marca', 'descritor', 'pt-BR',
      '{}', '{"groups":["Manual"],"defaultDocSlug":"abertura","utilityLinks":[]}',
      tema, '{}', '{}', docs, h, 3, '{}');
    r := r || 'FONTE AUSENTE ACEITA: DEFEITO. ';
  exception when others then
    r := r || 'rpc sem objeto: recusada (' || sqlstate || '). ';
  end;
  reset role;
  select count(*) into n from public.brands where workspace_id = ws;
  r := r || 'marcas deixadas: ' || n || '. ';

  -- ── 2. A tabela também recusa, sem passar pela função ──────────────────
  set local role authenticated;
  begin
    insert into public.brand_imports (workspace_id, import_id, storage_path, pdf_sha256,
      page_count, document_count, created_by)
    values (ws, imp, caminho, h, 1, 1, dono);
    r := r || 'INSERCAO DIRETA ACEITA: DEFEITO. ';
  exception when others then
    r := r || 'insercao direta sem objeto: recusada (' || sqlstate || '). ';
  end;
  reset role;

  -- ── 3. Member não importa ──────────────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', membro::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.publish_brand_import(
      ws, gen_random_uuid(), 'z', 'Z', 'Z', 'd', 'pt-BR',
      '{}', '{}', tema, '{}', '{}', docs, repeat('b', 64), 1, '{}');
    r := r || 'MEMBER ACEITO: DEFEITO. ';
  exception when others then
    r := r || 'member: recusado (' || sqlstate || '). ';
  end;
  reset role;

  -- ── 4. Apagar a procedência sem apagar o arquivo ───────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    delete from public.brand_imports where workspace_id = ws;
    r := r || 'DELETE DIRETO ACEITO: DEFEITO. ';
  exception when others then
    r := r || 'delete direto na procedencia: recusado (' || sqlstate || '). ';
  end;
  reset role;

  -- ── 5. A fila de limpeza aceita importação abandonada ──────────────────
  set local role authenticated;
  perform public.enqueue_import_cleanup(ws, imp, h);
  reset role;
  select count(*) into n from public.brand_deletions where workspace_id = ws;
  r := r || 'pendencias enfileiradas: ' || n || '. ';

  -- E é idempotente: repetir não duplica.
  set local role authenticated;
  perform public.enqueue_import_cleanup(ws, imp, h);
  reset role;
  select count(*) into n from public.brand_deletions where workspace_id = ws;
  r := r || 'apos repetir: ' || n || '. ';

  -- ── 6. Member não enfileira limpeza na conta ───────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', membro::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.enqueue_import_cleanup(ws, gen_random_uuid(), h);
    r := r || 'MEMBER ENFILEIROU: DEFEITO. ';
  exception when others then
    r := r || 'member na limpeza: recusado (' || sqlstate || '). ';
  end;
  reset role;

  -- ── 7. Excluir marca inexistente é erro nomeado, não silêncio ──────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono::text, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.delete_brand_with_files(gen_random_uuid());
    r := r || 'MARCA INEXISTENTE ACEITA: DEFEITO.';
  exception when sqlstate 'P0002' then
    r := r || 'marca inexistente: P0002, que a rota trata como ja excluida.';
  end;
  reset role;

  raise exception 'RESULTADO >> %', r;
end $$;
