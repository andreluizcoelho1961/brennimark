-- Drift — fecha os grants de anon que sobraram em duas tabelas.
--
-- `analysis_runs` e `ai_routing_policies` concediam privilégios a
-- `authenticated` sem revogar de `anon`, então mantinham o grant padrão do
-- Supabase: todos os privilégios, inclusive TRUNCATE.
--
-- TRUNCATE não passa por RLS. A proteção efetiva era o PostgREST não expor a
-- operação — não a política. Mesmo problema já corrigido nas tabelas
-- fundacionais em 20260827215129; estas duas passaram batido.
--
-- Descoberto ao aplicar a série inteira num projeto limpo, que é precisamente
-- o que o teste de stack limpa (PR-10 do WP0) existe para pegar.

revoke all on public.analysis_runs from anon;
revoke all on public.ai_routing_policies from anon;

-- Reafirma o que authenticated precisa, para o revoke acima não deixar dúvida.
grant select, insert, update, delete on public.analysis_runs to authenticated;
grant select, insert, update, delete on public.ai_routing_policies to authenticated;
