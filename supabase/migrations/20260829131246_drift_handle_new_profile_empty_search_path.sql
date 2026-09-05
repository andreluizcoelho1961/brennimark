-- Drift E — search_path vazio em handle_new_profile().
--
-- A função é SECURITY DEFINER e usava search_path = 'public'. A convenção
-- adotada em capture_brand_document_version é search_path = '' com todos os
-- nomes qualificados, para que a resolução não dependa do search_path de quem
-- dispara o trigger. Os nomes já estavam qualificados; muda só a garantia.

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
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
