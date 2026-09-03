-- Achado da revisão de segurança pós-P2A: `unique (workspace_id, brand_id,
-- period)` não impede DUAS linhas de orçamento GLOBAL (brand_id nulo) para
-- o mesmo workspace — o SQL padrão trata cada NULL como distinto de
-- qualquer outro NULL, então a constraint nunca dispara quando brand_id é
-- nulo nos dois lados. `reservar_execucao_de_ia` faz `select ... into
-- teto` sem `order by`: com duas linhas concorrendo, o plpgsql usa a
-- PRIMEIRA e descarta a segunda em silêncio — não erra, só fica
-- indeterminístico. Nenhuma corrupção hoje (confirmado: só duas linhas
-- reais existem, uma por workspace, uma por marca, preflight abaixo), mas
-- nada impede um owner futuro de criar um segundo orçamento global por
-- engano — uma corrida de duplo-clique numa tela que ainda não existe, por
-- exemplo — e o produto silenciosamente ignorar um dos dois.
--
-- `NULLS NOT DISTINCT` (PostgreSQL 15+, este projeto roda 17) resolve
-- tratando NULL como igual a NULL só para fins de unicidade — duas linhas
-- workspace_id=X, brand_id=NULL, period='daily' agora colidem de verdade.

-- Preflight (rodado antes desta migração, fora dela): nenhuma duplicata
-- existe hoje — a constraint nova não rejeita nada.

alter table public.ai_budgets
  drop constraint ai_budgets_workspace_id_brand_id_period_key,
  add constraint ai_budgets_workspace_id_brand_id_period_key
    unique nulls not distinct (workspace_id, brand_id, period);
