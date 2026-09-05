alter table public.ai_settings
  add constraint ai_settings_workspace_id_id_key unique (workspace_id, id);

create table public.ai_routing_policies (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feature text not null check (feature in ('chat', 'analysis')),
  primary_setting_id uuid,
  fallback_setting_id uuid,
  first_chunk_timeout_ms integer not null default 8000 check (first_chunk_timeout_ms between 3000 and 60000),
  allow_cross_provider boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, feature),
  constraint ai_routing_primary_setting_fkey foreign key (workspace_id, primary_setting_id)
    references public.ai_settings(workspace_id, id),
  constraint ai_routing_fallback_setting_fkey foreign key (workspace_id, fallback_setting_id)
    references public.ai_settings(workspace_id, id),
  constraint ai_routing_distinct_settings check (
    primary_setting_id is null or fallback_setting_id is null or primary_setting_id <> fallback_setting_id
  )
);

create index ai_routing_policies_primary_setting_idx on public.ai_routing_policies(primary_setting_id)
  where primary_setting_id is not null;
create index ai_routing_policies_fallback_setting_idx on public.ai_routing_policies(fallback_setting_id)
  where fallback_setting_id is not null;

alter table public.ai_routing_policies enable row level security;
grant select, insert, update, delete on public.ai_routing_policies to authenticated;

create policy "Members can view their workspace ai routing"
  on public.ai_routing_policies for select to authenticated
  using (exists (select 1 from public.workspace_members
    where workspace_members.workspace_id = ai_routing_policies.workspace_id
      and workspace_members.user_id = (select auth.uid())));

create policy "Members can insert their workspace ai routing"
  on public.ai_routing_policies for insert to authenticated
  with check (exists (select 1 from public.workspace_members
    where workspace_members.workspace_id = ai_routing_policies.workspace_id
      and workspace_members.user_id = (select auth.uid())));

create policy "Members can update their workspace ai routing"
  on public.ai_routing_policies for update to authenticated
  using (exists (select 1 from public.workspace_members
    where workspace_members.workspace_id = ai_routing_policies.workspace_id
      and workspace_members.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workspace_members
    where workspace_members.workspace_id = ai_routing_policies.workspace_id
      and workspace_members.user_id = (select auth.uid())));

create policy "Members can delete their workspace ai routing"
  on public.ai_routing_policies for delete to authenticated
  using (exists (select 1 from public.workspace_members
    where workspace_members.workspace_id = ai_routing_policies.workspace_id
      and workspace_members.user_id = (select auth.uid())));
