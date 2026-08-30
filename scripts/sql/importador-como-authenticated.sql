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
