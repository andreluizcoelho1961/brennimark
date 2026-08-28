-- Migração 1, PR 1 — a marca passa a ser dado.
--
-- Hoje a configuração de uma marca é um arquivo TypeScript no repositório e
-- brand_documents é apenas camada de sobreposição. Esta tabela é o começo da
-- inversão: a conta (workspace) passa a conter marcas.
--
-- Ver docs/adr/0003-produto-hospedado-multi-marca.md e
-- docs/plan/migracao-1-conteudo-vira-dado.md
--
-- Aditiva: nada existente é alterado. O registro em código continua sendo a
-- fonte até o PR 2 ler daqui.

create table public.brands (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,

  -- Slug estável da marca dentro da conta. Mesmo formato do antigo
  -- instance_key, para a migração de dados ser direta.
  key           text not null check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  name          text not null check (length(name) between 1 and 120),
  short_name    text not null check (length(short_name) between 1 and 60),
  descriptor    text not null check (length(descriptor) between 1 and 240),
  language      text not null default 'pt-BR' check (length(language) between 2 and 10),

  -- Blocos de configuração que hoje vivem no objeto BrandvilleInstance.
  metadata      jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  navigation    jsonb not null default '{}'::jsonb check (jsonb_typeof(navigation) = 'object'),
  theme         jsonb not null check (jsonb_typeof(theme) = 'object'),
  ai            jsonb not null check (jsonb_typeof(ai) = 'object'),
  legal         jsonb not null default '{}'::jsonb check (jsonb_typeof(legal) = 'object'),

  -- Vocabulário editorial próprio da marca. Ausente = rótulos do produto.
  status_labels jsonb check (status_labels is null or jsonb_typeof(status_labels) = 'object'),

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Uma conta não tem duas marcas com a mesma chave. Contas diferentes podem.
  unique (workspace_id, key)
);

create index brands_workspace_idx on public.brands(workspace_id);

-- brand_documents deixa de ser sobreposição e passa a apontar para a marca.
-- Nulo durante a transição: as linhas atuais ainda se identificam pelo par
-- workspace_id + instance_key, que sai quando a migração terminar.
alter table public.brand_documents
  add column brand_id uuid references public.brands(id) on delete cascade;

create index brand_documents_brand_idx on public.brand_documents(brand_id);

alter table public.brands enable row level security;

-- Leitura: qualquer membro da conta vê as marcas dela.
create policy "Members can view brands in their workspace" on public.brands
  for select to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));

-- Escrita: apenas owner. Criar e configurar marca é administração — a
-- capacidade `administrar` do ADR-0002, que hoje só o owner possui.
create policy "Owners can create brands in their workspace" on public.brands
  for insert to authenticated with check (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Owners can update brands in their workspace" on public.brands
  for update to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Owners can delete brands in their workspace" on public.brands
  for delete to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

-- Grants mínimos, como nas tabelas fundacionais: anon não toca.
revoke all on public.brands from anon, authenticated;
grant select, insert, update, delete on public.brands to authenticated;
