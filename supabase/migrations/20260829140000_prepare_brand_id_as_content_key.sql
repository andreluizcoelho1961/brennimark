-- Patch 0 — o esquema se prepara para a marca ser a chave do conteúdo.
--
-- Executado com o banco vazio de propósito. Preflight de 29/08/2026: zero
-- linhas em brands, brand_documents, brand_document_versions, brand_assets,
-- workspaces, workspace_members e profiles. Trocar a chave de identificação de
-- conteúdo com dado dentro é migração delicada; sem dado é declaração. Esta
-- janela fecha no primeiro manual importado.
--
-- Aditiva por construção: nenhuma coluna some, nenhuma restrição existente é
-- afrouxada, e o par workspace_id + instance_key continua valendo. A remoção
-- dele é patch próprio, depois que o caminho de escrita passar a preencher
-- brand_id e houver prova de que nada implantado ainda depende do par antigo.
--
-- Ver docs/plan/parecer-integracao-interface.md §4.

-- ---------------------------------------------------------------------------
-- 1. Isolamento entre contas, garantido pelo esquema
-- ---------------------------------------------------------------------------
-- A RLS decide o que cada pessoa enxerga. Ela não impede que uma linha
-- inconsistente seja gravada: um documento do workspace A apontando para uma
-- marca do workspace B passaria pela política de escrita de A e ficaria no
-- banco, invisível e errado. Uma chave estrangeira composta torna essa linha
-- impossível de existir, em vez de apenas difícil de ver.
--
-- Referenciável: id já é único como chave primária, mas o par precisa de uma
-- restrição própria para ser alvo de chave estrangeira.
alter table public.brands
  add constraint brands_id_workspace_key unique (id, workspace_id);

-- ---------------------------------------------------------------------------
-- 2. brand_documents
-- ---------------------------------------------------------------------------
-- A chave simples vira composta. Não é remoção de garantia: a composta contém
-- a simples e acrescenta a coerência de conta.
alter table public.brand_documents
  drop constraint brand_documents_brand_id_fkey;

alter table public.brand_documents
  add constraint brand_documents_brand_workspace_fkey
  foreign key (brand_id, workspace_id)
  references public.brands(id, workspace_id) on delete cascade;

-- Chave do upsert do caminho novo. Enquanto brand_id for nulo a restrição não
-- se aplica — nulos são distintos entre si em Postgres —, então as linhas da
-- transição convivem com ela sem conflito.
alter table public.brand_documents
  add constraint brand_documents_brand_slug_key unique (brand_id, slug);

-- ---------------------------------------------------------------------------
-- 3. brand_assets — a biblioteca também pertence à marca
-- ---------------------------------------------------------------------------
-- Mesmo raciocínio dos documentos: um manual tem seus arquivos, e hoje eles se
-- identificam pelo par antigo. Nulo durante a transição.
alter table public.brand_assets
  add column brand_id uuid;

alter table public.brand_assets
  add constraint brand_assets_brand_workspace_fkey
  foreign key (brand_id, workspace_id)
  references public.brands(id, workspace_id) on delete cascade;

create index brand_assets_brand_idx
  on public.brand_assets(brand_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 4. brand_document_versions — o histórico segue a mesma marca
-- ---------------------------------------------------------------------------
alter table public.brand_document_versions
  add column brand_id uuid;

alter table public.brand_document_versions
  add constraint brand_document_versions_brand_workspace_fkey
  foreign key (brand_id, workspace_id)
  references public.brands(id, workspace_id) on delete cascade;

create index brand_document_versions_brand_timeline_idx
  on public.brand_document_versions(brand_id, slug, created_at desc);

-- ---------------------------------------------------------------------------
-- 5. Vocabulário das ações do histórico
-- ---------------------------------------------------------------------------
-- `restored_to_matrix` nomeava um mundo que acabou: apagar a linha devolvia a
-- página à matriz em código. Sem matriz, apagar apaga. E restaurar passa a
-- significar a única coisa que ainda pode significar — trazer de volta uma
-- versão anterior do próprio banco.
--
-- Aqui só o vocabulário é ampliado. O gatilho continua emitindo o valor antigo
-- porque a interface do histórico ainda o interpreta (VersionHistory trata
-- qualquer outro valor como "Publicada", e um `deleted` emitido hoje seria
-- exibido como publicação). Emissão e rótulo mudam juntos no patch 2 — separar
-- os dois é o que evita um histórico que mente durante uma release.
alter table public.brand_document_versions
  drop constraint brand_document_versions_action_check;

alter table public.brand_document_versions
  add constraint brand_document_versions_action_check
  check (action in (
    'published',           -- página gravada
    'deleted',             -- página removida; não há para onde voltar
    'restored_from_version', -- conteúdo trazido de uma versão anterior
    'restored_to_matrix'   -- legado: mantido para linhas já gravadas
  ));

-- ---------------------------------------------------------------------------
-- 6. O gatilho passa a carregar a marca
-- ---------------------------------------------------------------------------
-- Idêntico ao de 20260827215051, com brand_id na coluna nova e no instantâneo.
-- Nenhuma mudança semântica: enquanto a escrita não preencher brand_id, o valor
-- gravado é nulo, como já era antes desta migração.
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
    workspace_id,
    brand_id,
    instance_key,
    slug,
    source_document_id,
    action,
    snapshot,
    changed_by,
    actor_label
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
