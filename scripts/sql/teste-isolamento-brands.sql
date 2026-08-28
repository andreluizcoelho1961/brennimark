-- Teste de isolamento negativo da tabela `brands`.
--
-- Condição 2 do ADR-0003: toda tabela nova nasce com RLS E teste de
-- autorização negativo. Provar que a conta A lê a própria marca não basta —
-- é preciso provar que ela NÃO lê a da conta B.
--
-- Com banco compartilhado, o isolamento entre clientes deixa de ser físico.
-- Este teste é o que resta defendendo a fronteira.
--
-- Semeia, testa e limpa dentro de uma transação: não deixa resíduo.
-- Falha com `raise exception`, então erro = teste reprovado.
--
-- Uso: rodar no SQL Editor do projeto. Precisa de duas contas com donos
-- diferentes; ajuste os identificadores abaixo se rodar em outro ambiente.

begin;

do $$
declare
  ws_a uuid;
  ws_b uuid;
  user_a uuid;
  brand_a uuid;
  brand_b uuid;
  visiveis int;
  alheias int;
  escreveu boolean := false;
begin
  -- Duas contas com donos distintos.
  select m.workspace_id, m.user_id into ws_a, user_a
  from public.workspace_members m where m.role = 'owner' order by m.created_at limit 1;

  select m.workspace_id into ws_b
  from public.workspace_members m
  where m.role = 'owner' and m.workspace_id <> ws_a and m.user_id <> user_a
  limit 1;

  if ws_b is null then
    raise exception 'PULADO: o ambiente nao tem duas contas com donos diferentes';
  end if;

  insert into public.brands (workspace_id, key, name, short_name, descriptor, theme, ai)
  values (ws_a, 'iso-a', 'Marca A', 'A', 'semente de teste', '{}'::jsonb, '{}'::jsonb)
  returning id into brand_a;

  insert into public.brands (workspace_id, key, name, short_name, descriptor, theme, ai)
  values (ws_b, 'iso-b', 'Marca B', 'B', 'semente de teste', '{}'::jsonb, '{}'::jsonb)
  returning id into brand_b;

  -- Passa a agir como a pessoa da conta A, do jeito que o PostgREST faz.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  select count(*) into visiveis from public.brands;
  select count(*) into alheias from public.brands where workspace_id = ws_b;

  if alheias <> 0 then
    raise exception 'FALHA CRITICA: conta A enxergou % marca(s) da conta B', alheias;
  end if;
  if visiveis < 1 then
    raise exception 'FALHA: conta A nao enxergou a propria marca';
  end if;

  begin
    insert into public.brands (workspace_id, key, name, short_name, descriptor, theme, ai)
    values (ws_b, 'invasao', 'Invasao', 'X', 'nao deveria entrar', '{}'::jsonb, '{}'::jsonb);
    escreveu := true;
  exception when others then
    escreveu := false;
  end;

  if escreveu then
    raise exception 'FALHA CRITICA: conta A criou marca na conta B';
  end if;

  perform set_config('role', 'postgres', true);
  raise notice 'OK: isolamento entre contas verificado em `brands`';
end $$;

rollback;
