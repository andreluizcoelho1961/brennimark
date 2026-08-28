create table public.brand_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  instance_key text not null,
  slug text not null,
  group_name text not null,
  title text not null,
  status text not null check (status in ('ready', 'draft', 'pending')),
  body jsonb not null default '[]'::jsonb check (jsonb_typeof(body) = 'array'),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  sort_order integer not null default 0,
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, instance_key, slug)
);

create table public.brand_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  instance_key text not null,
  label text not null,
  description text not null default '',
  category text not null default 'Outros',
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 26214400),
  status text not null default 'ready' check (status in ('ready', 'draft', 'pending')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index brand_documents_workspace_instance_idx
  on public.brand_documents(workspace_id, instance_key);
create index brand_assets_workspace_instance_idx
  on public.brand_assets(workspace_id, instance_key, created_at desc);
create index brand_documents_updated_by_idx on public.brand_documents(updated_by);
create index brand_assets_created_by_idx on public.brand_assets(created_by);

alter table public.brand_documents enable row level security;
alter table public.brand_assets enable row level security;

create policy "Members can read brand documents"
  on public.brand_documents for select to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_documents.workspace_id
      and workspace_members.user_id = (select auth.uid())
  ));

create policy "Owners can insert brand documents"
  on public.brand_documents for insert to authenticated
  with check (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_documents.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'
  ));

create policy "Owners can update brand documents"
  on public.brand_documents for update to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_documents.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'
  ))
  with check (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_documents.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'
  ));

create policy "Owners can delete brand documents"
  on public.brand_documents for delete to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_documents.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'
  ));

create policy "Members can read brand assets"
  on public.brand_assets for select to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_assets.workspace_id
      and workspace_members.user_id = (select auth.uid())
  ));

create policy "Owners can insert brand assets"
  on public.brand_assets for insert to authenticated
  with check (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_assets.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'
  ));

create policy "Owners can update brand assets"
  on public.brand_assets for update to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_assets.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'
  ))
  with check (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_assets.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'
  ));

create policy "Owners can delete brand assets"
  on public.brand_assets for delete to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = brand_assets.workspace_id
      and workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  false,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/svg+xml',
    'application/pdf', 'application/zip', 'application/postscript',
    'font/otf', 'font/ttf', 'font/woff', 'font/woff2',
    'application/vnd.ms-fontobject', 'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can download brand assets"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
    )
  );

create policy "Owners can upload brand assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'
    )
  );

create policy "Owners can update brand assets storage"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'
    )
  )
  with check (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'
    )
  );

create policy "Owners can delete brand assets storage"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'
    )
  );

revoke all on public.brand_documents from anon;
revoke all on public.brand_assets from anon;
grant select, insert, update, delete on public.brand_documents to authenticated;
grant select, insert, update, delete on public.brand_assets to authenticated;
