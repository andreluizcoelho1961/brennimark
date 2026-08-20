create index if not exists ai_routing_policies_primary_composite_idx
  on public.ai_routing_policies (workspace_id, primary_setting_id)
  where primary_setting_id is not null;

create index if not exists ai_routing_policies_fallback_composite_idx
  on public.ai_routing_policies (workspace_id, fallback_setting_id)
  where fallback_setting_id is not null;
