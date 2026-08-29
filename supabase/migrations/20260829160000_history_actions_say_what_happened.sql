-- Patch 2 — o histórico passa a dizer o que aconteceu.
--
-- O patch 0 ampliou o vocabulário mas manteve o gatilho emitindo
-- `restored_to_matrix`, porque a interface ainda interpretava qualquer outro
-- valor como "Publicada" e um `deleted` apareceria como publicação. Emissão e
-- rótulo mudam agora, no mesmo patch — que é o que evita um histórico que
-- mente durante uma release.
--
-- Apagar uma página passa a ser `deleted`. Sem matriz em código, não há para
-- onde voltar: o nome antigo descrevia um mundo que acabou.
--
-- Recuperar uma versão passa a ser `restored_from_version`. Como o gatilho só
-- enxerga a linha, e não a intenção de quem escreveu, a intenção vira coluna:
-- quem recupera grava o identificador da versão de origem, e o gatilho lê dali.
-- Alternativa descartada: configuração de sessão (`set local`), que não
-- atravessa o PostgREST e deixaria a intenção fora da linha — invisível para
-- qualquer leitura futura do banco. Com a coluna, o instantâneo também guarda
-- de qual versão a recuperação veio, o que a linha do tempo pode mostrar.
alter table public.brand_documents
  add column restored_from_version_id uuid
  references public.brand_document_versions(id) on delete set null;

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
    event_action := 'deleted';
  else
    source_row := new;
    -- Recuperação é uma escrita como outra qualquer; o que a distingue é a
    -- origem declarada. Só conta quando o valor MUDA: salvar de novo depois de
    -- recuperar volta a ser publicação.
    if new.restored_from_version_id is not null
      and (tg_op = 'INSERT'
           or new.restored_from_version_id is distinct from old.restored_from_version_id) then
      event_action := 'restored_from_version';
    else
      event_action := 'published';
    end if;
  end if;

  -- A marca sumiu antes do documento: isto é cascata, não edição. Ver o
  -- patch 0.1.
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
    and new.restored_from_version_id is not distinct from old.restored_from_version_id
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
      'restoredFromVersionId', source_row.restored_from_version_id,
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
