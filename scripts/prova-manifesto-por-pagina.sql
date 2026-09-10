-- Prova das garantias do documento-fonte e do manifesto por página.
--
-- ─── Por que esta prova é assim ──────────────────────────────────────────
--
-- A primeira versão tinha um falso positivo estrutural: tratava QUALQUER erro
-- contendo "violates" ou "duplicate key" como sucesso. Se a preparação de um
-- caso falhasse — por exemplo por já existir documento ativo daquela marca —
-- o teste passava sem NUNCA alcançar a constraint que pretendia provar.
--
-- Três correções, e as três são de método:
--
--   1. cada caso confere o NOME EXATO da constraint (ou o SQLSTATE) que
--      esperava. Erro certo pelo motivo errado passa a reprovar;
--   2. a prova constrói o próprio mundo — duas contas, duas marcas — em vez
--      de depender de dado importado à mão. Dado compartilhado entre casos é
--      o que produzia o falso positivo;
--   3. cada caso registra se a PREPARAÇÃO chegou ao fim. Um caso cuja
--      preparação falhou é reprovado, não ignorado.
--
-- Tudo roda numa transação que termina em `rollback`: a prova não deixa
-- resíduo no banco de quem a executou.

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

/*
 * Os casos de RLS e de privilégio rodam sob `authenticated` e `anon`, e
 * precisam registrar resultado. Sem estes grants a prova morre ao trocar de
 * papel — e morrer não é reprovar: seria a prova não chegando ao caso.
 *
 * Escopo: tabelas TEMPORÁRIAS, desta transação, que o `rollback` do fim
 * descarta. Nada disso alcança o esquema do produto.
 */
grant select, insert on resultado to authenticated, anon, service_role;
grant usage, select on sequence resultado_ordem_seq to authenticated, anon, service_role;

-- ════════════════════════════════════════════════════════════════════════
-- O mundo da prova: duas contas reais, duas marcas
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  u_a uuid := '11111111-1111-4111-8111-111111111111';
  u_b uuid := '22222222-2222-4222-8222-222222222222';
  w_a uuid; w_b uuid; m_a uuid; m_b uuid;
begin
  insert into auth.users (id, email, aud, role)
  values (u_a, 'prova-a@local.test', 'authenticated', 'authenticated'),
         (u_b, 'prova-b@local.test', 'authenticated', 'authenticated');

  -- `workspaces` não tem coluna de dono: a titularidade vive em
  -- `workspace_members.role`, e é de lá que a RLS lê.
  insert into public.workspaces (name, slug) values ('Prova A', 'prova-a') returning id into w_a;
  insert into public.workspaces (name, slug) values ('Prova B', 'prova-b') returning id into w_b;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (w_a, u_a, 'owner'), (w_b, u_b, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w_a, 'marca-a', 'Marca A', 'A', 'Marca de prova A', 'pt-BR', '{}', '{}', '{}', '{}', '{}')
  returning id into m_a;
  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w_b, 'marca-b', 'Marca B', 'B', 'Marca de prova B', 'pt-BR', '{}', '{}', '{}', '{}', '{}')
  returning id into m_b;

  /*
   * Uma seção em cada marca, para os casos de vínculo cruzado.
   *
   * As reivindicações do JWT são definidas antes de cada inserção porque o
   * gatilho de auditoria editorial (`private.capture_brand_document_version`)
   * exige que `auth.uid()` seja owner da conta — rodar como `postgres` não
   * basta, e é assim que deve ser.
   */
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
                                      title, status, updated_by)
  values (w_a, m_a, 'marca-a', 'secao-a', 'G', 'Seção A', 'draft', u_a);

  perform set_config('request.jwt.claims',
    json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
                                      title, status, updated_by)
  values (w_b, m_b, 'marca-b', 'secao-b', 'G', 'Seção B', 'draft', u_b);

  perform set_config('request.jwt.claims', '', true);

  create temp table mundo as
  select u_a as usuario_a, u_b as usuario_b, w_a as conta_a, w_b as conta_b,
         m_a as marca_a, m_b as marca_b;
  grant select on mundo to authenticated, anon, service_role;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- O verificador: espera o NOME da constraint, não "algum erro"
-- ════════════════════════════════════════════════════════════════════════
create function pg_temp.espera_recusa(
  p_caso text, p_sql text, p_constraint text, p_sqlstate text default null
) returns void language plpgsql as $$
declare
  nome text; estado text; ok boolean; obtido text;
begin
  begin
    execute p_sql;
    -- Chegou aqui: o banco ACEITOU o que deveria recusar.
    insert into resultado (caso, esperado, obtido, passou)
    values (p_caso, coalesce(p_constraint, p_sqlstate), 'ACEITOU', false);
    return;
  exception when others then
    get stacked diagnostics nome = constraint_name, estado = returned_sqlstate;
  end;

  if p_constraint is not null then
    ok := (nome = p_constraint);
    obtido := coalesce(nullif(nome, ''), 'sem nome, sqlstate ' || estado);
  else
    ok := (estado = p_sqlstate);
    obtido := estado;
  end if;

  insert into resultado (caso, esperado, obtido, passou)
  values (p_caso, coalesce(p_constraint, p_sqlstate), obtido, ok);
end $$;

/*
 * Um documento-fonte válido da marca A, base de vários casos.
 *
 * Criado como **`service_role`**, e isto é deliberado: é o papel que a rota de
 * servidor usa. A versão anterior chamava a RPC como `postgres`, que é
 * superusuário — e uma prova que só passa com privilégio de superusuário não
 * prova que o caminho de produção funciona. Foi assim que o `grant execute`
 * ausente para `service_role` passou pela primeira revisão: a função estava
 * executável por NINGUÉM, e a prova não notava.
 */
do $$
declare d uuid;
begin
  set local role service_role;

  select public.registrar_documento_fonte(
    conta_a, marca_a, 'a/i/'||repeat('a',64)||'.pdf', repeat('a',64), 1000, 2,
    'manual', 'pt-BR', 'Manual A',
    jsonb_build_array(
      jsonb_build_object('pagina',1,'largura_pt',600,'altura_pt',800,'tem_texto',true),
      jsonb_build_object('pagina',2,'largura_pt',600,'altura_pt',800,'tem_texto',false)),
    usuario_a) into d from mundo;

  -- Volta ao papel da sessão ANTES de contar: `service_role` não tem `select`
  -- nas tabelas, e não precisa — a RPC é `definer`, e leitura de manifesto
  -- passa pela sessão do usuário, com RLS. Contar sob o papel errado media o
  -- privilégio, não o resultado.
  reset role;

  insert into resultado (caso, esperado, obtido, passou)
  values ('a RPC registra documento com manifesto 1..N', 'documento criado',
          case when d is null then 'null' else 'criado' end, d is not null);

  insert into resultado (caso, esperado, obtido, passou)
  select 'o manifesto tem exatamente page_count linhas', '2', count(*)::text, count(*) = 2
  from public.brand_source_pages where source_document_id = d;

  create temp table doc_a as select d as id;
  grant select on doc_a to authenticated, anon, service_role;
end $$;

/*
 * Um documento com MANIFESTO INCOMPLETO, de propósito, para os casos de linha.
 *
 * Por que ele existe: os casos de vínculo cruzado precisam de um número de
 * página LIVRE. Todo documento criado pela RPC é completo por construção
 * (1..N), então qualquer página que eu tentasse inserir bateria primeiro na
 * unicidade `(source_document_id, pagina)` — e o caso passaria pelo erro
 * ERRADO. Foi exatamente o que a prova estrita pegou: dois casos "verdes" que
 * nunca alcançavam a chave composta que pretendiam provar.
 *
 * Criado como `postgres`, que ignora grants e RLS — é o único jeito de ter um
 * documento com espaço livre, já que a RPC não permite estado intermediário.
 */
do $$
declare d uuid;
begin
  insert into public.brand_source_documents
    (workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count, tipo,
     versao, created_by)
  select conta_a, marca_a, 'livre', repeat('0',64), 1, 10, 'apresentacao', 1, usuario_a
  from mundo returning id into d;

  -- Uma página ocupada, para o caso de repetição ter o que repetir.
  insert into public.brand_source_pages
    (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto,
     cobertura, motivo_da_cobertura)
  select conta_a, marca_a, d, 1, 10, 10, false, 'sem-secao', 'ocupada' from mundo;

  create temp table doc_livre as select d as id;
  grant select on doc_livre to authenticated, anon, service_role;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 1. Vínculos entre marcas diferentes
-- ════════════════════════════════════════════════════════════════════════
select pg_temp.espera_recusa(
  'pagina da marca B em documento da marca A',
  format($f$insert into public.brand_source_pages
     (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto,
      cobertura, motivo_da_cobertura)
   select conta_b, marca_b, %L, 2, 10, 10, false, 'sem-secao', 'x' from mundo$f$,
   (select id from doc_livre)),
  'brand_source_pages_documento_mesma_marca_fkey');

select pg_temp.espera_recusa(
  'pagina aponta secao de OUTRA marca',
  format($f$insert into public.brand_source_pages
     (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto,
      cobertura, document_id)
   select conta_a, marca_a, %L, 2, 10, 10, true, 'secao',
          (select id from public.brand_documents where brand_id = mundo.marca_b limit 1)
   from mundo$f$, (select id from doc_livre)),
  'brand_source_pages_secao_mesma_marca_fkey');

select pg_temp.espera_recusa(
  'documento substituto de OUTRA marca',
  format($f$insert into public.brand_source_documents
     (workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count, versao,
      substitui_id, created_by)
   select conta_b, marca_b, 'b', repeat('b',64), 1, 1, 2, %L, usuario_b from mundo$f$,
   (select id from doc_a)),
  'brand_source_documents_substitui_mesma_marca_fkey');

-- ════════════════════════════════════════════════════════════════════════
-- 2. O manifesto é exatamente 1..N
-- ════════════════════════════════════════════════════════════════════════
select pg_temp.espera_recusa(
  'manifesto incompleto (2 paginas para page_count 3)',
  $f$select public.registrar_documento_fonte(conta_a, marca_a, 'i1', repeat('1',64), 1, 3,
      'anexo', null, '',
      jsonb_build_array(
        jsonb_build_object('pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',false),
        jsonb_build_object('pagina',2,'largura_pt',1,'altura_pt',1,'tem_texto',false)),
      usuario_a) from mundo$f$,
  null, '22023');

select pg_temp.espera_recusa(
  'manifesto com furo (1,2,4 para page_count 3)',
  $f$select public.registrar_documento_fonte(conta_a, marca_a, 'i2', repeat('2',64), 1, 3,
      'anexo', null, '',
      jsonb_build_array(
        jsonb_build_object('pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',false),
        jsonb_build_object('pagina',2,'largura_pt',1,'altura_pt',1,'tem_texto',false),
        jsonb_build_object('pagina',4,'largura_pt',1,'altura_pt',1,'tem_texto',false)),
      usuario_a) from mundo$f$,
  null, '22023');

select pg_temp.espera_recusa(
  'manifesto com pagina repetida',
  $f$select public.registrar_documento_fonte(conta_a, marca_a, 'i3', repeat('3',64), 1, 2,
      'anexo', null, '',
      jsonb_build_array(
        jsonb_build_object('pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',false),
        jsonb_build_object('pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',false)),
      usuario_a) from mundo$f$,
  null, '22023');

select pg_temp.espera_recusa(
  'pagina zero',
  format($f$insert into public.brand_source_pages
     (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto,
      cobertura, motivo_da_cobertura)
   select conta_a, marca_a, %L, 0, 10, 10, false, 'sem-secao', 'x' from mundo$f$,
   (select id from doc_livre)),
  'brand_source_pages_pagina_check');

select pg_temp.espera_recusa(
  'pagina maior que page_count',
  format($f$insert into public.brand_source_pages
     (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto,
      cobertura, motivo_da_cobertura)
   select conta_a, marca_a, %L, 999, 10, 10, false, 'sem-secao', 'x' from mundo$f$,
   (select id from doc_livre)),
  null, '23514');

select pg_temp.espera_recusa(
  'pagina repetida no mesmo documento',
  format($f$insert into public.brand_source_pages
     (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto,
      cobertura, motivo_da_cobertura)
   select conta_a, marca_a, %L, 1, 10, 10, false, 'sem-secao', 'x' from mundo$f$,
   (select id from doc_livre)),
  'brand_source_pages_source_document_id_pagina_key');

-- ════════════════════════════════════════════════════════════════════════
-- 3. As duas constraints do coração
-- ════════════════════════════════════════════════════════════════════════
select pg_temp.espera_recusa(
  'sem-secao sem motivo',
  format($f$insert into public.brand_source_pages
     (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto,
      cobertura)
   select conta_a, marca_a, %L, 2, 10, 10, false, 'sem-secao' from mundo$f$,
   (select id from doc_livre)),
  'brand_source_pages_ausencia_justificada');

select pg_temp.espera_recusa(
  'secao sem vinculo de documento',
  format($f$insert into public.brand_source_pages
     (workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt, tem_texto,
      cobertura)
   select conta_a, marca_a, %L, 2, 10, 10, true, 'secao' from mundo$f$,
   (select id from doc_livre)),
  'brand_source_pages_cobertura_coerente');

-- ════════════════════════════════════════════════════════════════════════
-- 4. O original é imutável, e a exclusão não é oferecida
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  estado text;
  -- Lidos ANTES de trocar de papel: `authenticated` não alcança tabela
  -- temporária criada por `postgres`, e a troca de papel é o objeto do teste.
  u_a uuid; c_a uuid; m_a uuid; d_a uuid; sql text;
begin
  select usuario_a, conta_a, marca_a into u_a, c_a, m_a from mundo;
  select id into d_a from doc_a;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a, 'role', 'authenticated')::text, true);

  begin
    execute 'update public.brand_source_documents set pdf_sha256 = repeat(''f'',64), '
         || 'storage_path = ''outro'', page_count = 9999';
    insert into resultado (caso, esperado, obtido, passou)
    values ('owner NAO reescreve hash, caminho e page_count', '42501', 'ACEITOU', false);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    insert into resultado (caso, esperado, obtido, passou)
    values ('owner NAO reescreve hash, caminho e page_count', '42501', estado, estado = '42501');
  end;

  begin
    execute 'delete from public.brand_source_documents';
    insert into resultado (caso, esperado, obtido, passou)
    values ('owner NAO apaga documento-fonte direto', '42501', 'ACEITOU', false);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    insert into resultado (caso, esperado, obtido, passou)
    values ('owner NAO apaga documento-fonte direto', '42501', estado, estado = '42501');
  end;

  sql := format('insert into public.brand_source_pages (workspace_id, brand_id, '
             || 'source_document_id, pagina, largura_pt, altura_pt, tem_texto, cobertura, '
             || 'motivo_da_cobertura) values (%L, %L, %L, 2, 1, 1, false, ''sem-secao'', ''x'')',
                c_a, m_a, d_a);
  begin
    execute sql;
    insert into resultado (caso, esperado, obtido, passou)
    values ('owner NAO insere pagina direto (so por RPC)', '42501', 'ACEITOU', false);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    insert into resultado (caso, esperado, obtido, passou)
    values ('owner NAO insere pagina direto (so por RPC)', '42501', estado, estado = '42501');
  end;

  reset role;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 5. RLS: duas contas reais
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  vistos integer; estado text;
  u_a uuid; u_b uuid;
begin
  select usuario_a, usuario_b into u_a, u_b from mundo;

  set local role authenticated;

  -- Conta A: vê o seu.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_a, 'role', 'authenticated')::text, true);
  select count(*) into vistos from public.brand_source_documents;
  insert into resultado (caso, esperado, obtido, passou)
  values ('conta A ve os documentos dela', '2', vistos::text, vistos = 2);
  select count(*) into vistos from public.brand_source_pages;
  insert into resultado (caso, esperado, obtido, passou)
  values ('conta A ve as paginas dela', '3', vistos::text, vistos = 3);

  -- Conta B: existe, é owner da conta dela, e NÃO vê nada da conta A.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u_b, 'role', 'authenticated')::text, true);
  select count(*) into vistos from public.brand_source_documents;
  insert into resultado (caso, esperado, obtido, passou)
  values ('conta B NAO ve documento da conta A', '0', vistos::text, vistos = 0);
  select count(*) into vistos from public.brand_source_pages;
  insert into resultado (caso, esperado, obtido, passou)
  values ('conta B NAO ve pagina da conta A', '0', vistos::text, vistos = 0);

  reset role;

  set local role anon;
  begin
    select count(*) into vistos from public.brand_source_pages;
    insert into resultado (caso, esperado, obtido, passou)
    values ('anonimo NAO alcanca o manifesto', '42501', 'leu '||vistos, false);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    insert into resultado (caso, esperado, obtido, passou)
    values ('anonimo NAO alcanca o manifesto', '42501', estado, estado = '42501');
  end;
  reset role;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6. Coexistência e substituição, sob a decisão "uma ativa por TIPO"
-- ════════════════════════════════════════════════════════════════════════
do $$
declare d uuid; ativos integer;
begin
  -- Anexo ativo AO LADO do manual ativo: precisa PASSAR.
  select public.registrar_documento_fonte(conta_a, marca_a, 'anexo', repeat('9',64), 1, 1,
    'anexo', null, 'Anexo A',
    jsonb_build_array(jsonb_build_object('pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',true)),
    usuario_a) into d from mundo;

  select count(*) into ativos from public.brand_source_documents
  where status = 'ativa' and brand_id = (select marca_a from mundo);

  -- Três tipos ativos ao mesmo tempo: manual, apresentação (o documento de
  -- espaço livre) e anexo. É a decisão "uma ativa por TIPO" exercitada com
  -- mais de dois tipos, que é onde a regra por marca quebrava.
  insert into resultado (caso, esperado, obtido, passou)
  values ('manual, apresentacao e anexo ativos coexistem', '3', ativos::text, ativos = 3);
exception when others then
  insert into resultado (caso, esperado, obtido, passou)
  values ('manual, apresentacao e anexo ativos coexistem', '3', 'ERRO '||sqlstate, false);
end $$;

select pg_temp.espera_recusa(
  'dois manuais ativos na mesma marca',
  $f$select public.registrar_documento_fonte(conta_a, marca_a, 'm2', repeat('8',64), 1, 1,
      'manual', null, '',
      jsonb_build_array(jsonb_build_object('pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',true)),
      usuario_a) from mundo$f$,
  'brand_source_documents_uma_ativa_por_tipo');

-- ════════════════════════════════════════════════════════════════════════
-- 6b. Quem pode executar as RPCs
-- ════════════════════════════════════════════════════════════════════════
--
-- Medido antes da correção: `has_function_privilege('service_role', ...)`
-- devolvia **false** para as duas. `revoke ... from public` remove o EXECUTE
-- implícito de todo mundo, e `service_role` não é superusuário — ele tem
-- `bypassrls`, que é outra coisa. A função "server-only" estava executável por
-- ninguém, e o manifesto nunca poderia ser escrito.
do $$
declare nome text; papel text; pode boolean; esperado boolean;
begin
  foreach nome in array array['registrar_documento_fonte', 'editar_documento_fonte'] loop
    foreach papel in array array['service_role', 'authenticated', 'anon'] loop
      esperado := (papel = 'service_role');
      select bool_or(has_function_privilege(papel, p.oid, 'EXECUTE')) into pode
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = nome;

      insert into resultado (caso, esperado, obtido, passou)
      values (papel || ' executa ' || nome, esperado::text, coalesce(pode, false)::text,
              coalesce(pode, false) = esperado);
    end loop;
  end loop;
end $$;

/* E não basta o privilégio constar: a chamada precisa passar de fato. */
do $$
declare d uuid; estado text;
begin
  set local role service_role;
  select public.registrar_documento_fonte(conta_b, marca_b, 'sr', repeat('5',64), 1, 1,
    'manual', null, '',
    jsonb_build_array(jsonb_build_object('pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',true)),
    usuario_b) into d from mundo;
  reset role;

  insert into resultado (caso, esperado, obtido, passou)
  values ('service_role registra de fato', 'criado',
          case when d is null then 'null' else 'criado' end, d is not null);
exception when others then
  reset role;
  get stacked diagnostics estado = returned_sqlstate;
  insert into resultado (caso, esperado, obtido, passou)
  values ('service_role registra de fato', 'criado', 'ERRO ' || estado, false);
end $$;

do $$
declare estado text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select usuario_a from mundo), 'role', 'authenticated')::text, true);
  begin
    perform public.registrar_documento_fonte(
      '00000000-0000-4000-8000-000000000000'::uuid,
      '00000000-0000-4000-8000-000000000000'::uuid,
      'x', repeat('6',64), 1, 1, 'manual', null, '', '[]'::jsonb,
      '00000000-0000-4000-8000-000000000001'::uuid);
    insert into resultado (caso, esperado, obtido, passou)
    values ('authenticated NAO executa a RPC', '42501', 'EXECUTOU', false);
  exception when others then
    get stacked diagnostics estado = returned_sqlstate;
    insert into resultado (caso, esperado, obtido, passou)
    values ('authenticated NAO executa a RPC', '42501', estado, estado = '42501');
  end;
  reset role;
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 6c. Apagar o documento-fonte desvincula o import, sem destruir a linha
-- ════════════════════════════════════════════════════════════════════════
--
-- Medido antes da correção: a FK usava `on delete set null` SEM lista de
-- colunas, então o Postgres zerava também `brand_id` e `workspace_id`, que são
-- `not null` — e o DELETE do documento-fonte falhava com
-- "null value in column workspace_id of relation brand_imports".
--
-- É a terceira aparição do mesmo defeito nesta migration, e a que passou pela
-- primeira revisão.
do $$
declare d uuid; imp uuid; sobrou integer; nulo boolean; conta uuid; marca uuid;
begin
  /*
   * Na marca B, e com tipo livre.
   *
   * Os quatro tipos da marca A já estão ativos nos casos anteriores — usar
   * mais um ali bateria em `uma_ativa_por_tipo` e o caso reprovaria pelo
   * motivo errado. É a mesma lição que os casos de marca cruzada deram: dado
   * isolado por caso não é preciosismo.
   */
  set local role service_role;
  select public.registrar_documento_fonte(conta_b, marca_b, 'para-import', repeat('4',64), 1, 1,
    'guia', null, '',
    jsonb_build_array(jsonb_build_object('pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',true)),
    usuario_b) into d from mundo;
  reset role;

  imp := gen_random_uuid();
  insert into public.brand_imports (workspace_id, import_id, brand_id, storage_path, pdf_sha256,
                                    page_count, document_count, report, created_by,
                                    source_document_id)
  select conta_b, imp, marca_b, 'i', repeat('4',64), 1, 1, '{}', usuario_b, d from mundo;

  delete from public.brand_source_documents where id = d;

  -- `max(uuid)` não existe; a linha é uma só, então lê-se direto.
  select count(*) into sobrou from public.brand_imports where import_id = imp;
  select source_document_id is null, workspace_id, brand_id
    into nulo, conta, marca
  from public.brand_imports where import_id = imp;

  insert into resultado (caso, esperado, obtido, passou) values
    ('o import sobrevive ao documento apagado', '1', sobrou::text, sobrou = 1),
    ('source_document_id ficou nulo', 'true', coalesce(nulo, false)::text, coalesce(nulo, false)),
    ('workspace_id foi PRESERVADO', 'preservado',
     case when conta is null then 'zerado' else 'preservado' end, conta is not null),
    ('brand_id foi PRESERVADO', 'preservado',
     case when marca is null then 'zerado' else 'preservado' end, marca is not null);
exception when others then
  insert into resultado (caso, esperado, obtido, passou)
  values ('apagar o documento-fonte desvincula o import', 'sem erro', 'ERRO ' || sqlstate || ': ' || sqlerrm, false);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- 7. A página sobrevive à seção apagada
-- ════════════════════════════════════════════════════════════════════════
do $$
declare d uuid; existe integer; cob text; motivo text;
begin
  select public.registrar_documento_fonte(conta_a, marca_a, 'g', repeat('7',64), 1, 1,
    'guia', null, '',
    jsonb_build_array(jsonb_build_object(
      'pagina',1,'largura_pt',1,'altura_pt',1,'tem_texto',true,
      'document_id',(select id from public.brand_documents where brand_id=(select marca_a from mundo) limit 1))),
    usuario_a) into d from mundo;

  -- O gatilho de auditoria editorial exige `auth.uid()` owner: apagar seção é
  -- ato de curadoria, e a prova precisa fazê-lo como quem cura.
  perform set_config('request.jwt.claims',
    json_build_object('sub', (select usuario_a from mundo), 'role', 'authenticated')::text, true);

  delete from public.brand_documents
  where id = (select document_id from public.brand_source_pages where source_document_id = d);

  perform set_config('request.jwt.claims', '', true);

  select count(*), max(cobertura), max(motivo_da_cobertura)
    into existe, cob, motivo
  from public.brand_source_pages where source_document_id = d;

  insert into resultado (caso, esperado, obtido, passou) values
    ('a pagina sobrevive a secao apagada', '1', existe::text, existe = 1),
    ('a cobertura virou sem-secao', 'sem-secao', cob, cob = 'sem-secao'),
    ('o motivo foi registrado', 'com motivo',
     case when length(btrim(coalesce(motivo,''))) > 0 then 'com motivo' else 'vazio' end,
     length(btrim(coalesce(motivo,''))) > 0);
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

-- Reprova a execução inteira se qualquer caso falhou, para o script de shell
-- não precisar interpretar texto.
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
