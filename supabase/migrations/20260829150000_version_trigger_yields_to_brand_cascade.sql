-- Patch 0.1 — o gatilho de auditoria cede à cascata da marca.
--
-- Defeito encontrado pelo teste de cascata pedido na revisão do patch 0, e não
-- por leitura de código: apagar uma marca era impossível.
--
-- A sequência que trava: apagar a marca dispara a cascata para
-- brand_documents; cada documento apagado dispara este gatilho; o gatilho
-- tenta gravar uma linha em brand_document_versions apontando para
-- source_row.brand_id — a marca que a mesma transação acabou de remover. A
-- chave estrangeira composta recusa, e o DELETE inteiro é revertido:
--
--   23503: insert or update on table "brand_document_versions" violates
--          foreign key constraint "brand_document_versions_brand_workspace_fkey"
--
-- Duas correções eram possíveis. Trocar a cascata do histórico por SET NULL
-- preservaria a trilha de auditoria, mas os instantâneos guardam o corpo
-- inteiro das páginas: o conteúdo de uma marca apagada continuaria no banco
-- depois de a pessoa mandar apagá-la. Apagar uma marca é ato total, e a
-- expectativa de quem aperta o botão é que não sobre cópia.
--
-- Então o gatilho cede: se a marca do documento já não existe, a remoção veio
-- da cascata e não há contra o que auditar — o manual inteiro está indo junto.
-- Documento apagado individualmente, com a marca de pé, continua gerando
-- versão como antes.
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

  -- A marca sumiu antes do documento: isto é cascata, não edição.
  if tg_op = 'DELETE'
    and source_row.brand_id is not null
    and not exists (select 1 from public.brands where brands.id = source_row.brand_id) then
    return old;
  end if;

  if tg_op = 'UPDATE'
    and new.group_name is not distinct from old.group_name
    and new.title is not distinct from old.title
    and new.status is not distinct from old.status
    and new.body is not distinct from old.body
    and new.images is not distinct from old.images
    and new.blocks is not distinct from old.blocks
    and new.brand_id is not distinct from old.brand_id
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
    workspace_id, brand_id, instance_key, slug, source_document_id,
    action, snapshot, changed_by, actor_label
  ) values (
    source_row.workspace_id,
    source_row.brand_id,
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
      'brandId', source_row.brand_id,
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
