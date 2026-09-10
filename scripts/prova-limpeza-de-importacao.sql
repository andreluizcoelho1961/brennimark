-- Prova de que a limpeza de uma importação abandonada ENFILEIRA de fato.
--
-- ─── Por que esta prova existe ───────────────────────────────────────────
--
-- `enqueue_import_cleanup` falhou em toda chamada, com 42P10, desde que a fila
-- ganhou `bucket_id` (20260902004327). Ninguém viu porque o importador não
-- confere o retorno, e porque nenhum teste chamava a função — o `leak-guard`
-- só confere que o NOME dela aparece no componente. Esta prova chama.
--
-- Método, o mesmo de `prova-manifesto-por-pagina.sql`:
--
--   1. cada caso confere o SQLSTATE e, onde o SQLSTATE sozinho é ambíguo, a
--      mensagem exata. O 23505 da recusa "importação publicada" tem o mesmo
--      código de uma violação de unicidade; aceitar só o código deixaria a
--      prova passar pelo motivo errado;
--   2. a prova constrói o próprio mundo, e cada caso usa uma importação
--      própria — nenhum caso depende de linha deixada por outro;
--   3. um caso cuja preparação falhou é reprovado, não ignorado.
--
-- Tudo roda numa transação que termina em `rollback`.

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table resultado (
  ordem      serial,
  caso       text,
  esperado   text,
  obtido     text,
  passou     boolean
);

-- Tabelas TEMPORÁRIAS desta transação; o `rollback` do fim as descarta.
grant select, insert on resultado to authenticated, anon;
grant usage, select on sequence resultado_ordem_seq to authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════
-- O mundo: conta A (dona + membro sem posse), conta B (outra dona)
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  u_a uuid := '11111111-1111-4111-8111-11111111aaaa';
  u_m uuid := '11111111-1111-4111-8111-11111111bbbb';
  u_b uuid := '22222222-2222-4222-8222-22222222aaaa';
  w_a uuid; w_b uuid;
begin
  insert into auth.users (id, email, aud, role)
  values (u_a, 'prova-limpeza-a@local.test', 'authenticated', 'authenticated'),
         (u_m, 'prova-limpeza-m@local.test', 'authenticated', 'authenticated'),
         (u_b, 'prova-limpeza-b@local.test', 'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Limpeza A', 'prova-limpeza-a') returning id into w_a;
  insert into public.workspaces (name, slug) values ('Limpeza B', 'prova-limpeza-b') returning id into w_b;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (w_a, u_a, 'owner'), (w_a, u_m, 'member'), (w_b, u_b, 'owner');

  create temp table mundo as
  select u_a as dona_a, u_m as membro_a, u_b as dona_b, w_a as conta_a, w_b as conta_b;
  grant select on mundo to authenticated, anon;
end $$;

/*
 * Um hash por caso: 64 hex, diferentes entre si. O caminho que a função
 * reconstrói é `<conta>/<importação>/<hash>.pdf`.
 */
create function pg_temp.hash_de(n integer) returns text
language sql immutable as $$ select lpad(to_hex(n), 64, '0') $$;

create function pg_temp.pendencias(conta uuid, imp uuid, n integer, balde text)
returns integer language sql as $$
  select count(*)::integer from public.brand_deletions
  where workspace_id = conta
    and bucket_id = balde
    and storage_path = conta::text || '/' || imp::text || '/' || pg_temp.hash_de(n) || '.pdf'
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 1. A dona enfileira — a função devolve true E a linha existe, no bucket certo
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  m record; imp uuid := gen_random_uuid(); ret boolean; n integer; quem uuid;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona_a, 'role', 'authenticated')::text, true);
  begin
    ret := public.enqueue_import_cleanup(m.conta_a, imp, pg_temp.hash_de(1));
  exception when others then
    reset role;
    insert into resultado (caso, esperado, obtido, passou)
    values ('dona enfileira a limpeza', 'true', 'ERRO ' || sqlstate || ': ' || sqlerrm, false);
    return;
  end;
  reset role;

  n := pg_temp.pendencias(m.conta_a, imp, 1, 'brand-imports');
  select requested_by into quem from public.brand_deletions
  where workspace_id = m.conta_a and storage_path like '%' || imp::text || '%';

  insert into resultado (caso, esperado, obtido, passou) values
    ('dona enfileira a limpeza', 'true', coalesce(ret::text, 'nulo'), ret is true),
    ('a pendencia existe, em brand-imports', '1', n::text, n = 1),
    ('a pendencia registra quem pediu', 'dona_a',
     case when quem = m.dona_a then 'dona_a' else coalesce(quem::text, 'nulo') end, quem = m.dona_a);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 2. Repetir não duplica — a promessa do comentário da função
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  m record; imp uuid := gen_random_uuid(); r1 boolean; r2 boolean; n integer;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona_a, 'role', 'authenticated')::text, true);
  begin
    r1 := public.enqueue_import_cleanup(m.conta_a, imp, pg_temp.hash_de(2));
    r2 := public.enqueue_import_cleanup(m.conta_a, imp, pg_temp.hash_de(2));
  exception when others then
    reset role;
    insert into resultado (caso, esperado, obtido, passou)
    values ('repetir a limpeza nao falha', 'true, true', 'ERRO ' || sqlstate || ': ' || sqlerrm, false);
    return;
  end;
  reset role;

  n := pg_temp.pendencias(m.conta_a, imp, 2, 'brand-imports');
  insert into resultado (caso, esperado, obtido, passou) values
    ('repetir a limpeza nao falha', 'true, true', r1::text || ', ' || r2::text, r1 and r2),
    ('repetir nao duplica a pendencia', '1', n::text, n = 1);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Arquivo de importação PUBLICADA não entra na fila
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  m record; imp uuid := gen_random_uuid(); estado text; msg text; n integer;
  preparado boolean := false;
begin
  select * into m from mundo;

  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona_a, 'role', 'authenticated')::text, true);
  insert into public.brand_imports (workspace_id, import_id, storage_path, pdf_sha256,
                                    page_count, document_count, created_by)
  values (m.conta_a, imp,
          m.conta_a::text || '/' || imp::text || '/' || pg_temp.hash_de(3) || '.pdf',
          pg_temp.hash_de(3), 1, 0, m.dona_a);
  preparado := true;

  set local role authenticated;
  begin
    perform public.enqueue_import_cleanup(m.conta_a, imp, pg_temp.hash_de(3));
    reset role;
    insert into resultado (caso, esperado, obtido, passou)
    values ('importacao publicada e recusada', '23505 published import', 'ACEITOU', false);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate, msg = message_text;
    reset role;
    insert into resultado (caso, esperado, obtido, passou)
    values ('importacao publicada e recusada', '23505 published import', estado || ' ' || msg,
            estado = '23505' and msg = 'this file belongs to a published import');
  end;

  n := pg_temp.pendencias(m.conta_a, imp, 3, 'brand-imports');
  insert into resultado (caso, esperado, obtido, passou)
  values ('nada da publicada entrou na fila', '0', n::text, n = 0);
exception when others then
  insert into resultado (caso, esperado, obtido, passou)
  values ('importacao publicada e recusada', 'preparacao completa',
          case when preparado then 'ERRO ' else 'PREPARACAO FALHOU ' end || sqlstate || ': ' || sqlerrm,
          false);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Autorização negativa — a dona de B não enfileira na conta de A
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  m record; imp uuid := gen_random_uuid(); estado text; n integer;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona_b, 'role', 'authenticated')::text, true);
  begin
    perform public.enqueue_import_cleanup(m.conta_a, imp, pg_temp.hash_de(4));
    estado := 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
  end;
  reset role;

  n := pg_temp.pendencias(m.conta_a, imp, 4, 'brand-imports');
  insert into resultado (caso, esperado, obtido, passou) values
    ('dona de B NAO enfileira na conta de A', '42501', estado, estado = '42501'),
    ('nada entrou na fila de A pela mao de B', '0', n::text, n = 0);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. Membro sem posse da própria conta também não
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  m record; imp uuid := gen_random_uuid(); estado text; n integer;
begin
  select * into m from mundo;
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.membro_a, 'role', 'authenticated')::text, true);
  begin
    perform public.enqueue_import_cleanup(m.conta_a, imp, pg_temp.hash_de(5));
    estado := 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
  end;
  reset role;

  n := pg_temp.pendencias(m.conta_a, imp, 5, 'brand-imports');
  insert into resultado (caso, esperado, obtido, passou) values
    ('membro sem posse NAO enfileira', '42501', estado, estado = '42501'),
    ('nada entrou na fila pela mao do membro', '0', n::text, n = 0);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Visitante anônimo não executa a função
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  m record; estado text;
begin
  select * into m from mundo;
  set local role anon;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  begin
    perform public.enqueue_import_cleanup(m.conta_a, gen_random_uuid(), pg_temp.hash_de(6));
    estado := 'ACEITOU';
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
  end;
  reset role;
  insert into resultado (caso, esperado, obtido, passou)
  values ('anon NAO executa a funcao', '42501', estado, estado = '42501');
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. O mesmo caminho noutro bucket é outro arquivo — não bloqueia a limpeza
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  m record; imp uuid := gen_random_uuid(); ret boolean; n_imp integer; n_ass integer;
begin
  select * into m from mundo;

  -- Preparação como postgres: uma pendência em `brand-assets` com o caminho
  -- exato que a função vai reconstruir.
  insert into public.brand_deletions (workspace_id, bucket_id, storage_path, requested_by)
  values (m.conta_a, 'brand-assets',
          m.conta_a::text || '/' || imp::text || '/' || pg_temp.hash_de(7) || '.pdf', m.dona_a);

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', m.dona_a, 'role', 'authenticated')::text, true);
  begin
    ret := public.enqueue_import_cleanup(m.conta_a, imp, pg_temp.hash_de(7));
  exception when others then
    reset role;
    insert into resultado (caso, esperado, obtido, passou)
    values ('caminho igual noutro bucket nao bloqueia', 'true',
            'ERRO ' || sqlstate || ': ' || sqlerrm, false);
    return;
  end;
  reset role;

  n_imp := pg_temp.pendencias(m.conta_a, imp, 7, 'brand-imports');
  n_ass := pg_temp.pendencias(m.conta_a, imp, 7, 'brand-assets');
  insert into resultado (caso, esperado, obtido, passou) values
    ('caminho igual noutro bucket nao bloqueia', 'true', ret::text, ret is true),
    ('uma pendencia por bucket', 'imports=1 assets=1',
     'imports=' || n_imp || ' assets=' || n_ass, n_imp = 1 and n_ass = 1);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 8. As garantias da função não afrouxaram
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  f oid := 'public.enqueue_import_cleanup(uuid, uuid, text)'::regprocedure;
  definer boolean; config text[];
begin
  select prosecdef, proconfig into definer, config from pg_proc where oid = f;
  insert into resultado (caso, esperado, obtido, passou) values
    ('continua security invoker', 'invoker',
     case when definer then 'DEFINER' else 'invoker' end, not definer),
    ('search_path continua vazio', 'search_path=""', array_to_string(config, ','),
     config = array['search_path=""']),
    ('anon sem execute', 'false',
     has_function_privilege('anon', f, 'execute')::text,
     not has_function_privilege('anon', f, 'execute')),
    ('authenticated com execute (o navegador chama)', 'true',
     has_function_privilege('authenticated', f, 'execute')::text,
     has_function_privilege('authenticated', f, 'execute'));
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Relatório
-- ════════════════════════════════════════════════════════════════════════
select case when passou then 'ok   ' else 'FALHA' end as st,
       caso, esperado, obtido
from resultado order by ordem;

select case when count(*) filter (where not passou) = 0
            then 'PROVA COMPLETA: ' || count(*) || ' verificacoes, todas verdes'
            else 'PROVA FALHOU: ' || count(*) filter (where not passou) || ' de ' || count(*)
       end as veredito
from resultado;

do $$
declare n integer;
begin
  select count(*) filter (where not passou) into n from resultado;
  if n > 0 then
    raise exception 'PROVA FALHOU: % verificacao(oes)', n using errcode = 'P0001';
  end if;
end $$;

-- Nada é gravado: a prova não deixa resíduo.
rollback;
