-- Prova do limite de taxa (auditoria 09/11/2026, A1).
--
--   A. Dentro do limite passa; a chamada seguinte ao limite é barrada.
--   B. Chaves diferentes não dividem contador (IP A não gasta o de IP B).
--   C. Janelas diferentes não dividem contador (a contagem se renova).
--   D. Autorização NEGATIVA: anon e authenticated não executam a função nem leem a tabela (SQLSTATE 42501).
--   E. Parâmetros inválidos recusam com 22023; a constraint de tamanho da chave tem o nome exato.
--
-- Mundo próprio, `rollback` no fim.
\set ON_ERROR_STOP on
\pset pager off
begin;

create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;
create function pg_temp.como(p_papel text, p_sql text) returns text language plpgsql as $f$
declare r text;
begin
  execute format('set local role %I', p_papel);
  begin execute p_sql into r; exception when others then r := 'ERRO ' || sqlstate; end;
  reset role;
  return r;
end $f$;

-- A
select pg_temp.registrar('A1 1ª tentativa passa', 'true', public.limite_de_taxa_tentar('prova:a', 3, 3600)::text);
select pg_temp.registrar('A2 2ª tentativa passa', 'true', public.limite_de_taxa_tentar('prova:a', 3, 3600)::text);
select pg_temp.registrar('A3 3ª tentativa (no limite) passa', 'true', public.limite_de_taxa_tentar('prova:a', 3, 3600)::text);
select pg_temp.registrar('A4 4ª tentativa é barrada', 'false', public.limite_de_taxa_tentar('prova:a', 3, 3600)::text);
select pg_temp.registrar('A5 5ª continua barrada', 'false', public.limite_de_taxa_tentar('prova:a', 3, 3600)::text);

-- B
select pg_temp.registrar('B1 outra chave não herda o gasto', 'true', public.limite_de_taxa_tentar('prova:b', 3, 3600)::text);

-- C: uma janela antiga com contagem estourada não conta na janela atual
insert into public.limites_de_taxa (chave, janela, contagem) values ('prova:c', now() - interval '1 day', 999);
select pg_temp.registrar('C1 janela antiga não conta', 'true', public.limite_de_taxa_tentar('prova:c', 3, 3600)::text);

-- D
select pg_temp.registrar('D1 anon não executa a função', 'ERRO 42501',
  pg_temp.como('anon', $q$select public.limite_de_taxa_tentar('prova:d', 3, 3600)::text$q$));
select pg_temp.registrar('D2 authenticated não executa a função', 'ERRO 42501',
  pg_temp.como('authenticated', $q$select public.limite_de_taxa_tentar('prova:d', 3, 3600)::text$q$));
select pg_temp.registrar('D3 anon não lê a tabela', 'ERRO 42501',
  pg_temp.como('anon', $q$select count(*)::text from public.limites_de_taxa$q$));
select pg_temp.registrar('D4 authenticated não lê a tabela', 'ERRO 42501',
  pg_temp.como('authenticated', $q$select count(*)::text from public.limites_de_taxa$q$));
select pg_temp.registrar('D5 authenticated não escreve na tabela', 'ERRO 42501',
  pg_temp.como('authenticated', $q$insert into public.limites_de_taxa (chave, janela, contagem) values ('prova:x', now(), 1)$q$));
select pg_temp.registrar('D6 service_role executa', 'true',
  pg_temp.como('service_role', $q$select public.limite_de_taxa_tentar('prova:s', 3, 3600)::text$q$));

-- E
select pg_temp.registrar('E1 limite zero recusa', 'ERRO 22023', pg_temp.como('postgres', $q$select public.limite_de_taxa_tentar('prova:e', 0, 3600)::text$q$));
select pg_temp.registrar('E2 janela enorme recusa', 'ERRO 22023', pg_temp.como('postgres', $q$select public.limite_de_taxa_tentar('prova:e', 1, 999999)::text$q$));
select pg_temp.registrar('E3 chave curta recusa', 'ERRO 22023', pg_temp.como('postgres', $q$select public.limite_de_taxa_tentar('ab', 1, 60)::text$q$));
do $$ declare r text; begin
  begin insert into public.limites_de_taxa (chave, janela) values ('x', now()); r := 'sem erro';
  exception when check_violation then get stacked diagnostics r = constraint_name; end;
  perform pg_temp.registrar('E4 chave curta barrada pela constraint', 'limites_de_taxa_chave_check', r);
end $$;

select ordem, caso, esperado, obtido, case when passou then 'OK' else 'FALHA' end as resultado from resultado order by ordem;
select case when count(*) filter (where not passou) = 0 then 'TODOS OS ' || count(*) || ' CASOS PASSARAM' else count(*) filter (where not passou) || ' FALHA(S)' end as resumo from resultado;
do $$ begin if exists (select 1 from resultado where not passou) then raise exception 'prova falhou'; end if; end $$;
rollback;
