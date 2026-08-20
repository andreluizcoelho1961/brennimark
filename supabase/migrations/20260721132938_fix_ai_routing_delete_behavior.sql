alter table public.ai_routing_policies
  drop constraint ai_routing_primary_setting_fkey,
  drop constraint ai_routing_fallback_setting_fkey;

alter table public.ai_routing_policies
  add constraint ai_routing_primary_setting_fkey
    foreign key (workspace_id, primary_setting_id)
    references public.ai_settings(workspace_id, id)
    on delete set null (primary_setting_id),
  add constraint ai_routing_fallback_setting_fkey
    foreign key (workspace_id, fallback_setting_id)
    references public.ai_settings(workspace_id, id)
    on delete set null (fallback_setting_id);
