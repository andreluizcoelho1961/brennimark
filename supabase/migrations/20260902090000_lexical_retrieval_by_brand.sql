-- A1.0 — recuperação lexical por marca, no Postgres.
--
-- O defeito: `buildBrandContext` envia TODAS as páginas com TODOS os fatos em
-- cada mensagem. Com o manual real do aceite — 743 páginas, 152 seções — isso
-- é o manual inteiro dentro de cada pergunta do chat. Custo por mensagem
-- proporcional ao tamanho do manual, latência idem, e a atenção do modelo
-- gasta com material que não tem relação com a pergunta.
--
-- Busca lexical antes de embeddings, e não por economia: ela é AUDITÁVEL. Dá
-- para explicar por que um trecho foi recuperado — as palavras batem — e para
-- reproduzir a decisão. Um vetor não explica nada, exige um provedor a mais e
-- uma chave a mais, e transforma "por que a IA disse isso" numa pergunta sem
-- resposta. Embeddings entram quando a recuperação lexical provar ser
-- insuficiente, com o problema medido.

-- ─── Procedência por documento ─────────────────────────────────────────────
--
-- A faixa de páginas existia só no relatório da importação, agregada. Quem
-- recupera um trecho precisa poder dizer de qual página do PDF ele veio — sem
-- isso a citação diz "está no manual" e a pessoa procura à mão.
alter table public.brand_documents
  add column source_pages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_pages) = 'array');

comment on column public.brand_documents.source_pages is
  'Intervalos de páginas do PDF de origem: [{"start":1,"end":5}]. Vazio para '
  'documento que não veio de importação.';

-- ─── Os trechos ────────────────────────────────────────────────────────────
--
-- Tabela DERIVADA. Ela não é fonte de nada: é reconstruída por gatilho a
-- partir de brand_documents a cada escrita. A alternativa — a aplicação
-- preencher ao gravar — significa que o primeiro caminho de escrita que
-- esquecer deixa o índice velho, e um índice velho responde com confiança
-- sobre conteúdo que não existe mais.
create table public.brand_chunks (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  brand_id      uuid not null,
  document_id   uuid not null references public.brand_documents(id) on delete cascade,

  slug          text not null,
  title         text not null,
  group_name    text not null default '',
  -- Nulo quando o trecho é o corpo da página. Preenchido com o rótulo do
  -- bloco quando vem de um: é o que permite dizer "Cor › Paleta primária".
  section       text,
  status        text not null,
  page_start    integer,
  page_end      integer,
  ordinal       integer not null default 0,

  content       text not null,
  tsv           tsvector not null,

  -- FK composta: um trecho não pode pertencer a uma marca de outro workspace.
  constraint brand_chunks_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade
);

create index brand_chunks_busca_idx on public.brand_chunks using gin (tsv);
-- O filtro por marca vem SEMPRE junto da busca. O índice composto existe para
-- que ele seja barato, e não uma varredura seguida de descarte.
create index brand_chunks_brand_idx on public.brand_chunks(brand_id, document_id);

alter table public.brand_chunks enable row level security;

create policy "Members read chunks of their brands" on public.brand_chunks
  for select to authenticated
  using (
    workspace_id in (
      select workspace_id from public.workspace_members where user_id = (select auth.uid())
    )
  );

-- Ninguém escreve aqui pela API. A tabela é derivada; escrita direta seria uma
-- segunda fonte de verdade, livre para discordar do conteúdo.
revoke all on public.brand_chunks from anon, authenticated;
grant select on public.brand_chunks to authenticated;

/**
 * A configuração de busca textual, pelo idioma do documento.
 *
 * O stemming é o que faz "cores" encontrar "cor". Ele é específico do idioma,
 * e aplicar o do português a um manual em inglês piora a recuperação em vez de
 * melhorar. Idioma desconhecido cai em `simple`: sem stemming, mas as palavras
 * exatas continuam encontráveis — degradação, não quebra.
 */
create or replace function public.config_de_busca(idioma text)
returns regconfig
language sql
immutable
set search_path = ''
as $$
  select case
    when idioma is null then 'simple'::regconfig
    when idioma like 'pt%' then 'portuguese'::regconfig
    when idioma like 'en%' then 'english'::regconfig
    when idioma like 'es%' then 'spanish'::regconfig
    when idioma like 'fr%' then 'french'::regconfig
    else 'simple'::regconfig
  end;
$$;

/**
 * Todo texto de um jsonb, sem saber que jsonb é.
 *
 * Percorre a estrutura e recolhe as strings. Genérico de propósito: um walk
 * que conhecesse os tipos de bloco precisaria ser atualizado a cada tipo novo,
 * e o dia em que não fosse, um bloco inteiro sumiria da busca sem aviso. Ele
 * recolhe um pouco a mais — nomes de tipo, valores hexadecimais — e isso é
 * aceitável: procurar por "#E1251B" e achar a paleta é uma feature.
 */
create or replace function public.textos_de(dados jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(string_agg(valor, ' '), '')
  from jsonb_path_query(coalesce(dados, '[]'::jsonb), 'strict $.**') as t(elemento),
       lateral (select case when jsonb_typeof(elemento) = 'string'
                            then elemento #>> '{}' end as valor) v
  where valor is not null and length(valor) > 0;
$$;

/**
 * Reconstrói os trechos de um documento.
 *
 * Um trecho por corpo da página, e um por bloco de primeiro nível. Não um por
 * linha: uma linha isolada perde o assunto e recupera mal — "mínimo 24 mm" não
 * encontra nada e não explica nada quando encontrado. O bloco é a menor
 * unidade que ainda carrega contexto.
 */
create or replace function public.reconstruir_trechos(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  doc public.brand_documents%rowtype;
  idioma text;
  config regconfig;
  bloco jsonb;
  rotulo text;
  corpo text;
  n integer := 0;
  faixa_inicio integer;
  faixa_fim integer;
begin
  delete from public.brand_chunks where document_id = p_document_id;

  select * into doc from public.brand_documents where id = p_document_id;
  if doc.id is null then return; end if;

  select b.language into idioma from public.brands b where b.id = doc.brand_id;
  config := public.config_de_busca(idioma);

  select min((f->>'start')::int), max((f->>'end')::int)
    into faixa_inicio, faixa_fim
  from jsonb_array_elements(doc.source_pages) f
  where f ? 'start' and f ? 'end';

  corpo := public.textos_de(doc.body);
  if length(trim(corpo)) > 0 then
    insert into public.brand_chunks (workspace_id, brand_id, document_id, slug, title,
      group_name, section, status, page_start, page_end, ordinal, content, tsv)
    values (doc.workspace_id, doc.brand_id, doc.id, doc.slug, doc.title,
      coalesce(doc.group_name,''), null, doc.status, faixa_inicio, faixa_fim, 0,
      corpo, to_tsvector(config, doc.title || ' ' || corpo));
    n := 1;
  end if;

  for bloco in select * from jsonb_array_elements(coalesce(doc.blocks, '[]'::jsonb)) loop
    corpo := public.textos_de(bloco);
    continue when length(trim(corpo)) = 0;
    rotulo := coalesce(bloco->>'title', bloco->>'heading', bloco->>'kind');
    insert into public.brand_chunks (workspace_id, brand_id, document_id, slug, title,
      group_name, section, status, page_start, page_end, ordinal, content, tsv)
    values (doc.workspace_id, doc.brand_id, doc.id, doc.slug, doc.title,
      coalesce(doc.group_name,''), rotulo, doc.status, faixa_inicio, faixa_fim, n,
      corpo, to_tsvector(config, doc.title || ' ' || coalesce(rotulo,'') || ' ' || corpo));
    n := n + 1;
  end loop;
end;
$$;

revoke all on function public.reconstruir_trechos(uuid) from public, anon, authenticated;

create or replace function public.trechos_seguem_o_documento()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.reconstruir_trechos(new.id);
  return new;
end;
$$;

revoke all on function public.trechos_seguem_o_documento() from public, anon, authenticated;

-- AFTER, e nas três colunas que mudam o texto. Reconstruir a cada UPDATE de
-- qualquer coluna faria uma troca de `sort_order` reindexar o documento
-- inteiro sem nenhum motivo.
create trigger brand_documents_reindexam
  after insert or update of body, blocks, title, status, source_pages, slug
  on public.brand_documents
  for each row execute function public.trechos_seguem_o_documento();
/**
 * Recuperar trechos de UMA marca.
 *
 * `security invoker`: a RLS de brand_chunks responde por quem pode ver o quê.
 * Um `security definer` aqui devolveria trechos de qualquer marca para quem
 * soubesse um uuid — e uuid vaza por URL, por log, por captura de tela.
 *
 * O `brand_id` é PARÂMETRO OBRIGATÓRIO, e não algo que a função descubra. Se
 * ela descobrisse — "a marca do usuário" — voltaria a existir uma escolha
 * implícita, que é o defeito que o M1 removeu do produto inteiro.
 *
 * O limite tem teto imposto aqui, não só na aplicação: uma chamada pedindo
 * 10.000 trechos é o manual inteiro por outro caminho, e o ponto de A1 é que
 * o manual inteiro não vai para o modelo.
 */
create or replace function public.buscar_trechos(
  p_brand_id uuid,
  p_consulta text,
  p_limite integer default 8
)
returns table (
  document_slug text,
  document_title text,
  group_name text,
  section text,
  status text,
  page_start integer,
  page_end integer,
  content text,
  relevancia real
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  idioma text;
  config regconfig;
  consulta tsquery;
  teto integer := least(greatest(coalesce(p_limite, 8), 1), 20);
begin
  select b.language into idioma from public.brands b where b.id = p_brand_id;
  -- Marca invisível para esta sessão: a RLS de `brands` já não a devolveu.
  -- Retornar vazio é a resposta certa — dizer "não existe" e "não é sua" da
  -- mesma forma é a regra do M1, e ela vale aqui também.
  if idioma is null then return; end if;

  config := public.config_de_busca(idioma);

  -- `websearch_to_tsquery` aceita texto de pessoa sem quebrar: aspas, OR, e
  -- palavras soltas. `to_tsquery` exigiria sintaxe e lançaria exceção diante
  -- de uma pergunta normal — e uma pergunta normal é a entrada esperada.
  consulta := websearch_to_tsquery(config, coalesce(p_consulta, ''));
  if consulta is null or consulta::text = '' then return; end if;

  return query
  select c.slug, c.title, c.group_name, c.section, c.status,
         c.page_start, c.page_end, c.content,
         ts_rank(c.tsv, consulta) as relevancia
  from public.brand_chunks c
  where c.brand_id = p_brand_id
    and c.tsv @@ consulta
  order by relevancia desc, c.slug, c.ordinal
  limit teto;
end;
$$;

revoke execute on function public.buscar_trechos(uuid, text, integer) from public, anon;
grant execute on function public.buscar_trechos(uuid, text, integer) to authenticated;


-- ─── A publicação grava a procedência no documento ────────────────────────
--
-- Sem isto `source_pages` nasceria vazio em toda importação, e a recuperação
-- devolveria trecho sem faixa de páginas — reduzindo a citação a "está no
-- manual" e devolvendo a pessoa à busca à mão num PDF de 743 páginas.
--
-- A função é reescrita inteira porque `create or replace` exige isso; a ÚNICA
-- diferença em relação à versão de 20260901100000 é a coluna nova no insert.

create or replace function public.publish_brand_import(
  p_workspace_id uuid, p_import_id uuid, p_key text, p_name text, p_short_name text,
  p_descriptor text, p_language text, p_metadata jsonb, p_navigation jsonb,
  p_theme jsonb, p_ai jsonb, p_legal jsonb, p_documents jsonb,
  p_pdf_sha256 text, p_page_count integer, p_report jsonb
)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := (select auth.uid());
  nova_marca uuid; documento jsonb; ordem integer := 0; caminho text;
  total_documentos integer; proveniencia jsonb;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = p_workspace_id
      and workspace_members.user_id = actor and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can import a brand' using errcode = '42501';
  end if;

  caminho := p_workspace_id::text || '/' || p_import_id::text || '/' || p_pdf_sha256 || '.pdf';
  if not exists (
    select 1 from storage.objects
    where storage.objects.bucket_id = 'brand-imports' and storage.objects.name = caminho
  ) then
    raise exception 'the imported file was not found in storage' using errcode = 'P0002';
  end if;

  if coalesce(jsonb_typeof(p_documents), 'null') <> 'array' then
    raise exception 'documents must be an array' using errcode = '22023';
  end if;
  total_documentos := jsonb_array_length(p_documents);
  if total_documentos = 0 then
    raise exception 'import must contain at least one document' using errcode = '22023';
  end if;
  if p_page_count is null or p_page_count < 1 or p_page_count > 1000 then
    raise exception 'the pdf must have between 1 and 1000 pages' using errcode = '22023';
  end if;
  if total_documentos > 500 then
    raise exception 'import produced more sections than the limit of 500' using errcode = '22023';
  end if;
  if total_documentos > p_page_count then
    raise exception 'more sections than pages in the source pdf' using errcode = '22023';
  end if;

  proveniencia := p_report -> 'documentos';
  if coalesce(jsonb_typeof(proveniencia), 'null') <> 'array'
    or jsonb_array_length(proveniencia) <> total_documentos then
    raise exception 'every section must record the pages it came from' using errcode = '22023';
  end if;

  for documento in select * from jsonb_array_elements(p_documents) loop
    if documento->>'status' is distinct from 'draft' then
      raise exception 'imported content must start as draft' using errcode = '22023';
    end if;
  end loop;

  insert into public.brands (workspace_id, key, name, short_name, descriptor, language,
    metadata, navigation, theme, ai, legal)
  values (p_workspace_id, p_key, p_name, p_short_name, p_descriptor, p_language,
    coalesce(p_metadata,'{}'::jsonb), coalesce(p_navigation,'{}'::jsonb),
    p_theme, p_ai, coalesce(p_legal,'{}'::jsonb))
  returning id into nova_marca;

  for documento in select * from jsonb_array_elements(p_documents) loop
    insert into public.brand_documents (workspace_id, brand_id, instance_key, slug,
      group_name, title, status, body, images, blocks, source_pages, sort_order, updated_by)
    values (p_workspace_id, nova_marca, p_key, documento->>'slug', documento->>'group',
      documento->>'title', 'draft', coalesce(documento->'body','[]'::jsonb), '[]'::jsonb,
      coalesce(documento->'blocks','[]'::jsonb),
      -- A procedência vem do documento, e vazia se ele não a declarar. Nunca
      -- derivada da ordem: a seção pode ter sido movida ou unida na prévia, e
      -- uma faixa deduzida da posição seria procedência inventada.
      case when jsonb_typeof(documento->'sourcePageRanges') = 'array'
           then documento->'sourcePageRanges' else '[]'::jsonb end,
      ordem, actor);
    ordem := ordem + 1;
  end loop;

  insert into public.brand_imports (workspace_id, import_id, brand_id, storage_path,
    pdf_sha256, page_count, document_count, report, created_by)
  values (p_workspace_id, p_import_id, nova_marca, caminho, p_pdf_sha256, p_page_count,
    total_documentos, coalesce(p_report,'{}'::jsonb), actor);

  return nova_marca;
end;
$$;

revoke execute on function public.publish_brand_import(uuid, uuid, text, text, text, text,
  text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, integer, jsonb) from public, anon;
grant execute on function public.publish_brand_import(uuid, uuid, text, text, text, text,
  text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, integer, jsonb) to authenticated;
