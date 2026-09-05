-- Patch 2.1 — a versão de origem de uma recuperação pertence à mesma marca.
--
-- A chave criada no patch 2 referenciava só `brand_document_versions(id)`.
-- Nada impedia que um documento da marca A declarasse ter vindo de uma versão
-- da marca B: a linha seria gravada, e o histórico de uma marca apareceria
-- como procedência do conteúdo de outra. A RLS decide quais linhas a pessoa
-- alcança; ela não impede que uma relação incoerente exista no banco. Mesma
-- garantia do patch 0, agora para a origem da recuperação.
alter table public.brand_document_versions
  add constraint brand_document_versions_id_brand_key unique (id, brand_id);

alter table public.brand_documents
  drop constraint brand_documents_restored_from_version_id_fkey;

-- `set null (restored_from_version_id)` — só a coluna da versão é anulada.
-- SET NULL sem lista anularia também brand_id, que é o que liga o documento à
-- marca. Recurso do Postgres 15; este projeto roda 17.
alter table public.brand_documents
  add constraint brand_documents_restored_origin_fkey
  foreign key (restored_from_version_id, brand_id)
  references public.brand_document_versions(id, brand_id)
  on delete set null (restored_from_version_id);

-- Cobertura: apagar uma versão procura por aqui, e apagar uma marca em cascata
-- passa por este caminho para cada documento recuperado.
create index brand_documents_restored_origin_idx
  on public.brand_documents(restored_from_version_id, brand_id);
