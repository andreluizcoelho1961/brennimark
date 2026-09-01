-- S0 — a prova de que TRUNCATE falha para quem usa o produto.
--
-- Executado com `set local role authenticated`, e não como `postgres` com
-- claims simuladas: claims dão a identidade, o papel dá os privilégios. Um
-- teste de privilégio que roda como superusuário confirma que o superusuário
-- pode tudo, o que já se sabia.
--
-- Termina em RAISE: tudo é revertido.
do $$
declare
  dono uuid := gen_random_uuid();
  ws uuid;
  r text := '';
  n int;
  tabela text;
begin
  insert into auth.users (id, email, aud, role)
    values (dono, 's0@exemplo.invalid', 'authenticated', 'authenticated');
  insert into public.workspaces (name) values ('conta s0') returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, dono, 'owner');
  perform set_config('request.jwt.claims',
    json_build_object('sub', dono::text, 'role', 'authenticated')::text, true);

  -- 1. TRUNCATE recusado em toda tabela exposta
  foreach tabela in array array[
    'ai_settings','ai_routing_policies','analysis_runs','brand_assets',
    'brand_documents','brands','profiles','brand_imports','brand_deletions'
  ] loop
    set local role authenticated;
    begin
      execute format('truncate table public.%I cascade', tabela);
      r := r || 'TRUNCATE ACEITO em ' || tabela || ': DEFEITO! ';
    exception
      when insufficient_privilege then null;
      when others then r := r || tabela || ': erro inesperado (' || sqlstate || '). ';
    end;
    reset role;
  end loop;
  r := r || 'truncate: recusado em todas. ';

  -- 2. A varredura de grants. Falha se o privilégio reaparecer em qualquer
  --    tabela, inclusive numa criada depois deste arquivo.
  select count(*) into n from information_schema.role_table_grants
   where grantee in ('authenticated','anon') and table_schema = 'public'
     and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER');
  if n > 0 then
    r := r || 'REGRESSAO: ' || n || ' privilegios que contornam RLS. ';
  else
    r := r || 'privilegios que contornam RLS: 0. ';
  end if;

  select count(*) into n from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public';
  r := r || 'grants de anon: ' || n || '. ';

  -- 3. O que o produto precisa continua funcionando
  set local role authenticated;
  begin
    insert into public.brands (workspace_id, key, name, short_name, descriptor, theme, ai)
      values (ws, 'ok', 'OK', 'OK', 'd', '{"background":"#000"}'::jsonb, '{}'::jsonb);
    r := r || 'insert de owner: aceito. ';
  exception when others then
    r := r || 'INSERT NORMAL FALHOU (' || sqlstate || '): DEFEITO. ';
  end;
  begin
    perform 1 from public.workspaces where id = ws;
    r := r || 'select normal: aceito.';
  exception when others then
    r := r || 'SELECT NORMAL FALHOU: DEFEITO.';
  end;
  reset role;

  raise exception 'RESULTADO >> %', r;
end $$;
