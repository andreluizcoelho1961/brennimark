-- Prova dos registros de acesso e dos aceites — 07/10/2026.
--
-- Mesmo método das outras provas: mundo próprio, SQLSTATE conferido onde há
-- recusa, e `rollback` no fim. Três perguntas:
--   1. Registros de acesso: ninguém pela sessão (nem o próprio dono) lê,
--      escreve, altera ou apaga; o visitante também não; só o servidor grava.
--   2. Aceites: cada pessoa lê SÓ os próprios — A não vê os de B; ninguém pela
--      sessão escreve; as constraints barram documento, versão e origem fora
--      do vocabulário; a pessoa sair leva os aceites dela.
--   3. A limpeza dos 6 meses apaga só o que passou do prazo, só o servidor a
--      chama, e a pessoa sair NÃO apaga o registro de acesso.

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
  a uuid := 'a0a0a0a0-0000-4000-8000-00000000ac01';
  b uuid := 'b0b0b0b0-0000-4000-8000-00000000ac02';
  quantos text;
begin
  insert into auth.users (id, email, aud, role) values
    (a, 'prova-aceite-a@local.test', 'authenticated', 'authenticated'),
    (b, 'prova-aceite-b@local.test', 'authenticated', 'authenticated');

  -- O servidor grava (service_role), como o proxy e as rotas da senha fazem.
  perform pg_temp.registrar('o servidor grava registro de acesso', 'ACEITOU',
    pg_temp.papel('service_role', format($s$insert into public.registros_de_acesso (user_id, ip) values (%L, '203.0.113.7')$s$, a)));
  perform pg_temp.registrar('o servidor grava aceite', 'ACEITOU',
    pg_temp.papel('service_role', format($s$insert into public.aceites_de_documentos (user_id, documento, versao, origem, ip) values
      (%L, 'termos', '2026-10-08', 'primeiro-acesso', '203.0.113.7'), (%L, 'privacidade', '2026-10-08', 'compra', null)$s$, a, b)));

  -- 1. Registros de acesso: sigilo.
  perform pg_temp.registrar('o dono NAO le os proprios registros de acesso', '42501',
    pg_temp.como(a, 'select * from public.registros_de_acesso'));
  perform pg_temp.registrar('ninguem pela sessao grava registro de acesso (nem inventando o IP)', '42501',
    pg_temp.como(a, format($s$insert into public.registros_de_acesso (user_id, ip) values (%L, '198.51.100.1')$s$, a)));
  perform pg_temp.registrar('ninguem pela sessao apaga registro de acesso', '42501',
    pg_temp.como(a, 'delete from public.registros_de_acesso'));
  perform pg_temp.registrar('ninguem pela sessao altera registro de acesso', '42501',
    pg_temp.como(a, $s$update public.registros_de_acesso set ip = '198.51.100.1'$s$));
  perform pg_temp.registrar('o visitante nao le registro de acesso', '42501',
    pg_temp.papel('anon', 'select * from public.registros_de_acesso'));

  -- 2. Aceites: cada um os seus.
  quantos := pg_temp.valor(a, 'select count(*)::text from public.aceites_de_documentos');
  perform pg_temp.registrar('A le o proprio aceite', '1', quantos);
  perform pg_temp.registrar('A NAO ve o aceite de B', '0',
    pg_temp.valor(a, format('select count(*)::text from public.aceites_de_documentos where user_id = %L', b)));
  perform pg_temp.registrar('B NAO ve o aceite de A', '0',
    pg_temp.valor(b, format('select count(*)::text from public.aceites_de_documentos where user_id = %L', a)));
  perform pg_temp.registrar('ninguem pela sessao grava aceite (nem o proprio)', '42501',
    pg_temp.como(a, format($s$insert into public.aceites_de_documentos (user_id, documento, versao, origem) values (%L, 'termos', '2026-10-08', 'compra')$s$, a)));
  perform pg_temp.registrar('ninguem pela sessao apaga aceite', '42501',
    pg_temp.como(a, 'delete from public.aceites_de_documentos'));
  perform pg_temp.registrar('ninguem pela sessao altera a versao aceita', '42501',
    pg_temp.como(a, $s$update public.aceites_de_documentos set versao = '2099-01-01'$s$));
  perform pg_temp.registrar('o visitante nao le aceite', '42501',
    pg_temp.papel('anon', 'select * from public.aceites_de_documentos'));
  perform pg_temp.registrar('documento fora do vocabulario e barrado', '23514 aceites_documento_valido',
    pg_temp.direto(format($s$insert into public.aceites_de_documentos (user_id, documento, versao, origem) values (%L, 'contrato', '2026-10-08', 'compra')$s$, a)));
  perform pg_temp.registrar('versao fora do formato de data e barrada', '23514 aceites_versao_em_data',
    pg_temp.direto(format($s$insert into public.aceites_de_documentos (user_id, documento, versao, origem) values (%L, 'termos', 'v2', 'compra')$s$, a)));
  perform pg_temp.registrar('origem fora do vocabulario e barrada', '23514 aceites_origem_valida',
    pg_temp.direto(format($s$insert into public.aceites_de_documentos (user_id, documento, versao, origem) values (%L, 'termos', '2026-10-08', 'site')$s$, a)));

  -- 3. A limpeza dos 6 meses.
  insert into public.registros_de_acesso (user_id, ip, acessado_em) values
    (a, '203.0.113.8', now() - interval '6 months' - interval '1 day'),
    (a, '203.0.113.9', now() - interval '6 months' + interval '1 day');
  perform pg_temp.registrar('a sessao NAO chama a limpeza', '42501',
    pg_temp.como(a, 'select public.limpar_registros_de_acesso()'));
  perform pg_temp.papel('service_role', 'select public.limpar_registros_de_acesso()');
  perform pg_temp.registrar('a limpeza apagou so o que passou de 6 meses', '0',
    (select count(*)::text from public.registros_de_acesso where user_id = a and ip = '203.0.113.8'));
  perform pg_temp.registrar('e manteve o que esta dentro do prazo', '2',
    (select count(*)::text from public.registros_de_acesso where user_id = a));

  -- A pessoa sair: o registro de acesso fica (sem o dono), o aceite vai junto.
  delete from auth.users where id = a;
  perform pg_temp.registrar('a pessoa sair NAO apaga o registro de acesso', '2',
    (select count(*)::text from public.registros_de_acesso where ip in ('203.0.113.7', '203.0.113.9') and user_id is null));
  perform pg_temp.registrar('a pessoa sair leva os aceites dela', '0',
    (select count(*)::text from public.aceites_de_documentos where versao = '2026-10-08' and documento = 'termos' and origem = 'primeiro-acesso'));
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
