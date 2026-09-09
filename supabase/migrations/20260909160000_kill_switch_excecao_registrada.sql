-- A exceção de advisor que faltava registrar.
--
-- O linter do Supabase acusa `public.kill_switch_ativo` na regra 0029:
-- `SECURITY DEFINER` executável por `authenticated`. A acusação está correta —
-- é exatamente isso que a função é. O que faltava era a justificativa escrita,
-- e uma dívida de auditoria sem justificativa é indistinguível de um descuido.
--
-- Esta migração NÃO muda comportamento. Nenhum grant, nenhum corpo de função,
-- nenhuma política. Só registra, no lugar onde o auditor olha, por que a
-- exceção existe e sob quais condições ela continua aceitável.
--
-- ─── Por que não se revoga ───────────────────────────────────────────────
--
-- RLS de `ai_budgets` é owner-only, de propósito: teto, gasto e configuração
-- de orçamento não são de quem consulta. Mas quem dispara uma execução de IA
-- PRECISA saber se está pausado, e quem dispara costuma ser `member`, não
-- `owner`. Revogar de `authenticated` deixaria o membro sem resposta e a
-- execução seguiria contra um kill switch ligado — o oposto do que a
-- funcionalidade existe para fazer.
--
-- ─── Por que a exceção é estreita ────────────────────────────────────────
--
-- A função devolve DOIS BOOLEANOS e nada mais. Não expõe teto, gasto, moeda,
-- nem a existência de linha de orçamento além do fato de estar pausado. E
-- cobra duas condições antes de responder:
--
--   1. `auth.uid()` não nulo               -> 28000, autenticação exigida
--   2. o chamador é membro do workspace    -> 42501, e a checagem é no banco
--
-- É essa estreiteza que torna a exceção aceitável, e não o fato de ser
-- conveniente. Um teste guarda as duas condições: se alguma sair, a exceção
-- deixa de valer e o teste reprova — ver `src/platform/leak-guard.test.ts`.

comment on function public.kill_switch_ativo(uuid, uuid) is
  'Leitura do kill switch (workspace e marca) para quem é member, não só '
  'owner — RLS de ai_budgets é owner-only, mas quem dispara a chamada '
  'precisa saber se está pausado. Não expõe teto, gasto nem mais nada da '
  'linha de orçamento. '
  'EXCEÇÃO DE ADVISOR REGISTRADA em 09/09/2026 (regra 0029, SECURITY DEFINER '
  'executável por authenticated): intencional e estreita. Devolve apenas dois '
  'booleanos, exige auth.uid() não nulo (28000) e exige pertencer ao workspace '
  '(42501), verificado no banco. A exceção vale ENQUANTO essas condições '
  'valerem; guarda em src/platform/leak-guard.test.ts.';
