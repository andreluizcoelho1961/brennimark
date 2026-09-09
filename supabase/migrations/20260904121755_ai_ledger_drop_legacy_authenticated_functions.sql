-- SEGUNDA ETAPA do fechamento do P0-2 (ver
-- 20260903210000_ai_ledger_server_only_functions.sql para o contexto
-- completo). NÃO aplicar esta migração até TODOS os passos abaixo
-- estarem confirmados:
--
--   1. O backend (orcamento.ts) já chama SÓ as três funções `_server`,
--      publicado em produção.
--   2. `SUPABASE_SECRET_KEY` (chave `sb_secret_...`, nunca a legacy
--      `service_role`) está configurada na Vercel e localmente.
--   3. Reserva, liquidação, cancelamento e recusa foram testados de
--      verdade pela Data API com a chave nova, e passaram.
--
-- Só depois disso esta migração revoga e remove as três funções antigas
-- (`reservar_execucao_de_ia`, `consolidar_execucao_de_ia`,
-- `liberar_reserva_de_ia`) — as que ainda aceitam `authenticated` e
-- confiam no valor financeiro que o cliente manda. Aplicá-la antes do
-- passo 1 derrubaria toda reserva de IA em produção; aplicá-la sem os
-- passos 2–3 confirmados deixaria a app sem NENHUM caminho funcional de
-- reserva, porque o `_server` ainda não teria uma chave capaz de chamá-lo.

revoke all on function public.reservar_execucao_de_ia(uuid, uuid, uuid, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.consolidar_execucao_de_ia(uuid, bigint, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.liberar_reserva_de_ia(uuid) from public, anon, authenticated;

drop function if exists public.reservar_execucao_de_ia(uuid, uuid, uuid, text, bigint, text, jsonb);
drop function if exists public.consolidar_execucao_de_ia(uuid, bigint, text, text, jsonb);
drop function if exists public.liberar_reserva_de_ia(uuid);

-- Depois de aplicar: confirmar via advisors (mcp get_advisors, type
-- "security") que nenhuma das três mutações financeiras aparece mais
-- como exposta a `authenticated` — esse é o passo 8 do fechamento.
