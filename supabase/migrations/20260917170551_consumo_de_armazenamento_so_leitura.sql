-- O consumo de armazenamento é só leitura para quem tem sessão — de verdade.
--
-- A migration anterior dava `grant select` e não revogava nada. No banco
-- hospedado, os privilégios padrão do Supabase dão INSERT, UPDATE e DELETE a
-- `authenticated` em toda tabela nova do `public`; no banco local, não. Medido
-- em 17/09/2026, logo depois de aplicar: produção com 4 privilégios, local com 1.
--
-- A RLS já recusava (só existe policy de SELECT), então nada foi gravável. Mas
-- a migration afirmava "ninguém escreve pela API", e uma afirmação sustentada
-- por um portão só é metade do que ela diz. As tabelas de registro anteriores
-- revogam explicitamente; esta passa a revogar também.
revoke all on public.consumo_de_armazenamento from anon, authenticated;
grant select on public.consumo_de_armazenamento to authenticated;
