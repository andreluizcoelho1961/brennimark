-- Prova do consumo da conta — Configurações › Consumo — 30/09/2026.
--
-- A tela lê `ai_ledger`, `ai_budgets` e `consumo_de_armazenamento` com a
-- sessão de quem pede, sem chave de serviço. Quem vê o quê é o banco. Mesmo
-- método das outras provas: mundo próprio, SQLSTATE conferido onde há recusa,
-- e `rollback` no fim.
--
-- Quatro perguntas (condição 2 do ADR-0003: o teste NEGATIVO, não só o positivo):
--   1. O dono lê o consumo da própria conta — o razão, os limites e o
--      armazenamento, inclusive o que é da conta sem marca.
--   2. O dono de OUTRA conta não lê nada dela, e ela não lê nada da outra.
--   3. Quem só consulta não lê nada; quem administra UMA marca lê só o dessa
--      marca — nem o de outra marca, nem o da conta, nem o armazenamento.
--   4. Ninguém da conta escreve: nem limite, nem razão, nem armazenamento; e
--      o visitante não lê.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create temp table mundo (dono1 uuid, dono2 uuid, leitor uuid, admin_a uuid, w1 uuid, w2 uuid, marca_a uuid, marca_b uuid, marca_c uuid);

create function pg_temp.como(p_quem uuid, p_sql text, out estado text)
language plpgsql as $f$
declare n integer;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_quem, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    execute p_sql;
    get diagnostics n = row_count;
    estado := 'ACEITOU ' || n;
    execute 'reset role';
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
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

-- A reserva como o servidor a chama (chave de serviço): é assim que o razão nasce.
create function pg_temp.reserva(p_quem uuid, p_conta uuid, p_marca uuid) returns text
language plpgsql as $f$
declare r record;
begin
  select * into r from public.reservar_execucao_de_ia_server(p_quem, p_conta, p_marca, gen_random_uuid(), 'assist', 10, 'USD', null);
  return r.ok || ' ' || r.motivo;
end $f$;

-- Quantas linhas a pessoa enxerga de uma tabela, numa conta (e, se dada, numa marca).
create function pg_temp.enxerga(p_quem uuid, p_tabela text, p_conta uuid, p_marca uuid default null) returns text
language plpgsql as $f$
begin
  return pg_temp.valor(p_quem, format(
    'select count(*)::text from public.%I where workspace_id = %L %s',
    p_tabela, p_conta, case when p_marca is null then '' else format('and brand_id = %L', p_marca) end));
end $f$;

-- ─── O mundo ────────────────────────────────────────────────────────────────
do $$
declare
  u1 uuid := 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c00001';
  u2 uuid := 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c00002';
  u_leitor uuid := 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c00003';
  u_admin uuid := 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c00004';
  w1 uuid; w2 uuid; a uuid; b uuid; c uuid;
begin
  insert into auth.users (id, email, aud, role) values
    (u1, 'prova-consumo-dono1@local.test', 'authenticated', 'authenticated'),
    (u2, 'prova-consumo-dono2@local.test', 'authenticated', 'authenticated'),
    (u_leitor, 'prova-consumo-leitor@local.test', 'authenticated', 'authenticated'),
    (u_admin, 'prova-consumo-admin@local.test', 'authenticated', 'authenticated');
  -- O gatilho do #64 dá às contas os limites padrão (dia e mês).
  insert into public.workspaces (name, slug) values ('Prova Consumo 1', 'prova-consumo-1') returning id into w1;
  insert into public.workspaces (name, slug) values ('Prova Consumo 2', 'prova-consumo-2') returning id into w2;
  insert into public.workspace_members (workspace_id, user_id, role) values (w1, u1, 'owner'), (w2, u2, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w1, 'consumo-a', 'Marca A', 'A', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w1, 'consumo-b', 'Marca B', 'B', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into b;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal) values
    (w2, 'consumo-c', 'Marca C', 'C', 'x', 'pt-BR', '{}','{}','{}','{}','{}') returning id into c;
  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades) values
    (a, w1, u_leitor, array['consultar']),
    (a, w1, u_admin, array['consultar', 'editar', 'aprovar', 'administrar']),
    (b, w1, u_admin, array['consultar'])
  on conflict (brand_id, user_id) do update set capacidades = excluded.capacidades;

  -- Uma linha de limite só para a trava da marca A (como o Console cria).
  insert into public.ai_budgets (workspace_id, brand_id, period, limit_micros, currency, kill_switch)
    values (w1, a, 'daily', null, 'USD', true);

  -- Armazenamento: da marca A, da marca B, da conta 1 sem marca, e da conta 2.
  insert into public.consumo_de_armazenamento (dia, workspace_id, brand_id, bucket_id, objetos, bytes) values
    (current_date, w1, a, 'brand-imports', 1, 1000),
    (current_date, w1, b, 'brand-assets', 2, 200),
    (current_date, w1, null, 'brand-imports', 1, 7),
    (current_date, w2, c, 'brand-imports', 1, 9);

  insert into mundo values (u1, u2, u_leitor, u_admin, w1, w2, a, b, c);
end $$;

-- O razão nasce como na vida: pela reserva. A trava da marca A barra a
-- reserva nela, então o uso de A entra ANTES da trava ser ligada.
do $$
declare m mundo;
begin
  select * into m from mundo;
  update public.ai_budgets set kill_switch = false where brand_id = m.marca_a;
  perform pg_temp.registrar('reserva 1 na marca A', 'true reservado', pg_temp.reserva(m.dono1, m.w1, m.marca_a));
  perform pg_temp.registrar('reserva 2 na marca A', 'true reservado', pg_temp.reserva(m.dono1, m.w1, m.marca_a));
  perform pg_temp.registrar('reserva na marca B', 'true reservado', pg_temp.reserva(m.dono1, m.w1, m.marca_b));
  perform pg_temp.registrar('reserva na marca C (conta 2)', 'true reservado', pg_temp.reserva(m.dono2, m.w2, m.marca_c));
  update public.ai_budgets set kill_switch = true where brand_id = m.marca_a;
end $$;

-- ─── 1. O dono lê a própria conta ───────────────────────────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  perform pg_temp.registrar('dono 1 le o razao da conta 1 (3 pedidos)', '3', pg_temp.enxerga(m.dono1, 'ai_ledger', m.w1));
  perform pg_temp.registrar('dono 1 le os limites da conta 1 (dia, mes e a trava de A)', '3', pg_temp.enxerga(m.dono1, 'ai_budgets', m.w1));
  perform pg_temp.registrar('dono 1 ve a trava da marca A ligada', 'true',
    pg_temp.valor(m.dono1, format('select kill_switch::text from public.ai_budgets where brand_id = %L', m.marca_a)));
  perform pg_temp.registrar('dono 1 le o armazenamento da conta 1, com o sem marca', '3', pg_temp.enxerga(m.dono1, 'consumo_de_armazenamento', m.w1));
  perform pg_temp.registrar('e soma os bytes certos', '1207',
    pg_temp.valor(m.dono1, format('select sum(bytes)::text from public.consumo_de_armazenamento where workspace_id = %L', m.w1)));
end $$;

-- ─── 2. Uma conta não lê a outra ────────────────────────────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  perform pg_temp.registrar('dono 2 NAO le o razao da conta 1', '0', pg_temp.enxerga(m.dono2, 'ai_ledger', m.w1));
  perform pg_temp.registrar('dono 2 NAO le os limites da conta 1', '0', pg_temp.enxerga(m.dono2, 'ai_budgets', m.w1));
  perform pg_temp.registrar('dono 2 NAO le o armazenamento da conta 1', '0', pg_temp.enxerga(m.dono2, 'consumo_de_armazenamento', m.w1));
  perform pg_temp.registrar('dono 1 NAO le o razao da conta 2', '0', pg_temp.enxerga(m.dono1, 'ai_ledger', m.w2));
  perform pg_temp.registrar('dono 1 NAO le os limites da conta 2', '0', pg_temp.enxerga(m.dono1, 'ai_budgets', m.w2));
  perform pg_temp.registrar('dono 1 NAO le o armazenamento da conta 2', '0', pg_temp.enxerga(m.dono1, 'consumo_de_armazenamento', m.w2));
  -- O contraponto: sem ele, os zeros acima passariam com a conta 2 vazia.
  perform pg_temp.registrar('dono 2 le a propria conta 2', '1', pg_temp.enxerga(m.dono2, 'ai_ledger', m.w2));
end $$;

-- ─── 3. Quem só consulta, e quem administra uma marca só ────────────────────
do $$
declare m mundo;
begin
  select * into m from mundo;
  perform pg_temp.registrar('quem so consulta NAO le o razao', '0', pg_temp.enxerga(m.leitor, 'ai_ledger', m.w1));
  perform pg_temp.registrar('quem so consulta NAO le os limites', '0', pg_temp.enxerga(m.leitor, 'ai_budgets', m.w1));
  perform pg_temp.registrar('quem so consulta NAO le o armazenamento', '0', pg_temp.enxerga(m.leitor, 'consumo_de_armazenamento', m.w1));

  perform pg_temp.registrar('quem administra A le o razao de A', '2', pg_temp.enxerga(m.admin_a, 'ai_ledger', m.w1, m.marca_a));
  perform pg_temp.registrar('e NAO le o razao de B, onde so consulta', '0', pg_temp.enxerga(m.admin_a, 'ai_ledger', m.w1, m.marca_b));
  perform pg_temp.registrar('quem administra A le so o limite de A, nao o da conta', '1', pg_temp.enxerga(m.admin_a, 'ai_budgets', m.w1));
  perform pg_temp.registrar('quem administra A NAO le o armazenamento (e da conta)', '0', pg_temp.enxerga(m.admin_a, 'consumo_de_armazenamento', m.w1));
end $$;

-- ─── 4. Ninguém da conta escreve; o visitante não lê ────────────────────────
do $$
declare m mundo; t record;
begin
  select * into m from mundo;
  select * into t from pg_temp.como(m.dono1, format('update public.ai_budgets set limit_micros = 999999999 where workspace_id = %L and brand_id is null', m.w1));
  perform pg_temp.registrar('dono NAO sobe o proprio limite', '42501', t.estado);
  select * into t from pg_temp.como(m.dono1, format('update public.ai_budgets set kill_switch = false where brand_id = %L', m.marca_a));
  perform pg_temp.registrar('dono NAO desliga a trava da propria marca', '42501', t.estado);
  select * into t from pg_temp.como(m.dono1, format('delete from public.ai_ledger where workspace_id = %L', m.w1));
  perform pg_temp.registrar('dono NAO apaga o proprio razao', '42501', t.estado);
  select * into t from pg_temp.como(m.dono1, format('update public.consumo_de_armazenamento set bytes = 0 where workspace_id = %L', m.w1));
  perform pg_temp.registrar('dono NAO zera o proprio armazenamento', '42501', t.estado);
  perform pg_temp.registrar('visitante NAO le o razao', '42501', pg_temp.papel('anon', 'select 1 from public.ai_ledger limit 1'));
  perform pg_temp.registrar('visitante NAO le os limites', '42501', pg_temp.papel('anon', 'select 1 from public.ai_budgets limit 1'));
  perform pg_temp.registrar('visitante NAO le o armazenamento', '42501', pg_temp.papel('anon', 'select 1 from public.consumo_de_armazenamento limit 1'));
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
