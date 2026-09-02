-- A1.2 — remove o índice GIN que nunca é usado.
--
-- Justificativa medida, não presumida:
-- docs/medicoes/escala-da-recuperacao-2026-09-02.md
--
-- Em nenhum plano medido o GIN aparece. Quem faz o trabalho é o btree
-- `brand_chunks_brand_idx`: ele estreita para os trechos da marca, e o
-- `tsv @@ consulta` vira filtro sobre esse conjunto pequeno. Forçando o
-- planejador para longe do index scan (`enable_indexscan=off`,
-- `enable_seqscan=off`), ele escolhe Bitmap Index Scan sobre o MESMO btree.
--
-- A razão é estrutural e não circunstancial: a busca SEMPRE começa por
-- `brand_id` — é parâmetro obrigatório de `buscar_trechos` —, e uma marca não
-- passa de 500 seções porque o importador recusa acima disso. Os trechos por
-- marca ficam limitados a cerca de mil, e varrer mil linhas filtrando por
-- `tsv` sai mais barato que consultar o GIN e cruzar o resultado com o filtro
-- de marca. Medido no teto: 1,93 ms de média, 3,22 ms no pior caso.
--
-- Custo do que não se usa: 4,4 MB com 7.460 linhas, e uma inserção no índice
-- por trecho a cada escrita de documento — mil delas numa importação no teto.
--
-- `btree_gin` foi considerada e recusada: um GIN composto em (brand_id, tsv)
-- resolveria, e adicionaria uma extensão ao projeto para ganhar tempo que o
-- teto de 500 seções já garante.
--
-- REVERSIBILIDADE: uma linha. Se um dia o teto de seções subir muito, ou a
-- busca deixar de começar por marca, recriar é
--   create index brand_chunks_busca_idx on public.brand_chunks using gin (tsv);
-- e a coluna `tsv` continua sendo mantida pelo gatilho, então não há dado a
-- reconstruir.
drop index if exists public.brand_chunks_busca_idx;

comment on column public.brand_chunks.tsv is
  'Vetor de busca, mantido pelo gatilho de reconstrução. Sem índice próprio, '
  'por decisão medida: a busca sempre estreita por brand_id primeiro, e uma '
  'marca não passa de mil trechos. Ver docs/medicoes/escala-da-recuperacao-2026-09-02.md.';
