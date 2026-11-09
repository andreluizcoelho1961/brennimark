-- Prova do idioma da interface — 23/10/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE e NOME da constraint
-- conferidos onde há recusa, e `rollback` no fim. Três perguntas:
--   1. A conta A não lê, não altera e não cria o idioma da conta B (e o
--      visitante não lê nada).
--   2. A conta A lê e altera o PRÓPRIO idioma.
--   3. A constraint barra idioma fora de pt-BR/en e aceita "ainda não escolheu".

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

create function pg_temp.direto(p_sql text) returns text
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

create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void
language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, p_obtido, p_esperado is not distinct from p_obtido);
$f$;

do $$
declare
  a uuid := 'a0a0a0a0-0000-4000-8000-00000000ea01';
  b uuid := 'b0b0b0b0-0000-4000-8000-00000000eb01';
  c uuid := 'c0c0c0c0-0000-4000-8000-00000000ec01';
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'prova-idioma-a@local.test', 'authenticated', 'authenticated'),
    (b, 'prova-idioma-b@local.test', 'authenticated', 'authenticated'),
    (c, 'prova-idioma-c@local.test', 'authenticated', 'authenticated');
  -- Perfil de A pode nascer pelo gatilho de signup; garante a linha sem duplicar.
  insert into public.profiles (id, email, locale) values (a, 'prova-idioma-a@local.test', null)
    on conflict (id) do update set locale = null;
  insert into public.profiles (id, email, locale) values (b, 'prova-idioma-b@local.test', 'pt-BR')
    on conflict (id) do update set locale = 'pt-BR';

  -- 1. A conta A não alcança o idioma da B.
  perform pg_temp.registrar('A NAO le o idioma de B', '0',
    pg_temp.valor(a, format('select count(*)::text from public.profiles where id = %L', b)));
  perform pg_temp.registrar('A NAO altera o idioma de B (0 linhas)', 'ACEITOU 0',
    pg_temp.como(a, format($s$update public.profiles set locale = 'en' where id = %L$s$, b)));
  perform pg_temp.registrar('o idioma de B continua o que era', 'pt-BR',
    (select locale from public.profiles where id = b));
  perform pg_temp.registrar('A NAO cria perfil com idioma em nome de B/C', '42501',
    pg_temp.como(a, format($s$insert into public.profiles (id, email, locale) values (%L, 'forjado@local.test', 'en')$s$, c)));
  perform pg_temp.registrar('o visitante NAO le perfis', '42501', pg_temp.papel('anon', 'select locale from public.profiles'));
  perform pg_temp.registrar('o visitante NAO altera perfis', '42501',
    pg_temp.papel('anon', $s$update public.profiles set locale = 'en'$s$));

  -- 2. A conta A lê e altera o PRÓPRIO idioma.
  perform pg_temp.registrar('A altera o proprio idioma', 'ACEITOU 1',
    pg_temp.como(a, format($s$update public.profiles set locale = 'en' where id = %L$s$, a)));
  perform pg_temp.registrar('A le o proprio idioma', 'en',
    pg_temp.valor(a, format('select locale from public.profiles where id = %L', a)));
  perform pg_temp.registrar('A volta a "ainda nao escolheu" (null)', 'ACEITOU 1',
    pg_temp.como(a, format($s$update public.profiles set locale = null where id = %L$s$, a)));

  -- 3. A constraint (como superusuário, para chegar nela).
  perform pg_temp.registrar('idioma fora da lista e barrado', '23514 profiles_locale_check',
    pg_temp.direto(format($s$update public.profiles set locale = 'fr' where id = %L$s$, b)));
  perform pg_temp.registrar('maiuscula errada e barrada', '23514 profiles_locale_check',
    pg_temp.direto(format($s$update public.profiles set locale = 'EN' where id = %L$s$, b)));
  perform pg_temp.registrar('texto vazio e barrado', '23514 profiles_locale_check',
    pg_temp.direto(format($s$update public.profiles set locale = '' where id = %L$s$, b)));
  perform pg_temp.registrar('pt-BR e en passam', 'ACEITOU',
    pg_temp.direto(format($s$update public.profiles set locale = 'en' where id = %L$s$, b)));
end $$;

select ordem, caso, esperado, obtido, case when passou then 'ok' else 'FALHOU' end as resultado from resultado order by ordem;

do $$
begin
  if exists (select 1 from resultado where not passou) then
    raise exception 'PROVA FALHOU: % caso(s)', (select count(*) from resultado where not passou);
  end if;
  raise notice 'PROVA OK: % casos', (select count(*) from resultado);
end $$;

rollback;
