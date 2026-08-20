create schema if not exists private;
revoke all on schema private from public;

create table public.brand_document_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  instance_key text not null,
  slug text not null,
  source_document_id uuid,
  action text not null check (action in ('published', 'restored_to_matrix')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  changed_by uuid references auth.users(id) on delete set null,
  actor_label text not null,
  created_at timestamptz not null default now()
);

create index brand_document_versions_timeline_idx
  on public.brand_document_versions(workspace_id, instance_key, slug, created_at desc);
create index brand_document_versions_changed_by_idx
  on public.brand_document_versions(changed_by);

alter table public.brand_document_versions enable row level security;

create policy "Members can read brand document versions"
  on public.brand_document_versions for select to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_document_versions.workspace_id
      and workspace_members.user_id = (select auth.uid())
  ));

revoke all on public.brand_document_versions from anon;
revoke all on public.brand_document_versions from authenticated;
grant select on public.brand_document_versions to authenticated;

create or replace function private.capture_brand_document_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_row public.brand_documents%rowtype;
  event_action text;
  actor_id uuid := (select auth.uid());
  resolved_actor_label text;
begin
  if tg_op = 'DELETE' then
    source_row := old;
    event_action := 'restored_to_matrix';
  else
    source_row := new;
    event_action := 'published';
  end if;

  if tg_op = 'UPDATE'
    and new.group_name is not distinct from old.group_name
    and new.title is not distinct from old.title
    and new.status is not distinct from old.status
    and new.body is not distinct from old.body
    and new.images is not distinct from old.images
    and new.sort_order is not distinct from old.sort_order then
    return new;
  end if;

  if actor_id is null or not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = source_row.workspace_id
      and workspace_members.user_id = actor_id
      and workspace_members.role = 'owner'
  ) then
    raise exception 'Only workspace owners can create editorial audit entries'
      using errcode = '42501';
  end if;

  select coalesce(nullif(profiles.full_name, ''), nullif(profiles.email, ''), 'Proprietário')
    into resolved_actor_label
  from public.profiles
  where profiles.id = actor_id;

  insert into public.brand_document_versions (
    workspace_id,
    instance_key,
    slug,
    source_document_id,
    action,
    snapshot,
    changed_by,
    actor_label
  ) values (
    source_row.workspace_id,
    source_row.instance_key,
    source_row.slug,
    source_row.id,
    event_action,
    jsonb_build_object(
      'slug', source_row.slug,
      'group', source_row.group_name,
      'title', source_row.title,
      'status', source_row.status,
      'body', source_row.body,
      'images', source_row.images,
      'sortOrder', source_row.sort_order,
      'updatedAt', source_row.updated_at
    ),
    actor_id,
    coalesce(resolved_actor_label, 'Proprietário')
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.capture_brand_document_version() from public, anon, authenticated;

create trigger capture_brand_document_version_after_change
  after insert or update or delete on public.brand_documents
  for each row execute function private.capture_brand_document_version();
