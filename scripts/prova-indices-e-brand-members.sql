-- Prova da migration de índices, chave e policy de brand_members (auditoria 09/11/2026).
--   A. Os 3 índices de cobertura e a chave primária existem (pelo NOME EXATO).
--   B. brand_members, depois de unir as policies de SELECT:
--      B1 a pessoa vê o PRÓPRIO acesso; B2 a dona da conta vê o acesso de outra pessoa na conta;
--      B3 NEGATIVO: a dona da conta A NÃO vê acessos da conta B; B4 NEGATIVO: um membro comum NÃO vê
--      o acesso dos outros; B5 só existe 1 policy de SELECT na tabela.
--   C. A linha de consumo ganha `id` e o upsert diário continua funcionando.
-- Mundo próprio, `rollback`. A transação e a migration são abertas pelo .sh.
create temp table resultado (ordem serial, caso text, esperado text, obtido text, passou boolean);
create function pg_temp.registrar(p_caso text, p_esperado text, p_obtido text) returns void language sql as $f$
  insert into resultado (caso, esperado, obtido, passou) values (p_caso, p_esperado, coalesce(p_obtido,'(nulo)'), p_esperado = coalesce(p_obtido,'(nulo)'));
$f$;
create function pg_temp.contar_como(p_pessoa uuid, p_sql text) returns text language plpgsql as $f$
declare v text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_pessoa, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  execute p_sql into v;
  execute 'reset role';
  return v;
end $f$;

do $$
declare
  da uuid := 'a4a4a4a4-0000-4000-8000-0000000f0001'; -- dona da conta P
  m1 uuid := 'a4a4a4a4-0000-4000-8000-0000000f0002'; -- membra comum de P (marca 1)
  m2 uuid := 'a4a4a4a4-0000-4000-8000-0000000f0003'; -- membra comum de P (marca 1)
  db uuid := 'a4a4a4a4-0000-4000-8000-0000000f0004'; -- dona da conta Q
  p uuid; q uuid; bp uuid; bq uuid;
begin
  insert into auth.users (id, email, aud, role) select u, 'prova-bm-' || right(u::text, 2) || '@local.test', 'authenticated', 'authenticated' from unnest(array[da, m1, m2, db]) u;
  insert into public.workspaces (name) values ('Prova BM P') returning id into p;
  insert into public.workspaces (name) values ('Prova BM Q') returning id into q;
  insert into public.workspace_members (workspace_id, user_id, role) values (p, da, 'owner'), (p, m1, 'member'), (p, m2, 'member'), (q, db, 'owner');
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
    values (p, 'prova-bm-p', 'P', 'P', 'p', 'pt-BR', '{}', '{}', '{}', '{}', '{}') returning id into bp;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language, metadata, navigation, theme, ai, legal)
    values (q, 'prova-bm-q', 'Q', 'Q', 'q', 'pt-BR', '{}', '{}', '{}', '{}', '{}') returning id into bq;
  insert into public.brand_members (brand_id, workspace_id, user_id) values (bp, p, m1), (bp, p, m2), (bq, q, db);

  perform pg_temp.registrar('A1 índice analysis_runs', '1', (select count(*)::text from pg_indexes where indexname = 'analysis_runs_brand_workspace_idx'));
  perform pg_temp.registrar('A2 índice brand_chunks', '1', (select count(*)::text from pg_indexes where indexname = 'brand_chunks_brand_workspace_idx'));
  perform pg_temp.registrar('A3 índice ai_ledger', '1', (select count(*)::text from pg_indexes where indexname = 'ai_ledger_brand_workspace_idx'));
  perform pg_temp.registrar('A4 chave primária do consumo', '1', (select count(*)::text from pg_constraint where conname = 'consumo_de_armazenamento_pkey' and contype = 'p'));

  perform pg_temp.registrar('B1 a pessoa vê o próprio acesso', '1', pg_temp.contar_como(m1, format('select count(*)::text from public.brand_members where user_id = %L', m1)));
  perform pg_temp.registrar('B2 a dona vê os acessos da própria conta', '2', pg_temp.contar_como(da, format('select count(*)::text from public.brand_members where workspace_id = %L', p)));
  perform pg_temp.registrar('B3 NEGATIVO: a dona de P não vê acessos de Q', '0', pg_temp.contar_como(da, format('select count(*)::text from public.brand_members where workspace_id = %L', q)));
  perform pg_temp.registrar('B4 NEGATIVO: membra comum não vê o acesso da colega', '0', pg_temp.contar_como(m1, format('select count(*)::text from public.brand_members where user_id = %L', m2)));
  perform pg_temp.registrar('B4b NEGATIVO: a dona de Q não vê acessos de P', '0', pg_temp.contar_como(db, format('select count(*)::text from public.brand_members where workspace_id = %L', p)));
  perform pg_temp.registrar('B5 uma só policy de SELECT em brand_members', '1', (select count(*)::text from pg_policy where polrelid = 'public.brand_members'::regclass and polcmd = 'r'));

  insert into public.consumo_de_armazenamento (dia, workspace_id, brand_id, bucket_id, objetos, bytes) values (current_date, p, null, 'brand-assets', 1, 10);
  insert into public.consumo_de_armazenamento (dia, workspace_id, brand_id, bucket_id, objetos, bytes) values (current_date, p, null, 'brand-assets', 2, 20)
    on conflict (dia, workspace_id, brand_id, bucket_id) do update set bytes = excluded.bytes;
  perform pg_temp.registrar('C1 linha de consumo tem id e o upsert natural segue funcionando', '1/20',
    (select count(*) || '/' || max(bytes) from public.consumo_de_armazenamento where workspace_id = p and id is not null));
end $$;

select case when passou then 'ok   ' else 'FALHA' end as st, caso, esperado, obtido from resultado order by ordem;
select case when count(*) filter (where not passou) = 0 then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*) end as veredito from resultado;
do $$ declare n integer; begin select count(*) filter (where not passou) into n from resultado;
  if n > 0 then raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001'; end if; end $$;
rollback;
