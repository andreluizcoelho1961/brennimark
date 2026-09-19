-- A página do trecho — 19/09/2026.
--
-- ─── O defeito ──────────────────────────────────────────────────────────────
--
-- O importador grava a faixa de páginas de cada documento como
-- `[{"de": 2, "ate": 3}]` (`src/lib/import/secoes.ts`). A função que monta os
-- trechos pesquisáveis procurava `[{"start": …, "end": …}]`, o formato de uma
-- versão antiga do importador. Não achando, deixava `page_start` e `page_end`
-- vazios — em TODOS os trechos de TODAS as marcas (106 de 106 em produção).
--
-- Ficou escondido desde 02/09 porque nenhuma tela usava a página do trecho. A
-- janela do Vini (fatia 4a) passou a usar: a citação leva o PDF à página. No
-- ensaio de 19/09 as citações vieram sem página, e o manual abria no começo.
--
-- ─── A correção ─────────────────────────────────────────────────────────────
--
-- A função passa a ler os dois formatos — o atual e o antigo, que as
-- ferramentas de medição (`scripts/medir-escala-da-recuperacao.sql`) ainda
-- escrevem. Faixa que não é número inteiro positivo é ignorada, e não derruba
-- a reindexação: um documento sem página é um documento sem página, não uma
-- importação quebrada.
--
-- Depois, os trechos de todo documento com faixa são RECONSTRUÍDOS. Trecho é
-- índice derivado — recalculado do documento a cada gravação dele (gatilho
-- `brand_documents_reindexam`); nada aponta para ele (conferido: nenhuma chave
-- estrangeira), e nenhum dado de origem muda: documento, PDF e páginas ficam
-- como estão.

create or replace function public.reconstruir_trechos(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
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

  -- `de`/`ate` é o formato do importador; `start`/`end`, o antigo. O texto é
  -- conferido antes do `::int`: um valor estranho vira "sem página", e não
  -- uma exceção que impediria gravar o documento.
  select min(inicio), max(fim)
    into faixa_inicio, faixa_fim
  from (
    select case when coalesce(f->>'de', f->>'start') ~ '^[1-9][0-9]{0,5}$'
                then coalesce(f->>'de', f->>'start')::int end as inicio,
           case when coalesce(f->>'ate', f->>'end') ~ '^[1-9][0-9]{0,5}$'
                then coalesce(f->>'ate', f->>'end')::int end as fim
    from jsonb_array_elements(
      case when jsonb_typeof(doc.source_pages) = 'array' then doc.source_pages else '[]'::jsonb end) f
    where jsonb_typeof(f) = 'object'
  ) faixas;

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

-- `create or replace` preserva a ACL; dita aqui para o arquivo bastar sozinho.
-- Função de sistema: só o gatilho e esta migration a chamam.
revoke all on function public.reconstruir_trechos(uuid) from public, anon, authenticated;

-- Os trechos que já existem, com a página que sempre deveriam ter tido.
do $$
declare
  d record;
begin
  for d in
    select id from public.brand_documents
     where jsonb_typeof(source_pages) = 'array' and jsonb_array_length(source_pages) > 0
  loop
    perform public.reconstruir_trechos(d.id);
  end loop;
end $$;
