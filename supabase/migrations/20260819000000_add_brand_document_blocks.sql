alter table public.brand_documents
  add column blocks jsonb not null default '[]'::jsonb
  check (jsonb_typeof(blocks) = 'array');

-- Same function as 20260721193403, with `blocks` in both the no-op guard and
-- the snapshot. Snapshots written before this migration simply lack the key.
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
    and new.blocks is not distinct from old.blocks
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
      'blocks', source_row.blocks,
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
