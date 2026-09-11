-- Medição do manifesto por página na escala do produto: 1.000 páginas.
--
-- ─── O que esta medição responde ─────────────────────────────────────────
--
-- A publicação passou a ter duas transações, e a segunda grava uma linha por
-- página do PDF. O maior manual real em mãos tem 743 páginas; o requisito de
-- produto é 100 MB, que pode chegar perto de mil. Três números decidem se a
-- solução transitória aguenta essa escala:
--
--   1. o TAMANHO do payload que atravessa a rede até a RPC;
--   2. a DURAÇÃO da transação que grava documento e manifesto;
--   3. o CUSTO do relatório, que agora carrega o manifesto — porque ele é
--      lido em toda repetição, e é o que torna a recuperação possível.
--
-- Um limite de função da Vercel não aparece em `npm run verify`: ele aparece
-- em produção, no manual do cliente, na frente de quem está comprando. Medir
-- antes é mais barato.
--
-- Termina em `rollback`: não deixa resíduo.
--
-- Uso: scripts/medir-manifesto-de-mil-paginas.sh

\set ON_ERROR_STOP on
\pset pager off

begin;

create temp table medida (
  ordem   serial,
  o_que   text,
  valor   text
);

-- ════════════════════════════════════════════════════════════════════════
-- O mundo: uma conta, uma marca, uma seção
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  u uuid := '33333333-3333-4333-8333-333333333333';
  w uuid; m uuid;
begin
  insert into auth.users (id, email, aud, role)
  values (u, 'medida@local.test', 'authenticated', 'authenticated');

  insert into public.workspaces (name, slug) values ('Medida', 'medida') returning id into w;
  insert into public.workspace_members (workspace_id, user_id, role) values (w, u, 'owner');

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
                             metadata, navigation, theme, ai, legal)
  values (w, 'medida', 'Medida', 'M', 'Marca de medição', 'pt-BR', '{}', '{}', '{}', '{}', '{}')
  returning id into m;

  -- O gatilho de auditoria editorial exige `auth.uid()` owner da conta.
  perform set_config('request.jwt.claims',
    json_build_object('sub', u, 'role', 'authenticated')::text, true);

  insert into public.brand_documents (workspace_id, brand_id, instance_key, slug, group_name,
                                      title, status, updated_by)
  values (w, m, 'medida', 'manual', 'Manual', 'Manual', 'draft', u);

  /*
   * A importação existe, para a medição exercitar a transação B COMPLETA.
   *
   * O vínculo acontece dentro da RPC, e sem uma linha para vincular a medição
   * mediria uma transação mais curta que a real — justamente o número que se
   * quer conhecer.
   */
  insert into public.brand_imports (workspace_id, import_id, brand_id, storage_path,
                                    pdf_sha256, page_count, document_count, report, created_by)
  values (w, '99999999-9999-4999-8999-999999999999', m,
          w::text || '/medida/' || repeat('a', 64) || '.pdf',
          repeat('a', 64), 1000, 1, '{}', u);

  perform set_config('medida.conta', w::text, true);
  perform set_config('medida.marca', m::text, true);
  perform set_config('medida.ator', u::text, true);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- O payload de mil páginas
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  paginas jsonb;
  secao uuid;
  bytes_do_payload integer;
begin
  select id into secao from public.brand_documents
  where brand_id = current_setting('medida.marca')::uuid and slug = 'manual';

  /*
   * Mil páginas com a forma REAL do manifesto: A4 em pontos, rotação, texto,
   * contagem de caracteres e cobertura de seção. Medir com um objeto mais
   * magro que o de produção mediria outra coisa.
   *
   * Uma em cada dez fica sem seção, com motivo escrito: é a proporção que uma
   * extração de manual grande produz de verdade — capas, aberturas visuais e
   * páginas que a heurística não alcança.
   */
  select jsonb_agg(
    jsonb_build_object(
      'pagina', n,
      'largura_pt', 595.276,
      'altura_pt', 841.89,
      'rotacao', 0,
      'tem_texto', n % 10 <> 0,
      'caracteres', case when n % 10 = 0 then 0 else 1800 end,
      'document_id', case when n % 10 = 0 then null else secao end,
      'motivo_da_cobertura', case when n % 10 = 0
        then 'página não entrou em nenhuma seção da extração' else '' end,
      'classificacao', null,
      'confianca', null
    ) order by n
  ) into paginas
  from generate_series(1, 1000) as n;

  bytes_do_payload := octet_length(paginas::text);

  insert into medida (o_que, valor) values
    ('paginas no manifesto', jsonb_array_length(paginas)::text),
    ('payload do manifesto (bytes)', bytes_do_payload::text),
    ('payload do manifesto (KiB)', round(bytes_do_payload / 1024.0, 1)::text),
    ('bytes por pagina', round(bytes_do_payload / 1000.0, 1)::text),
    /*
     * O teto de 4,5 MB de resposta da Vercel é sobre a RESPOSTA. O corpo do
     * pedido tem outro limite, e a rota de registro recebe apenas duas cordas
     * — o manifesto não atravessa a rede a partir do navegador. Este número é
     * o que vai do servidor ao Postgres, e serve para saber se cabe num
     * pedido só ou se a gravação terá de ser paginada.
     */
    ('folga contra 4,5 MB', round(4.5 * 1000 * 1000 / bytes_do_payload, 1)::text || 'x');

  perform set_config('medida.paginas', paginas::text, true);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- A duração da transação B
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  comeco timestamptz;
  fim timestamptz;
  doc_id uuid;
  gravadas integer;
  sem_secao integer;
begin
  comeco := clock_timestamp();

  doc_id := public.registrar_documento_fonte(
    p_workspace_id := current_setting('medida.conta')::uuid,
    p_brand_id := current_setting('medida.marca')::uuid,
    p_storage_path := current_setting('medida.conta') || '/medida/' || repeat('a', 64) || '.pdf',
    p_pdf_sha256 := repeat('a', 64),
    p_byte_size := 98 * 1024 * 1024,
    p_page_count := 1000,
    p_tipo := 'manual',
    p_idioma := 'pt-BR',
    p_titulo := 'Manual de mil paginas',
    p_paginas := current_setting('medida.paginas')::jsonb,
    p_created_by := current_setting('medida.ator')::uuid,
    p_import_id := '99999999-9999-4999-8999-999999999999'
  );

  fim := clock_timestamp();

  select count(*), count(*) filter (where document_id is null)
    into gravadas, sem_secao
  from public.brand_source_pages where source_document_id = doc_id;

  insert into medida (o_que, valor) values
    ('vinculo fechado na mesma transacao',
      case when exists (
        select 1 from public.brand_imports
        where import_id = '99999999-9999-4999-8999-999999999999'
          and source_document_id = doc_id) then 'sim' else 'NAO' end),
    ('duracao da transacao B (ms)',
      round(extract(milliseconds from (fim - comeco))::numeric, 1)::text),
    ('paginas gravadas', gravadas::text),
    ('paginas sem secao', sem_secao::text);

  perform set_config('medida.documento', doc_id::text, true);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- A repetição: o custo do caminho de recuperação
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  comeco timestamptz;
  fim timestamptz;
  repetido uuid;
  documentos integer;
  gravadas integer;
begin
  comeco := clock_timestamp();

  -- Exatamente o mesmo pedido, como a repetição o monta.
  repetido := public.registrar_documento_fonte(
    p_workspace_id := current_setting('medida.conta')::uuid,
    p_brand_id := current_setting('medida.marca')::uuid,
    p_storage_path := current_setting('medida.conta') || '/medida/' || repeat('a', 64) || '.pdf',
    p_pdf_sha256 := repeat('a', 64),
    p_byte_size := 98 * 1024 * 1024,
    p_page_count := 1000,
    p_tipo := 'manual',
    p_idioma := 'pt-BR',
    p_titulo := 'Manual de mil paginas',
    p_paginas := current_setting('medida.paginas')::jsonb,
    p_created_by := current_setting('medida.ator')::uuid,
    p_import_id := '99999999-9999-4999-8999-999999999999'
  );

  fim := clock_timestamp();

  select count(*) into documentos from public.brand_source_documents
  where brand_id = current_setting('medida.marca')::uuid;
  select count(*) into gravadas from public.brand_source_pages
  where source_document_id = repetido;

  insert into medida (o_que, valor) values
    ('duracao da repeticao (ms)',
      round(extract(milliseconds from (fim - comeco))::numeric, 1)::text),
    ('repeticao devolve o mesmo documento',
      case when repetido = current_setting('medida.documento')::uuid then 'sim' else 'NAO' end),
    ('documentos-fonte na marca', documentos::text),
    ('paginas depois de repetir', gravadas::text);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- O custo do relatório, que carrega o manifesto
-- ════════════════════════════════════════════════════════════════════════
do $$
declare
  relatorio jsonb;
  bytes integer;
begin
  /*
   * O relatório é lido em TODA repetição, e é o que torna a recuperação
   * possível depois de recarregar a aba. Se ele ficasse caro de ler, o preço
   * cairia justamente no caminho de quem já teve um problema.
   */
  select jsonb_build_object(
    'arquivo', 'manual.pdf',
    'bytes', 98 * 1024 * 1024,
    'paginas', jsonb_agg(
      jsonb_build_object(
        'pagina', n, 'largura_pt', 595.276, 'altura_pt', 841.89, 'rotacao', 0,
        'tem_texto', n % 10 <> 0,
        'caracteres', case when n % 10 = 0 then 0 else 1800 end,
        'secao_slug', case when n % 10 = 0 then null else 'manual' end
      ) order by n
    )
  ) into relatorio
  from generate_series(1, 1000) as n;

  bytes := octet_length(relatorio::text);

  insert into medida (o_que, valor) values
    ('relatorio com manifesto (KiB)', round(bytes / 1024.0, 1)::text),
    -- O `report` de brand_imports é jsonb, que o Postgres guarda fora da
    -- linha acima de ~2 KB. O custo é uma leitura de TOAST, não uma linha
    -- larga: por isso o número que importa é o total, não o por-linha.
    ('acima do limiar de TOAST', case when bytes > 2048 then 'sim, vai para TOAST' else 'nao' end);
end $$;

select o_que as "o que", valor from medida order by ordem;

rollback;
