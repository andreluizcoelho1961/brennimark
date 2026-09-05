-- Patch 0, correção — as chaves compostas precisam de índice de cobertura.
--
-- O linter do Supabase apontou as três chaves criadas na migração anterior como
-- unindexed_foreign_keys. Os índices que eu havia criado começam por brand_id,
-- mas seguem por created_at ou slug: servem à consulta do produto, não à busca
-- que o Postgres faz ao apagar uma marca em cascata, que é por (brand_id,
-- workspace_id). Sem eles, remover uma marca varre as três tabelas inteiras.
--
-- Barato agora, com as tabelas vazias. Caro quando cada conta tiver milhares de
-- páginas e arquivos.
create index brand_documents_brand_workspace_idx
  on public.brand_documents(brand_id, workspace_id);

create index brand_assets_brand_workspace_idx
  on public.brand_assets(brand_id, workspace_id);

create index brand_document_versions_brand_workspace_idx
  on public.brand_document_versions(brand_id, workspace_id);
