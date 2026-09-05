create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  parent_run_id uuid references public.analysis_runs(id) on delete set null,
  file_name text not null,
  image_media_type text not null check (image_media_type like 'image/%'),
  image_size_bytes integer not null check (image_size_bytes > 0 and image_size_bytes <= 10485760),
  image_fingerprint text not null,
  image_path text,
  question text not null,
  verdict text not null default 'unknown'
    check (verdict in ('aligned', 'partially_aligned', 'misaligned', 'unknown')),
  analysis jsonb not null,
  provider text not null,
  model text not null,
  fallback_used boolean not null default false,
  elapsed_ms integer not null check (elapsed_ms >= 0),
  attempts jsonb not null default '[]'::jsonb,
  feedback_rating text
    check (feedback_rating in ('correct', 'partial', 'incorrect')),
  feedback_note text,
  feedback_by uuid references auth.users(id) on delete set null,
  feedback_at timestamptz,
  calibration_enabled boolean not null default false,
  calibration_label text,
  calibration_expected_verdict text
    check (calibration_expected_verdict in ('aligned', 'partially_aligned', 'misaligned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analysis_runs_workspace_id_id_key unique (workspace_id, id),
  constraint analysis_runs_parent_same_workspace_fkey
    foreign key (workspace_id, parent_run_id)
    references public.analysis_runs(workspace_id, id),
  constraint analysis_runs_feedback_complete check (
    (feedback_rating is null and feedback_by is null and feedback_at is null)
    or (feedback_rating is not null and feedback_by is not null and feedback_at is not null)
  ),
  constraint analysis_runs_calibration_complete check (
    calibration_enabled = false
    or calibration_expected_verdict is not null
  )
);

create index analysis_runs_workspace_created_idx
  on public.analysis_runs(workspace_id, created_at desc);
create index analysis_runs_created_by_idx
  on public.analysis_runs(created_by);
create index analysis_runs_parent_idx
  on public.analysis_runs(parent_run_id)
  where parent_run_id is not null;
create index analysis_runs_feedback_idx
  on public.analysis_runs(workspace_id, feedback_rating)
  where feedback_rating is not null;
create index analysis_runs_calibration_idx
  on public.analysis_runs(workspace_id, calibration_enabled)
  where calibration_enabled = true;

alter table public.analysis_runs enable row level security;

grant select, insert, update, delete on public.analysis_runs to authenticated;

create policy "Members can view workspace analyses"
  on public.analysis_runs for select to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = analysis_runs.workspace_id
      and workspace_members.user_id = (select auth.uid())
  ));

create policy "Members can create workspace analyses"
  on public.analysis_runs for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = analysis_runs.workspace_id
        and workspace_members.user_id = (select auth.uid())
    )
  );

create policy "Members can update workspace analyses"
  on public.analysis_runs for update to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = analysis_runs.workspace_id
      and workspace_members.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = analysis_runs.workspace_id
      and workspace_members.user_id = (select auth.uid())
  ));

create policy "Members can delete workspace analyses"
  on public.analysis_runs for delete to authenticated
  using (exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = analysis_runs.workspace_id
      and workspace_members.user_id = (select auth.uid())
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'analysis-evidence',
  'analysis-evidence',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Members can view workspace analysis evidence"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
    )
  );

create policy "Members can upload workspace analysis evidence"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
    )
  );

create policy "Members can update workspace analysis evidence"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
    )
  );

create policy "Members can delete workspace analysis evidence"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'analysis-evidence'
    and exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id::text = (storage.foldername(name))[1]
        and workspace_members.user_id = (select auth.uid())
    )
  );
