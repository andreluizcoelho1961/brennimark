-- Acesso por MARCA, e não por conta.
--
-- ─── O furo que esta migration fecha ─────────────────────────────────────
--
-- Até aqui a autorização resolvia por conta: `workspace_members` guarda
-- `(workspace_id, user_id, role)`, `role` aceita só `owner` e `member`, e as 37
-- policies do esquema perguntavam "esta pessoa pertence à conta?". Quem entrava
-- para trabalhar numa marca alcançava TODAS as marcas daquela conta.
--
-- Enquanto o produto expunha só nomes de marca, o dano era informação
-- comercial. Com a biblioteca de assets no ar (ADR-0007), o mesmo furo passa a
-- vazar ARQUIVO: o fornecedor convidado para uma marca baixa o vetor de outra —
-- inclusive de um rebrand não anunciado, e a fonte licenciada, que é o item de
-- maior consequência jurídica do acervo.
--
-- Por isso o ADR-0007 §5 condiciona a biblioteca a esta mudança, e por isso ela
-- é UMA migration: metade das policies convertidas deixa o vazamento de pé.
--
-- ─── O modelo, decidido por André em 13/09/2026 ──────────────────────────
--
-- Uma linha por (marca, pessoa), guardando CAPACIDADES — o vocabulário que o
-- ADR-0002 definiu em palavras e que nunca existiu no banco. O acesso é
-- escolhido marca a marca: alguém pode ter a marca A e a C e não a B.
--
-- `workspace_members` continua existindo com outro papel: dizer quem pertence à
-- conta e quem administra a CONTA — assinatura, convites, chaves de IA. Ela
-- para de decidir o que a pessoa pode fazer DENTRO de cada marca.
--
-- Regra que impede o tiro no pé: quem administra a conta pode sempre conceder
-- acesso a si mesmo em qualquer marca dela (policy de escrita em
-- `brand_members`, abaixo). Assim dá para restringir qualquer pessoa por marca
-- sem ninguém se trancar para fora do próprio acervo.

-- ════════════════════════════════════════════════════════════════════════
-- 1. A tabela de acesso
-- ════════════════════════════════════════════════════════════════════════
create table public.brand_members (
  brand_id     uuid not null,
  workspace_id uuid not null,
  user_id      uuid not null references auth.users(id) on delete cascade,

  /*
   * As capacidades do ADR-0002, como conjunto.
   *
   * Conjunto e não papel: a mesma pessoa pode editar a marca A e apenas
   * consultar a B, e papel fixo obrigaria a inventar um nome para cada
   * combinação. É também o que separa `editar` de `aprovar` — hoje o `owner`
   * recebe as duas juntas porque o papel é único.
   */
  capacidades  text[] not null default array['consultar']::text[],

  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users(id),

  primary key (brand_id, user_id),

  -- Composta, como todo vínculo com marca neste esquema: uma linha não pode
  -- dizer que é da marca X e da conta Y quando a marca X pertence a outra.
  constraint brand_members_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade,

  -- Vocabulário fechado. Capacidade escrita errada é acesso que ninguém
  -- entende: não falha, só nunca casa.
  constraint brand_members_capacidades_conhecidas check (
    capacidades <@ array['consultar', 'editar', 'aprovar', 'administrar']::text[]
  ),
  constraint brand_members_capacidades_nao_vazias check (
    array_length(capacidades, 1) >= 1
  )
);

-- "Quais marcas esta pessoa alcança?" é a pergunta de toda tela e de toda
-- policy. Sem este índice ela varre a tabela a cada consulta.
create index brand_members_pessoa_idx on public.brand_members (user_id, brand_id);
create index brand_members_conta_idx on public.brand_members (workspace_id);

alter table public.brand_members enable row level security;

/*
 * O privilégio de tabela, além da RLS.
 *
 * São dois portões diferentes e ambos precisam abrir: o GRANT diz se o papel
 * alcança a tabela, a RLS diz quais linhas ele vê. Sem o grant, o `select`
 * dentro de `tem_capacidade_na_marca` levanta 42501 — e como toda policy nova
 * chama essa função, a conta inteira ficaria sem ler nada. Foi exatamente o
 * que `scripts/prova-acesso-por-marca.sh` pegou nesta migration.
 *
 * `anon` não recebe nada, como em todas as outras tabelas do esquema.
 */
grant select, insert, update, delete on public.brand_members to authenticated;

/*
 * Quem vê a lista de acesso.
 *
 * A pessoa vê as PRÓPRIAS linhas — é o que a função de capacidade precisa. E
 * quem administra a conta vê e administra todas as linhas da conta, porque é
 * quem convida, quem remove e quem responde pelo acesso.
 *
 * O que NÃO existe de propósito: membro comum vendo quem mais tem acesso. O
 * brainstorm registrou que o sensível não é o manual, é a LISTA — duas agências
 * rivais na mesma conta não podem se enxergar.
 */
create policy "Pessoas veem o próprio acesso" on public.brand_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Quem administra a conta vê o acesso dela" on public.brand_members
  for select to authenticated
  using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Quem administra a conta concede acesso" on public.brand_members
  for insert to authenticated
  with check (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Quem administra a conta altera o acesso" on public.brand_members
  for update to authenticated
  using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Quem administra a conta remove o acesso" on public.brand_members
  for delete to authenticated
  using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

-- ════════════════════════════════════════════════════════════════════════
-- 2. A pergunta, num lugar só
-- ════════════════════════════════════════════════════════════════════════
--
-- Vinte e quatro policies fazem a MESMA pergunta. Repetir a subconsulta em cada
-- uma é repetir a chance de escrever uma diferente das outras — e policy que
-- diverge das vizinhas é o defeito que ninguém vê até vazar.
--
-- INVOKER de propósito, não `SECURITY DEFINER`: ela lê `brand_members` com a
-- RLS da própria pessoa valendo, e a policy acima já garante que cada uma vê só
-- as suas linhas. Uma função definer aqui teria de ser fechada com `revoke`
-- (CLAUDE.md), e policies precisam executá-la — a combinação não existe.
create function public.tem_capacidade_na_marca(p_brand_id uuid, p_capacidade text)
returns boolean
language sql
stable
set search_path to ''
as $$
  select exists (
    select 1
    from public.brand_members
    where brand_members.brand_id = p_brand_id
      and brand_members.user_id = (select auth.uid())
      and p_capacidade = any (brand_members.capacidades)
  );
$$;

-- ════════════════════════════════════════════════════════════════════════
-- 3. Semeadura: ninguém perde acesso no dia da migração
-- ════════════════════════════════════════════════════════════════════════
--
-- Todo `owner` recebe as quatro capacidades em todas as marcas da sua conta;
-- todo `member` recebe `consultar`. O comportamento de hoje fica idêntico, e a
-- restrição só passa a valer quando alguém for convidado para UMA marca.
insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
select b.id, b.workspace_id, wm.user_id,
       case when wm.role = 'owner'
            then array['consultar', 'editar', 'aprovar', 'administrar']::text[]
            else array['consultar']::text[]
       end
from public.brands b
join public.workspace_members wm on wm.workspace_id = b.workspace_id
on conflict (brand_id, user_id) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- 4. Marca nova nasce com acesso para quem a criou
-- ════════════════════════════════════════════════════════════════════════
--
-- Sem isto, criar uma marca deixaria a criadora sem acesso a ela: a criação é
-- poder da CONTA (a marca ainda não existe, então não há acesso por marca a
-- consultar), mas tudo depois é por marca.
create function public.brand_members_semear_criadora()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  criadora uuid := (select auth.uid());
begin
  /*
   * Sem sessão, o acesso vai para quem é dono da CONTA.
   *
   * `auth.uid()` é nulo quando a marca nasce pela chave de serviço ou por SQL
   * de manutenção. O caminho real de criação — o RPC de importação — sempre
   * tem sessão, então isto é a borda, não o caso comum.
   *
   * Duas saídas erradas foram descartadas aqui, cada uma por um motivo medido:
   *
   *   Inserir com `criadora` nula viola o `not null` de `user_id` e derruba a
   *   criação inteira. Foi o defeito da primeira versão deste gatilho.
   *
   *   Voltar sem conceder nada deixa uma marca que EXISTE e que pessoa alguma
   *   enxerga — nem quem administra a conta, porque a visibilidade agora vem
   *   de `brand_members`. `scripts/prova-acesso-por-marca.sh` pegou isso: a
   *   dona da conta via 3 marcas de 4. Marca órfã e silenciosa é exatamente o
   *   estado que este projeto recusa.
   *
   * A regra abaixo é a mesma da semeadura desta migration — dona da conta
   * administra as marcas da conta — aplicada a uma marca que nasce depois.
   */
  if criadora is null then
    insert into public.brand_members (brand_id, workspace_id, user_id, capacidades)
    select new.id, new.workspace_id, wm.user_id,
           array['consultar', 'editar', 'aprovar', 'administrar']::text[]
      from public.workspace_members wm
     where wm.workspace_id = new.workspace_id
       and wm.role = 'owner'
    on conflict (brand_id, user_id) do nothing;
    return new;
  end if;

  insert into public.brand_members (brand_id, workspace_id, user_id, capacidades, created_by)
  values (new.id, new.workspace_id, criadora,
          array['consultar', 'editar', 'aprovar', 'administrar']::text[], criadora)
  on conflict (brand_id, user_id) do nothing;
  return new;
end;
$$;

revoke execute on function public.brand_members_semear_criadora() from public, anon, authenticated;

create trigger brand_members_semear_criadora
  after insert on public.brands
  for each row execute function public.brand_members_semear_criadora();

-- ════════════════════════════════════════════════════════════════════════
-- 5. As 24 policies que passam a resolver por marca
-- ════════════════════════════════════════════════════════════════════════
--
-- Todas juntas, numa migration só: metade convertida deixaria o vazamento de pé
-- pela metade que sobrou.
--
-- O mapa de capacidade por ação:
--
--   ler qualquer coisa da marca          consultar
--   mexer em conteúdo, assets, imagens   editar
--   mexer na marca em si, importar,      administrar
--   ver orçamento e razão de IA da marca
--
-- `aprovar` não governa nenhuma policy ainda — ela existe no vocabulário desde
-- o ADR-0002 e passa a ser CONCEDÍVEL aqui, separada de `editar`. Quem a usa é
-- a curadoria editorial, que é trabalho do ADR-0005 e não desta migration.
--
-- ─── Quatro tabelas têm `brand_id` opcional ──────────────────────────────
--
-- `ai_budgets`, `ai_ledger` (orçamento e gasto da conta inteira),
-- `brand_document_versions` e `brand_imports` (linhas anteriores à coluna).
-- Linha sem marca não pode ser atribuída a marca nenhuma: ela fica com quem
-- administra a CONTA. Deixá-la cair na regra por marca a esconderia de todos,
-- e liberá-la a qualquer membro seria manter o furo aberto por outra porta.

-- ─── brands ──────────────────────────────────────────────────────────────
drop policy "Members can view brands in their workspace" on public.brands;
create policy "Quem tem acesso à marca a vê" on public.brands
  for select to authenticated
  using (public.tem_capacidade_na_marca(id, 'consultar'));

drop policy "Owners can update brands in their workspace" on public.brands;
create policy "Quem administra a marca a altera" on public.brands
  for update to authenticated
  using (public.tem_capacidade_na_marca(id, 'administrar'));

drop policy "Owners can delete brands in their workspace" on public.brands;
create policy "Quem administra a marca a apaga" on public.brands
  for delete to authenticated
  using (public.tem_capacidade_na_marca(id, 'administrar'));

-- A criação continua sendo poder da CONTA, e não da marca: a marca ainda não
-- existe, então não há acesso por marca a consultar. Quem cria recebe acesso
-- pelo gatilho da §4 — sem ele, criaria e ficaria de fora.

-- ─── brand_documents ─────────────────────────────────────────────────────
drop policy "Members can read brand documents" on public.brand_documents;
create policy "Quem tem acesso à marca lê os documentos" on public.brand_documents
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));

drop policy "Owners can insert brand documents" on public.brand_documents;
create policy "Quem edita a marca cria documento" on public.brand_documents
  for insert to authenticated
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));

drop policy "Owners can update brand documents" on public.brand_documents;
create policy "Quem edita a marca altera documento" on public.brand_documents
  for update to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'))
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));

drop policy "Owners can delete brand documents" on public.brand_documents;
create policy "Quem edita a marca apaga documento" on public.brand_documents
  for delete to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'));

-- ─── brand_assets ────────────────────────────────────────────────────────
drop policy "Members can read brand assets" on public.brand_assets;
create policy "Quem tem acesso à marca lê os assets" on public.brand_assets
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));

drop policy "Owners can insert brand assets" on public.brand_assets;
create policy "Quem edita a marca sobe asset" on public.brand_assets
  for insert to authenticated
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));

drop policy "Owners can update brand assets" on public.brand_assets;
create policy "Quem edita a marca altera asset" on public.brand_assets
  for update to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'))
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));

drop policy "Owners can delete brand assets" on public.brand_assets;
create policy "Quem edita a marca remove asset" on public.brand_assets
  for delete to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'));

-- ─── brand_chunks (a busca) ──────────────────────────────────────────────
drop policy "Members read chunks of their brands" on public.brand_chunks;
create policy "Quem tem acesso à marca busca nela" on public.brand_chunks
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));

-- ─── documento-fonte e manifesto ─────────────────────────────────────────
drop policy "Members read brand source documents" on public.brand_source_documents;
create policy "Quem tem acesso à marca lê o documento-fonte" on public.brand_source_documents
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));

drop policy "Members read brand source pages" on public.brand_source_pages;
create policy "Quem tem acesso à marca lê o manifesto" on public.brand_source_pages
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));

-- ─── analysis_runs: consultar TAMBÉM usa (ADR-0004 §3.6) ─────────────────
--
-- Quem consulta envia peça para análise: a capacidade de leitura inclui as
-- ferramentas de consumo. O que ela não faz é alterar regra.
drop policy "Members can view workspace analyses" on public.analysis_runs;
create policy "Quem tem acesso à marca vê as análises" on public.analysis_runs
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));

drop policy "Members can create workspace analyses" on public.analysis_runs;
create policy "Quem tem acesso à marca envia peça" on public.analysis_runs
  for insert to authenticated
  with check (created_by = (select auth.uid())
              and public.tem_capacidade_na_marca(brand_id, 'consultar'));

drop policy "Authors and owners update analyses" on public.analysis_runs;
create policy "Autora ou quem administra a marca altera análise" on public.analysis_runs
  for update to authenticated
  using (created_by = (select auth.uid())
         or public.tem_capacidade_na_marca(brand_id, 'administrar'))
  with check (created_by = (select auth.uid())
              or public.tem_capacidade_na_marca(brand_id, 'administrar'));

drop policy "Authors and owners delete analyses" on public.analysis_runs;
create policy "Autora ou quem administra a marca apaga análise" on public.analysis_runs
  for delete to authenticated
  using (created_by = (select auth.uid())
         or public.tem_capacidade_na_marca(brand_id, 'administrar'));

-- ─── as quatro com `brand_id` opcional ───────────────────────────────────
drop policy "Members can read brand document versions" on public.brand_document_versions;
create policy "Quem tem acesso à marca lê o histórico" on public.brand_document_versions
  for select to authenticated
  using (case when brand_id is null
              then workspace_id in (select workspace_members.workspace_id
                                      from public.workspace_members
                                     where workspace_members.user_id = (select auth.uid())
                                       and workspace_members.role = 'owner')
              else public.tem_capacidade_na_marca(brand_id, 'consultar')
         end);

drop policy "Members read brand imports rows" on public.brand_imports;
create policy "Quem tem acesso à marca lê as importações" on public.brand_imports
  for select to authenticated
  using (case when brand_id is null
              then workspace_id in (select workspace_members.workspace_id
                                      from public.workspace_members
                                     where workspace_members.user_id = (select auth.uid())
                                       and workspace_members.role = 'owner')
              else public.tem_capacidade_na_marca(brand_id, 'consultar')
         end);

/*
 * A importação continua exigindo que o arquivo EXISTA no Storage e que o
 * caminho seja o canônico — as duas condições que impedem registrar
 * procedência de um arquivo que não subiu. O que muda é só quem pode:
 * `administrar` naquela marca, em vez de `owner` da conta.
 */
drop policy "Owners record imports backed by a real file" on public.brand_imports;
create policy "Quem administra a marca registra importação" on public.brand_imports
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and brand_id is not null
    and public.tem_capacidade_na_marca(brand_id, 'administrar')
    and storage_path = workspace_id::text || '/' || import_id::text || '/' || pdf_sha256 || '.pdf'
    and exists (select 1 from storage.objects
                 where objects.bucket_id = 'brand-imports'
                   and objects.name = brand_imports.storage_path)
  );

drop policy "Owners manage ai budgets" on public.ai_budgets;
create policy "Quem administra a marca cuida do orçamento dela" on public.ai_budgets
  for all to authenticated
  using (case when brand_id is null
              then workspace_id in (select workspace_members.workspace_id
                                      from public.workspace_members
                                     where workspace_members.user_id = (select auth.uid())
                                       and workspace_members.role = 'owner')
              else public.tem_capacidade_na_marca(brand_id, 'administrar')
         end)
  with check (case when brand_id is null
                   then workspace_id in (select workspace_members.workspace_id
                                           from public.workspace_members
                                          where workspace_members.user_id = (select auth.uid())
                                            and workspace_members.role = 'owner')
                   else public.tem_capacidade_na_marca(brand_id, 'administrar')
              end);

drop policy "Owners read ai ledger" on public.ai_ledger;
create policy "Quem administra a marca lê o razão dela" on public.ai_ledger
  for select to authenticated
  using (case when brand_id is null
              then workspace_id in (select workspace_members.workspace_id
                                      from public.workspace_members
                                     where workspace_members.user_id = (select auth.uid())
                                       and workspace_members.role = 'owner')
              else public.tem_capacidade_na_marca(brand_id, 'administrar')
         end);


-- ════════════════════════════════════════════════════════════════════════
-- 6. O gatilho de auditoria editorial também resolvia por conta
-- ════════════════════════════════════════════════════════════════════════
--
-- `capture_brand_document_version` exigia `owner` da CONTA para gravar a versão
-- de um documento. Com o acesso por marca, ele recusaria quem recebeu `editar`
-- naquela marca: a policy deixaria passar e o gatilho barraria com 42501.
--
-- Acoplamento escondido — a RLS não é a única guarda do esquema, e converter só
-- as policies teria deixado a edição por marca quebrada em produção.
--
-- Só a checagem de autorização muda; o resto da função é o que já estava lá.

CREATE OR REPLACE FUNCTION private.capture_brand_document_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  /*
   * Quem pode editar passou a ser decidido POR MARCA (20260913185141).
   *
   * Antes, esta checagem exigia `owner` da conta — e, com o acesso por marca,
   * ela recusaria justamente quem recebeu `editar` naquela marca: a RLS
   * deixaria passar e o gatilho barraria, com 42501 e sem explicação útil.
   *
   * Linha sem marca (anterior à coluna `brand_id`) continua exigindo quem
   * administra a CONTA: não há marca a que atribuir a permissão.
   */
  if actor_id is null or not (
    case when source_row.brand_id is null
         then exists (
           select 1 from public.workspace_members
           where workspace_members.workspace_id = source_row.workspace_id
             and workspace_members.user_id = actor_id
             and workspace_members.role = 'owner')
         else exists (
           select 1 from public.brand_members
           where brand_members.brand_id = source_row.brand_id
             and brand_members.user_id = actor_id
             and 'editar' = any (brand_members.capacidades))
    end
  ) then
    raise exception 'Only editors of this brand can create editorial audit entries'
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
$function$

