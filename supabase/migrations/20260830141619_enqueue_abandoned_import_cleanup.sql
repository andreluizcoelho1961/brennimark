-- A limpeza de uma importação abandonada também precisa ser durável.
--
-- Quando o upload é novo e a publicação falha, o cliente remove o arquivo.
-- Esse é o caminho feliz. Se a remoção falhar, o objeto existe sem marca, sem
-- procedência e sem entrada na fila: o caminho sobrevive só no estado daquela
-- aba do navegador, e some quando alguém a fecha. O arquivo fica no bucket
-- para sempre, sem nada no banco que aponte para ele.
--
-- Esta função recebe a conta, a importação e o hash, RECONSTRÓI o caminho e
-- registra a limpeza na mesma fila que a exclusão de marca usa. O cliente a
-- chama quando a remoção imediata não dá certo.
--
-- A recusa importante: um caminho que pertence a uma importação publicada não
-- pode ser enfileirado. Sem isso, quem administra poderia mandar apagar o PDF
-- de uma marca viva e deixá-la sem procedência.
create or replace function public.enqueue_import_cleanup(
  p_workspace_id uuid,
  p_import_id uuid,
  p_pdf_sha256 text
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  caminho text;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = p_workspace_id
      and workspace_members.user_id = actor
      and workspace_members.role = 'owner'
  ) then
    raise exception 'only workspace owners can clean up an import' using errcode = '42501';
  end if;

  caminho := p_workspace_id::text || '/' || p_import_id::text || '/' || p_pdf_sha256 || '.pdf';

  if exists (
    select 1 from public.brand_imports
    where brand_imports.workspace_id = p_workspace_id
      and brand_imports.storage_path = caminho
  ) then
    raise exception 'this file belongs to a published import' using errcode = '23505';
  end if;

  -- Idempotente: repetir a mesma limpeza não duplica a pendência.
  insert into public.brand_deletions (workspace_id, storage_path, requested_by)
  values (p_workspace_id, caminho, actor)
  on conflict (workspace_id, storage_path) do nothing;

  return true;
end;
$$;

revoke execute on function public.enqueue_import_cleanup(uuid, uuid, text) from public, anon;
grant execute on function public.enqueue_import_cleanup(uuid, uuid, text) to authenticated;
