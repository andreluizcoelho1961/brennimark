-- Links de entrega — ADR-0007 §2.5 — 30/09/2026.
--
-- ─── O que é ─────────────────────────────────────────────────────────────
--
-- Quem administra uma marca escolhe arquivos em Materiais e cria um link com
-- nome e prazo, para quem NÃO tem conta (a gráfica de um job). O link entrega
-- só aqueles arquivos, com a regra que governa cada um, expira sozinho, pode
-- ser revogado, e cada abertura e cada download ficam registrados.
--
-- ─── Decisões do André (30/09/2026) ──────────────────────────────────────
--
--   prazo: 7 dias se ninguém escolher, no máximo 30 — link "eterno" é o
--   WeTransfer que o produto existe para substituir;
--   quem abre se identifica com nome e e-mail, AUTODECLARADOS, antes de baixar;
--   a regra vai junto: as páginas do manual que regem cada item (as que quem
--   edita escolheu em Materiais), nunca o manual inteiro;
--   arquivo substituído depois: o link entrega a versão ATUAL e diz que foi
--   atualizado; retirado de uso sem substituto não é entregue.
--
-- ─── Como o código autoriza (ADR-0007 §2.5.1) ────────────────────────────
--
-- A RLS continua falando só de participação. Quem abre o link não tem sessão;
-- quem o atende é uma rota de servidor, que chama as duas funções abaixo com a
-- chave de serviço. TODA a conferência de quem abre — código, prazo, revogação,
-- arquivo pertencente ao link — vive nelas, num lugar só, auditável e provado
-- (`scripts/prova-links-de-entrega.sh`). A rota só assina o caminho que a
-- função devolveu, depois de conferir que ele é da marca.
--
-- O código do link NUNCA é guardado: só o SHA-256 dele, em hexadecimal. Quem lê
-- a tabela não ganha o poder de abrir link nenhum.
--
-- ─── Privilégios ─────────────────────────────────────────────────────────
--
-- No Supabase hospedado, tabela nova nasce com escrita para `authenticated`
-- (e no local, não). Por isso `revoke all` explícito em cada uma: quem
-- administra só LÊ as tabelas; criar e revogar passam pelas funções, que
-- conferem `administrar` na marca.

-- ─── 1. O link ───────────────────────────────────────────────────────────

create table public.links_de_entrega (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  brand_id         uuid not null,
  nome             text not null,
  destinatario     text not null default '',
  token_hash       text not null,
  expira_em        timestamptz not null,
  criado_por       uuid references auth.users(id) on delete set null,
  -- Copiado: o link continua dizendo quem o criou depois que a pessoa sai.
  criado_por_email text not null,
  created_at       timestamptz not null default clock_timestamp(),
  revogado_em      timestamptz,
  revogado_por     uuid references auth.users(id) on delete set null,

  constraint links_de_entrega_marca_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  constraint links_de_entrega_token_unico unique (token_hash),
  constraint links_de_entrega_token_forma check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint links_de_entrega_nome_check check (length(btrim(nome)) between 1 and 120),
  constraint links_de_entrega_destinatario_check check (length(destinatario) <= 120),
  constraint links_de_entrega_prazo_maximo
    check (expira_em > created_at and expira_em <= created_at + interval '30 days')
);

create index links_de_entrega_marca_idx on public.links_de_entrega (brand_id, created_at desc);
create index links_de_entrega_conta_idx on public.links_de_entrega (workspace_id, created_at desc);

-- ─── 2. Os arquivos de cada link ─────────────────────────────────────────
--
-- O arquivo ESCOLHIDO. O que o link entrega é a versão atual dele, seguindo
-- `substituido_por` na hora do download. Apagar o arquivo em definitivo o tira
-- do link; o registro de acessos guarda cópia do rótulo e do nome.

create table public.arquivos_do_link (
  link_id      uuid not null references public.links_de_entrega(id) on delete cascade,
  asset_id     uuid not null references public.brand_assets(id) on delete cascade,
  workspace_id uuid not null,
  brand_id     uuid not null,
  ordem        integer not null default 0,
  primary key (link_id, asset_id)
);

create index arquivos_do_link_asset_idx on public.arquivos_do_link (asset_id);

-- ─── 3. O registro de acessos ────────────────────────────────────────────
--
-- Só de acréscimo. `link_id` vira nulo se o link sumir com a marca; o nome do
-- link, o rótulo e o nome do arquivo ficam copiados, como em
-- `brand_asset_downloads`. Sem IP: nome e e-mail de terceiros já são dado
-- pessoal, e não há motivo para juntar mais.
--
-- Como no registro de download: prova que o download foi AUTORIZADO e
-- INICIADO (a pessoa recebeu um endereço válido), não que os bytes chegaram.

create table public.acessos_de_link (
  id           uuid primary key default gen_random_uuid(),
  link_id      uuid references public.links_de_entrega(id) on delete set null,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  brand_id     uuid not null,
  link_nome    text not null,
  evento       text not null,
  nome         text,
  email        text,
  asset_id     uuid references public.brand_assets(id) on delete set null,
  asset_label  text,
  file_name    text,
  created_at   timestamptz not null default clock_timestamp(),

  constraint acessos_de_link_evento_check check (evento in ('abriu', 'baixou')),
  -- Download sem identificação, ou abertura com arquivo, não existem.
  constraint acessos_de_link_download_completo check (
    (evento = 'baixou') = (nome is not null and email is not null and asset_label is not null and file_name is not null)
  )
);

create index acessos_de_link_link_idx on public.acessos_de_link (link_id, created_at desc);
create index acessos_de_link_marca_idx on public.acessos_de_link (brand_id, created_at desc);

-- ─── 4. RLS: quem administra a marca LÊ; ninguém escreve direto ──────────

alter table public.links_de_entrega enable row level security;
alter table public.arquivos_do_link enable row level security;
alter table public.acessos_de_link enable row level security;

create policy "Quem administra a marca lê os links dela" on public.links_de_entrega
  for select to authenticated using (public.tem_capacidade_na_marca(brand_id, 'administrar'));
create policy "Quem administra a marca lê os arquivos dos links" on public.arquivos_do_link
  for select to authenticated using (public.tem_capacidade_na_marca(brand_id, 'administrar'));
create policy "Quem administra a marca lê os acessos aos links" on public.acessos_de_link
  for select to authenticated using (public.tem_capacidade_na_marca(brand_id, 'administrar'));

revoke all on public.links_de_entrega from public, anon, authenticated;
revoke all on public.arquivos_do_link from public, anon, authenticated;
revoke all on public.acessos_de_link from public, anon, authenticated;
grant select on public.links_de_entrega to authenticated;
grant select on public.arquivos_do_link to authenticated;
grant select on public.acessos_de_link to authenticated;

-- ─── 5. Criar e revogar — quem administra a marca ────────────────────────

/*
 * Cria o link e a seleção numa transação só. O código é gerado pela rota e
 * chega aqui já como SHA-256: o banco nunca o vê em claro.
 *
 * Recusas, cada uma com constraint nomeada (a prova confere o nome):
 *   sem `administrar` na marca             → 42501
 *   seleção vazia ou acima de 60 arquivos  → links_de_entrega_selecao_check
 *   arquivo de outra marca ou inexistente  → arquivos_do_link_da_marca
 *   arquivo fora de uso                    → arquivos_do_link_em_uso
 *   fonte (ADR-0007 §3: só a membro autenticado) → arquivos_do_link_sem_fonte
 *   prazo fora de 1–30 dias                → links_de_entrega_prazo_maximo
 */
create function public.criar_link_de_entrega(
  p_brand_id uuid,
  p_nome text,
  p_destinatario text,
  p_dias integer,
  p_asset_ids uuid[],
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  conta uuid;
  novo uuid;
  quantos integer := coalesce(array_length(p_asset_ids, 1), 0);
  distintos integer;
  validos integer;
begin
  if quem is null or not public.tem_capacidade_na_marca(p_brand_id, 'administrar') then
    raise exception 'só quem administra a marca cria link de entrega' using errcode = '42501';
  end if;

  select b.workspace_id into conta from public.brands b where b.id = p_brand_id;

  select count(distinct x) into distintos from unnest(p_asset_ids) x;
  if quantos = 0 or quantos > 60 or distintos <> quantos then
    raise exception 'a seleção precisa ter de 1 a 60 arquivos, sem repetição'
      using errcode = 'check_violation', constraint = 'links_de_entrega_selecao_check', hint = 'links_de_entrega_selecao_check';
  end if;

  select count(*) into validos from public.brand_assets a
   where a.id = any (p_asset_ids) and a.brand_id = p_brand_id and a.workspace_id = conta;
  if validos <> quantos then
    raise exception 'arquivo que não é desta marca'
      using errcode = 'check_violation', constraint = 'arquivos_do_link_da_marca', hint = 'arquivos_do_link_da_marca';
  end if;

  if exists (select 1 from public.brand_assets a where a.id = any (p_asset_ids) and a.descontinuado_em is not null) then
    raise exception 'arquivo fora de uso não entra em link'
      using errcode = 'check_violation', constraint = 'arquivos_do_link_em_uso', hint = 'arquivos_do_link_em_uso';
  end if;

  if exists (
    select 1 from public.brand_assets a join public.brand_asset_items i on i.id = a.item_id
     where a.id = any (p_asset_ids) and i.tipo = 'fonte'
  ) then
    raise exception 'fonte só é servida a membro autenticado da marca (ADR-0007 §3)'
      using errcode = 'check_violation', constraint = 'arquivos_do_link_sem_fonte', hint = 'arquivos_do_link_sem_fonte';
  end if;

  insert into public.links_de_entrega
    (workspace_id, brand_id, nome, destinatario, token_hash, expira_em, criado_por, criado_por_email)
  values
    (conta, p_brand_id, btrim(p_nome), btrim(coalesce(p_destinatario, '')), p_token_hash,
     clock_timestamp() + make_interval(days => coalesce(p_dias, 7)),
     quem, coalesce((select u.email from auth.users u where u.id = quem), '(sem e-mail)'))
  returning id into novo;

  insert into public.arquivos_do_link (link_id, asset_id, workspace_id, brand_id, ordem)
  select novo, x.id, conta, p_brand_id, x.ordem::integer
    from unnest(p_asset_ids) with ordinality as x(id, ordem);

  return novo;
end;
$$;

revoke all on function public.criar_link_de_entrega(uuid, text, text, integer, uuid[], text) from public, anon;
grant execute on function public.criar_link_de_entrega(uuid, text, text, integer, uuid[], text) to authenticated;

/* Revoga. Revogar de novo não muda a data da primeira revogação. */
create function public.revogar_link_de_entrega(p_link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  marca uuid;
begin
  select l.brand_id into marca from public.links_de_entrega l where l.id = p_link_id;
  -- Link inexistente e link de marca alheia respondem igual.
  if quem is null or marca is null or not public.tem_capacidade_na_marca(marca, 'administrar') then
    raise exception 'link não encontrado' using errcode = '42501';
  end if;
  update public.links_de_entrega
     set revogado_em = clock_timestamp(), revogado_por = quem
   where id = p_link_id and revogado_em is null;
  return true;
end;
$$;

revoke all on function public.revogar_link_de_entrega(uuid) from public, anon;
grant execute on function public.revogar_link_de_entrega(uuid) to authenticated;

-- ─── 6. O lado de quem abre — só a rota de servidor chama ────────────────

/* A versão atual de um arquivo: segue as substituições (no máximo 50 saltos). */
create function private.versao_atual_do_arquivo(p_asset_id uuid)
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  atual uuid := p_asset_id;
  linha record;
  saltos integer := 0;
begin
  loop
    select a.id, a.descontinuado_em, a.substituido_por into linha from public.brand_assets a where a.id = atual;
    if linha.id is null then return null; end if;
    if linha.descontinuado_em is null then return linha.id; end if;
    if linha.substituido_por is null or saltos >= 50 then return null; end if;
    atual := linha.substituido_por;
    saltos := saltos + 1;
  end loop;
end;
$$;

revoke all on function private.versao_atual_do_arquivo(uuid) from public, anon, authenticated;

/*
 * O que a página pública mostra. Devolve SEMPRE o estado — `inexistente`,
 * `expirado`, `revogado` ou `ativo` — e só no `ativo` o conteúdo: nome do link,
 * marca, prazo, os arquivos (na versão atual) e as páginas que regem cada item,
 * com título, status e o caminho da imagem de leitura, quando existir.
 *
 * Não registra nada: a abertura é registrada por `registrar_acesso_ao_link`.
 */
create function public.abrir_link_de_entrega(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  link public.links_de_entrega%rowtype;
  documento uuid;
begin
  select * into link from public.links_de_entrega l where l.token_hash = p_token_hash;
  if link.id is null then return jsonb_build_object('estado', 'inexistente'); end if;
  if link.revogado_em is not null then return jsonb_build_object('estado', 'revogado'); end if;
  if link.expira_em <= clock_timestamp() then return jsonb_build_object('estado', 'expirado'); end if;

  -- O manual da marca é a importação mais recente (a mesma escolha de Materiais).
  select i.source_document_id into documento from public.brand_imports i
   where i.brand_id = link.brand_id and i.workspace_id = link.workspace_id
   order by i.created_at desc limit 1;

  return jsonb_build_object(
    'estado', 'ativo',
    'link', jsonb_build_object(
      'id', link.id, 'nome', link.nome, 'destinatario', link.destinatario,
      'expira_em', link.expira_em, 'workspace_id', link.workspace_id, 'brand_id', link.brand_id,
      'marca', (select b.name from public.brands b where b.id = link.brand_id)),
    'arquivos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.asset_id,
               'atual_id', v.id,
               'retirado', v.id is null,
               'atualizado_em', case when v.id is not null and v.id <> f.asset_id then v.created_at end,
               'label', coalesce(v.label, o.label),
               'file_name', coalesce(v.file_name, o.file_name),
               'mime_type', coalesce(v.mime_type, o.mime_type),
               'size_bytes', coalesce(v.size_bytes, o.size_bytes),
               'miniatura_path', v.miniatura_path,
               -- Só para a rota de servidor, que assina ANTES de registrar (a ordem
               -- do download desde o #37). A página nunca o repassa ao navegador.
               'storage_path', v.storage_path,
               'item_id', it.id, 'item_nome', it.nome, 'item_tipo', it.tipo,
               'regra_paginas', coalesce(to_jsonb(it.regra_paginas), '[]'::jsonb))
             order by f.ordem)
        from public.arquivos_do_link f
        join public.brand_assets o on o.id = f.asset_id
        left join public.brand_assets v on v.id = private.versao_atual_do_arquivo(f.asset_id)
        left join public.brand_asset_items it on it.id = coalesce(v.item_id, o.item_id)
       where f.link_id = link.id), '[]'::jsonb),
    'paginas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'pagina', p.pagina, 'titulo', d.title, 'status', d.status, 'imagem_path', p.miniatura_path)
             order by p.pagina)
        from public.brand_source_pages p
        left join public.brand_documents d on d.id = p.document_id
       where documento is not null
         and p.source_document_id = documento
         and p.pagina in (
           select distinct unnest(it.regra_paginas)
             from public.arquivos_do_link f
             join public.brand_assets o on o.id = f.asset_id
             join public.brand_asset_items it on it.id = o.item_id
            where f.link_id = link.id)), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.abrir_link_de_entrega(text) from public, anon, authenticated;
grant execute on function public.abrir_link_de_entrega(text) to service_role;

/*
 * Registra o acesso e, no download, devolve o que entregar. A ORDEM é a do
 * download de hoje: registrar antes de emitir o endereço. Se o registro falha,
 * nada é entregue.
 *
 *   'abriu'  — sem arquivo e sem identificação;
 *   'baixou' — nome e e-mail (autodeclarados) e de 1 a 60 arquivos DO LINK.
 *              Devolve, para cada um, a versão atual: id, caminho e nome.
 *              Arquivo retirado de uso não é entregue nem registrado.
 *
 * Recusas: link inexistente, revogado ou vencido → P0002 com o estado;
 * identificação ausente ou malformada → acessos_de_link_identificacao;
 * arquivo que não é do link → arquivos_do_link_pertence;
 * versão assinada que deixou de ser a atual → arquivos_do_link_versao_mudou.
 */
create function public.registrar_acesso_ao_link(
  p_token_hash text,
  p_evento text,
  p_nome text,
  p_email text,
  p_asset_ids uuid[],
  p_versoes uuid[] default null
)
returns table (asset_id uuid, atual_id uuid, storage_path text, file_name text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  link public.links_de_entrega%rowtype;
  pedidos integer := coalesce(array_length(p_asset_ids, 1), 0);
  do_link integer;
begin
  select * into link from public.links_de_entrega l where l.token_hash = p_token_hash for share;
  if link.id is null then
    raise exception 'inexistente' using errcode = 'P0002';
  elsif link.revogado_em is not null then
    raise exception 'revogado' using errcode = 'P0002';
  elsif link.expira_em <= clock_timestamp() then
    raise exception 'expirado' using errcode = 'P0002';
  end if;

  if p_evento = 'abriu' then
    insert into public.acessos_de_link (link_id, workspace_id, brand_id, link_nome, evento)
    values (link.id, link.workspace_id, link.brand_id, link.nome, 'abriu');
    return;
  end if;

  if p_evento is distinct from 'baixou' then
    raise exception 'evento desconhecido' using errcode = 'check_violation', constraint = 'acessos_de_link_evento_check', hint = 'acessos_de_link_evento_check';
  end if;

  if length(btrim(coalesce(p_nome, ''))) not between 1 and 120
     or length(coalesce(p_email, '')) > 254
     or coalesce(p_email, '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'nome e e-mail são pedidos antes de baixar'
      using errcode = 'check_violation', constraint = 'acessos_de_link_identificacao', hint = 'acessos_de_link_identificacao';
  end if;

  select count(*) into do_link from public.arquivos_do_link f
   where f.link_id = link.id and f.asset_id = any (p_asset_ids);
  if pedidos = 0 or pedidos > 60 or do_link <> pedidos then
    raise exception 'arquivo que não é deste link'
      using errcode = 'check_violation', constraint = 'arquivos_do_link_pertence', hint = 'arquivos_do_link_pertence';
  end if;

  -- As versões que a rota já ASSINOU, na ordem dos pedidos. Se alguma não é
  -- mais a atual (substituída entre a assinatura e aqui), nada é gravado: o
  -- registro diria um arquivo e o endereço entregaria outro.
  if p_versoes is not null and p_versoes is distinct from (
    select array_agg(private.versao_atual_do_arquivo(x.id) order by x.ordem)
      from unnest(p_asset_ids) with ordinality as x(id, ordem)
  ) then
    raise exception 'a versão de um arquivo mudou; peça de novo'
      using errcode = 'check_violation', constraint = 'arquivos_do_link_versao_mudou', hint = 'arquivos_do_link_versao_mudou';
  end if;

  -- Primeiro o registro; só depois o que entregar. Retirado de uso (sem
  -- versão atual) não entra em nenhum dos dois.
  insert into public.acessos_de_link
    (link_id, workspace_id, brand_id, link_nome, evento, nome, email, asset_id, asset_label, file_name)
  select link.id, link.workspace_id, link.brand_id, link.nome, 'baixou',
         btrim(p_nome), lower(btrim(p_email)), a.id, a.label, a.file_name
    from public.arquivos_do_link f
    join public.brand_assets a on a.id = private.versao_atual_do_arquivo(f.asset_id)
   where f.link_id = link.id and f.asset_id = any (p_asset_ids)
   order by f.ordem;

  return query
  select f.asset_id, a.id, a.storage_path, a.file_name
    from public.arquivos_do_link f
    join public.brand_assets a on a.id = private.versao_atual_do_arquivo(f.asset_id)
   where f.link_id = link.id and f.asset_id = any (p_asset_ids)
   order by f.ordem;
end;
$$;

revoke all on function public.registrar_acesso_ao_link(text, text, text, text, uuid[], uuid[]) from public, anon, authenticated;
grant execute on function public.registrar_acesso_ao_link(text, text, text, text, uuid[], uuid[]) to service_role;
