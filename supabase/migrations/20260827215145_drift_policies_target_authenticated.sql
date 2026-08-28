-- Drift D — alvejar `authenticated` em vez de `public`.
--
-- As policies fundacionais foram criadas com alvo `public`, que inclui anon.
-- Fechavam mesmo assim porque auth.uid() é nulo para visitante anônimo, mas as
-- migrations posteriores usam `to authenticated` e a divergência de convenção
-- tornava a leitura da postura de segurança mais difícil.
--
-- Comportamento efetivo permanece idêntico; muda a explicitude. O `select
-- auth.uid()` envolvido em subquery permite ao planner avaliar uma vez por
-- consulta em vez de por linha.

drop policy "Users can view own profile" on public.profiles;
drop policy "Users can insert own profile" on public.profiles;
drop policy "Users can update own profile" on public.profiles;

create policy "Users can view own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Users can insert own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users can update own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id);

drop policy "Members can view their workspaces" on public.workspaces;
create policy "Members can view their workspaces" on public.workspaces
  for select to authenticated using (id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));

drop policy "Users can view their own memberships" on public.workspace_members;
create policy "Users can view their own memberships" on public.workspace_members
  for select to authenticated using (user_id = (select auth.uid()));

drop policy "Members can view their workspace ai settings" on public.ai_settings;
drop policy "Members can insert ai settings for their workspace" on public.ai_settings;
drop policy "Members can update their workspace ai settings" on public.ai_settings;
drop policy "Members can delete their workspace ai settings" on public.ai_settings;

create policy "Members can view their workspace ai settings" on public.ai_settings
  for select to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));
create policy "Members can insert ai settings for their workspace" on public.ai_settings
  for insert to authenticated with check (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));
create policy "Members can update their workspace ai settings" on public.ai_settings
  for update to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));
create policy "Members can delete their workspace ai settings" on public.ai_settings
  for delete to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));
