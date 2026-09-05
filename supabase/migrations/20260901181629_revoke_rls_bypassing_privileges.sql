-- S0 — privilégios que contornam a RLS.
--
-- `TRUNCATE` não passa por Row Level Security. Uma sessão autenticada com esse
-- privilégio apaga a tabela inteira — o conteúdo de TODAS as contas — por cima
-- de políticas que só sabem filtrar linha a linha.
--
-- O repositório já reconhecia essa propriedade em
-- 20260827215129_drift_restrict_foundational_grants.sql, e a redução não
-- cobriu as tabelas criadas depois. Estado encontrado em produção:
--
--   ai_routing_policies   TRUNCATE, REFERENCES, TRIGGER
--   analysis_runs         TRUNCATE, REFERENCES, TRIGGER
--   brand_assets          TRUNCATE, REFERENCES, TRIGGER
--   brand_documents       REFERENCES, TRIGGER
--
-- `REFERENCES` e `TRIGGER` saem junto: nenhum caminho da aplicação cria chave
-- estrangeira ou gatilho em tempo de execução, e um gatilho definido por quem
-- usa roda com privilégio de quem escreve na tabela.
revoke truncate, references, trigger on all tables in schema public
  from authenticated, anon;

-- A parte que impede a reincidência: sem isto, a PRÓXIMA tabela criada nasce
-- com os privilégios padrão do Supabase outra vez, e a correção precisa ser
-- lembrada a cada migração. Foi exatamente o que aconteceu aqui.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from authenticated, anon;

-- `anon` não tem o que fazer em nenhuma tabela: todo acesso passa por sessão.
revoke all on all tables in schema public from anon;

alter default privileges in schema public
  revoke all on tables from anon;
