-- PLACEHOLDER — nenhuma operação. Não remova.
--
-- Existe no histórico do banco com este carimbo; o efeito vive em:
--
--     20260902120552_lexical_retrieval_by_brand.sql
--
-- Ela redefinia `public.publish_brand_import` para gravar as faixas de página
-- de origem. Esse `create or replace` está no arquivo acima, e foi redefinido
-- depois por 20260904142954 e 20260904144934 — a forma final no banco é a
-- daquela última, e ela bate com o repositório.
--
-- Não repete o SQL remoto de propósito: reexecutar aqui sobrescreveria a
-- definição atual de `publish_brand_import` por uma versão de três dias antes.
--
-- Ver supabase/RECONCILIACAO.md.

select 1 where false;
