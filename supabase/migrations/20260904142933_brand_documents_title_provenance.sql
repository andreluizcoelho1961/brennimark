-- Achado da auditoria de produto (04/09): `metodo`/`confianca` de detecção
-- de título já são calculados na importação (`src/lib/import/secoes.ts`) e
-- aparecem uma vez, de forma efêmera, na prévia de importação — mas nunca
-- chegam a `brand_documents`. Depois de publicada, uma marca não tem como
-- diferenciar um título real de um `Página 7` de fallback sem ler a
-- própria string. A Fase 2 (curadoria em massa) precisa deste dado para o
-- filtro "título genérico" ser preciso, não um regex sobre o texto.
--
-- Aditiva: toda linha existente recebe NULL, nada quebra. `title_method`
-- espelha `MetodoDeDeteccao` (`secoes.ts`); `title_confidence` é o mesmo
-- número 0–1 que a heurística já produz — baixa confiança não é erro, é
-- convite para revisar, e ambos os campos são nullable porque uma página
-- que nunca passou pela importação (não existe hoje, mas não é impossível
-- no futuro) não tem por que ter um método de detecção de título.

alter table public.brand_documents
  add column title_method text check (title_method in ('outline', 'heading', 'page-range')),
  add column title_confidence numeric check (title_confidence is null or title_confidence between 0 and 1);

comment on column public.brand_documents.title_method is
  'Como o título foi decidido na importação: outline (índice do PDF), heading (destaque visual) ou page-range (fallback, nenhum dos dois). NULL para linhas de antes desta coluna existir.';
comment on column public.brand_documents.title_confidence is
  '0 a 1. Baixa confiança não é erro — é convite para revisão humana na curadoria. NULL para linhas de antes desta coluna existir.';
