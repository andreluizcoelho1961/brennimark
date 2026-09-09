create index analysis_runs_feedback_by_idx
  on public.analysis_runs(feedback_by)
  where feedback_by is not null;

create index analysis_runs_workspace_parent_idx
  on public.analysis_runs(workspace_id, parent_run_id)
  where parent_run_id is not null;

create index if not exists workspace_members_user_id_idx
  on public.workspace_members(user_id);
