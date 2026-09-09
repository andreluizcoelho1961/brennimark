-- Drift C — reduzir os grants padrão do Supabase ao mínimo necessário.
--
-- O padrão concede todos os privilégios a anon e authenticated. A RLS cobre
-- select/insert/update/delete, mas TRUNCATE NAO passa por RLS: a única
-- proteção era o PostgREST não expor a operação. REFERENCES e TRIGGER
-- também eram desnecessários.
--
-- anon fica sem nenhum privilégio: toda escrita em profiles ocorre com sessão
-- autenticada (src/app/onboarding/page.tsx exige getUser antes do upsert).

revoke all on public.profiles from anon, authenticated;
revoke all on public.workspaces from anon, authenticated;
revoke all on public.workspace_members from anon, authenticated;
revoke all on public.ai_settings from anon, authenticated;

-- profiles: upsert do onboarding precisa de insert + update; leitura no layout.
grant select, insert, update on public.profiles to authenticated;

-- workspaces e workspace_members: apenas leitura pelo app. A criação acontece
-- dentro de handle_new_profile(), que é SECURITY DEFINER e roda como owner.
grant select on public.workspaces to authenticated;
grant select on public.workspace_members to authenticated;

-- ai_settings: CRUD completo de BYOK pela própria pessoa.
grant select, insert, update, delete on public.ai_settings to authenticated;
