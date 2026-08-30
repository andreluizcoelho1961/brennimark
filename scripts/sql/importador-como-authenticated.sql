-- O ciclo do importador, executado com o PAPEL REAL.
--
-- `set local role authenticated` é o que faltava. Definir request.jwt.claims
-- simula auth.uid() e NÃO simula os privilégios do papel: rodando como
-- postgres, grants e RLS são ignorados, e um teste de autorização que roda
-- como superusuário não testa autorização.
--
-- Este arquivo termina em RAISE de propósito: tudo é revertido.
do $$
declare
  dono uuid := gen_random_uuid(); membro uuid := gen_random_uuid();
  ws uuid; marca uuid; r text := ''; n int;
  tema jsonb := '{"background":"#000","backgroundSecondary":"#000","surface":"#111","surfaceLight":"#222","foreground":"#fff","muted":"#999","accent":"#f00","accentSecondary":"#0f0","border":"#333","focus":"#fff"}'::jsonb;
  docs jsonb := '[{"slug":"abertura","group":"Manual","title":"Abertura","status":"draft","body":["t"]}]'::jsonb;
  h1 text := repeat('a',64); h2 text := repeat('b',64);
begin
  insert into auth.users (id, email, aud, role) values (dono,'d@x.invalid','authenticated','authenticated');
  insert into auth.users (id, email, aud, role) values (membro,'m@x.invalid','authenticated','authenticated');
  insert into public.workspaces (name) values ('conta') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, dono, 'owner');
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, membro, 'member');

  perform set_config('request.jwt.claims', json_build_object('sub',dono::text,'role','authenticated')::text, true);
  set local role authenticated;
  select public.publish_brand_import(ws,'m','Marca','Marca','d','pt-BR',
    '{}','{"groups":["Manual"],"defaultDocSlug":"abertura","utilityLinks":[]}',
    tema,'{}','{}',docs, ws::text || '/' || h1 || '.pdf', h1, 3, '{}') into marca;
  reset role;
  r := r || 'owner como authenticated: aceito. ';

  select count(*) into n from public.brand_imports where workspace_id = ws;
  r := r || 'registros: ' || n || '. ';

  perform set_config('request.jwt.claims', json_build_object('sub',membro::text,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.publish_brand_import(ws,'z','Z','Z','d','pt-BR','{}','{}',tema,'{}','{}',docs,
      ws::text || '/' || h2 || '.pdf', h2, 1, '{}');
    r := r || 'MEMBER ACEITO: DEFEITO. ';
  exception when others then r := r || 'member: recusado (' || sqlstate || '). ';
  end;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub',dono::text,'role','authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.publish_brand_import(ws,'y','Y','Y','d','pt-BR','{}','{}',tema,'{}','{}',docs,
      gen_random_uuid()::text || '/' || h2 || '.pdf', h2, 1, '{}');
    r := r || 'CAMINHO ALHEIO ACEITO: DEFEITO. ';
  exception when others then r := r || 'caminho de outra conta: recusado. ';
  end;

  delete from public.brands where id = marca;
  reset role;
  select count(*) into n from public.brand_imports where workspace_id = ws;
  r := r || 'registros apos apagar a marca: ' || n || '.';

  raise exception 'RESULTADO >> %', r;
end $$;

-- ─── Patch 5.3: a fonte precisa existir ────────────────────────────────────
--
-- O que este arquivo NÃO prova, e é honesto dizer: o caso POSITIVO com um
-- objeto de verdade no bucket. Criar esse objeto exige a API do Storage, que
-- não se alcança de dentro do Postgres — e escrever direto em storage.objects
-- criaria metadado sem arquivo, que é exatamente a mentira que a política
-- existe para impedir. Esse caso é o primeiro ciclo autenticado, com sessão.
do $$
declare
  dono uuid := gen_random_uuid(); ws uuid; imp uuid := gen_random_uuid();
  r text := ''; n int;
  tema jsonb := '{"background":"#000","backgroundSecondary":"#000","surface":"#111","surfaceLight":"#222","foreground":"#fff","muted":"#999","accent":"#f00","accentSecondary":"#0f0","border":"#333","focus":"#fff"}'::jsonb;
  docs jsonb := '[{"slug":"a","group":"Manual","title":"A","status":"draft","body":["t"]}]'::jsonb;
  h text := repeat('a',64);
begin
  insert into auth.users (id, email, aud, role) values (dono,'d@x.invalid','authenticated','authenticated');
  insert into public.workspaces (name) values ('conta') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, dono, 'owner');
  perform set_config('request.jwt.claims', json_build_object('sub',dono::text,'role','authenticated')::text, true);

  set local role authenticated;
  begin
    perform public.publish_brand_import(ws, imp, 'm','M','M','d','pt-BR','{}','{}',tema,'{}','{}',docs,h,1,'{}');
    r := r || 'FONTE AUSENTE ACEITA: DEFEITO. ';
  exception when others then r := r || 'rpc sem objeto: recusada (' || sqlstate || '). ';
  end;
  reset role;
  select count(*) into n from public.brands where workspace_id = ws;
  r := r || 'marcas deixadas: ' || n || '. ';

  set local role authenticated;
  begin
    insert into public.brand_imports (workspace_id, import_id, storage_path, pdf_sha256,
      page_count, document_count, created_by)
    values (ws, imp, ws::text || '/' || imp::text || '/' || h || '.pdf', h, 1, 1, dono);
    r := r || 'INSERCAO DIRETA ACEITA: DEFEITO. ';
  exception when others then r := r || 'insercao direta sem objeto: recusada (' || sqlstate || '). ';
  end;
  reset role;

  set local role authenticated;
  begin
    delete from public.brand_imports where workspace_id = ws;
    r := r || 'DELETE DIRETO ACEITO: DEFEITO. ';
  exception when others then r := r || 'delete direto: recusado (' || sqlstate || ').';
  end;
  reset role;

  raise exception 'RESULTADO >> %', r;
end $$;
