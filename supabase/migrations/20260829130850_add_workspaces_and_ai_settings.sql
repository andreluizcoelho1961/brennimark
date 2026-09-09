-- Workspaces: the tenant boundary for future multi-client use (studio
-- clients each get their own workspace). Today one profile == one
-- workspace, auto-provisioned on profile creation.
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

create policy "Members can view their workspaces"
  on public.workspaces for select
  using (id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "Users can view their own memberships"
  on public.workspace_members for select
  using (user_id = auth.uid());

-- Auto-provision a personal workspace whenever a profile is created
-- (onboarding upserts profiles; this only fires on the initial insert).
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace_id uuid;
begin
  insert into public.workspaces (name)
  values (coalesce(new.company, new.full_name, 'Workspace'))
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function public.handle_new_profile();

-- AI provider settings (BYOK): one row per saved provider credential,
-- tagged with which feature(s) it's meant for. The API key is
-- encrypted at the application layer (AES-256-GCM, server-only secret)
-- before it ever reaches Postgres — see src/lib/ai/crypto.ts.
create table public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  role text not null check (role in ('chat', 'analysis', 'both')),
  provider text not null check (provider in ('groq', 'anthropic', 'openai', 'google', 'openrouter')),
  model text not null,
  api_key_ciphertext text not null,
  api_key_iv text not null,
  api_key_last4 text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_settings_workspace_idx on public.ai_settings(workspace_id);

alter table public.ai_settings enable row level security;

create policy "Members can view their workspace ai settings"
  on public.ai_settings for select
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "Members can insert ai settings for their workspace"
  on public.ai_settings for insert
  with check (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "Members can update their workspace ai settings"
  on public.ai_settings for update
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));

create policy "Members can delete their workspace ai settings"
  on public.ai_settings for delete
  using (workspace_id in (select workspace_id from public.workspace_members where user_id = auth.uid()));
