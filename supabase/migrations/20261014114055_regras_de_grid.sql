-- As regras de grid da marca — o que o Brennimark Grids do assinante aplica — 14/10/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André (14/10/2026, "desenho aprovado, aprovar igual ao logo"): o
-- Grids do ASSINANTE monta o documento com o grid que o MANUAL define — lido
-- pela IA ou informado por quem edita — em vez da proposta do Brennimark. A
-- proposta NÃO vem para o banco: é a tabela de formatos do código, aprovada em
-- 13/10 (`src/lib/grids/formatos.ts`). Aqui mora só o que é da marca.
--
-- Uma linha por marca × formato (`a4`, `post-4x5`, `linkedin-capa`…), mais a
-- regra GERAL (`formato = 'todos'`): muitos manuais definem o sistema de grids
-- uma vez só ("margem = 2× a altura do símbolo, 12 colunas"). Na regra geral as
-- margens e a medianiz são PROPORÇÃO do lado menor da peça, para valer do
-- cartão ao cartaz; nas regras por formato, a unidade do formato (mm ou px).
--
-- O formato é TEXTO, não lista fechada (tradeoff aprovado): formato novo no app
-- não pede migration. O banco confere só a forma do identificador; o app ignora
-- formato que não conhece.
--
-- Honestidade editorial (ADR-0004 §3.2): só regra APROVADA entra em silêncio no
-- documento; o rascunho entra identificado ("lida pela IA — confira, p. X").
--
-- ─── Quem faz o quê — o mesmo modelo de `regras_do_logo` (10/10/2026) ───────
--
--   quem consulta  lê as regras;
--   quem edita     cria, altera e remove — SEMPRE como rascunho;
--   quem aprova    aprova (também pela função, sem precisar editar);
--   o sistema      grava a leitura da IA (sessão nula), só onde não há regra.
--
-- Alterar uma regra aprovada a devolve a rascunho.
--
-- ⚖️ Tradeoff: duas tabelas e um gatilho a mais. Reversível: é dado novo, e
-- apagá-las não afeta o manual, os Materiais, a paleta nem as regras do logo.

create table public.regras_de_grid (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  brand_id       uuid not null,
  formato        text not null,
  tipo           text not null,
  -- mm ou px nas regras por formato; proporção do lado menor na regra geral.
  unidade        text not null,
  colunas        smallint,
  linhas         smallint,
  medianiz       numeric,
  margem_sup     numeric,
  margem_inf     numeric,
  margem_esq     numeric,
  margem_dir     numeric,
  -- Em pt nos impressos e na regra geral; em px nos digitais.
  linha_de_base  numeric,
  -- Proporções das zonas do hierárquico (ex.: {1,3,1.2}).
  zonas          numeric[],
  -- Como o manual diz, para a tela citar.
  descricao      text not null default '',
  pagina         integer,
  origem         text not null default 'pessoa',
  status         text not null default 'draft',
  aprovado_por   uuid references auth.users(id) on delete set null,
  aprovado_em    timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint regras_de_grid_brand_workspace_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  constraint regras_de_grid_formato_check check (formato ~ '^(todos|[a-z0-9][a-z0-9-]{1,39})$'),
  constraint regras_de_grid_tipo_check    check (tipo in ('manuscrito', 'colunas', 'modular', 'hierarquico')),
  constraint regras_de_grid_unidade_check check (unidade in ('mm', 'px', 'proporcao')),
  -- A regra geral é proporcional; a de formato, nunca.
  constraint regras_de_grid_unidade_da_geral check ((formato = 'todos') = (unidade = 'proporcao')),
  constraint regras_de_grid_colunas_check check (colunas is null or colunas between 1 and 24),
  constraint regras_de_grid_linhas_check  check (linhas is null or linhas between 1 and 40),
  constraint regras_de_grid_medidas_check check (
    (medianiz is null or medianiz >= 0) and (margem_sup is null or margem_sup >= 0) and (margem_inf is null or margem_inf >= 0)
    and (margem_esq is null or margem_esq >= 0) and (margem_dir is null or margem_dir >= 0)
  ),
  -- Teto por unidade: margem e medianiz proporcionais até metade do lado menor;
  -- em mm até 1 m; em px até 10 000.
  constraint regras_de_grid_medidas_teto check (
    greatest(coalesce(medianiz, 0), coalesce(margem_sup, 0), coalesce(margem_inf, 0), coalesce(margem_esq, 0), coalesce(margem_dir, 0))
      <= case unidade when 'proporcao' then 0.5 when 'mm' then 1000 else 10000 end
  ),
  constraint regras_de_grid_linha_de_base_check check (linha_de_base is null or (linha_de_base > 0 and linha_de_base <= 200)),
  constraint regras_de_grid_zonas_check check (zonas is null or (cardinality(zonas) between 2 and 6 and 0 < all (zonas))),
  constraint regras_de_grid_descricao_check check (char_length(descricao) <= 300),
  constraint regras_de_grid_pagina_check    check (pagina is null or pagina >= 1),
  constraint regras_de_grid_origem_check    check (origem in ('ia', 'pessoa')),
  constraint regras_de_grid_status_check    check (status in ('draft', 'ready')),
  constraint regras_de_grid_aprovacao_check check (
    (status = 'draft' and aprovado_em is null and aprovado_por is null)
    or (status = 'ready' and aprovado_em is not null)
  ),
  -- Uma regra por formato por marca (e uma regra geral).
  constraint regras_de_grid_uma_por_formato unique (brand_id, formato)
);

create index regras_de_grid_brand_workspace_idx on public.regras_de_grid (brand_id, workspace_id);
create index regras_de_grid_aprovado_por_idx on public.regras_de_grid (aprovado_por);
create index regras_de_grid_created_by_idx   on public.regras_de_grid (created_by);
create index regras_de_grid_updated_by_idx   on public.regras_de_grid (updated_by);
create index regras_de_grid_workspace_idx    on public.regras_de_grid (workspace_id);

alter table public.regras_de_grid enable row level security;

create policy "Quem tem acesso à marca lê as regras de grid" on public.regras_de_grid
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));
create policy "Quem edita a marca cria regra de grid" on public.regras_de_grid
  for insert to authenticated
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
create policy "Quem edita a marca altera regra de grid" on public.regras_de_grid
  for update to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'))
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
-- Só RASCUNHO se apaga: regra aprovada não some sem rastro.
create policy "Quem edita a marca remove regra de grid em rascunho" on public.regras_de_grid
  for delete to authenticated
  using (status = 'draft' and public.tem_capacidade_na_marca(brand_id, 'editar'));

-- Privilégio explícito: o hospedado dá escrita a `authenticated` por padrão.
revoke all on public.regras_de_grid from public, anon, authenticated;
grant select, insert, update, delete on public.regras_de_grid to authenticated;
grant select, insert, update on public.regras_de_grid to service_role;

-- ─── O gatilho: a aprovação é do banco ─────────────────────────────────────
create function private.governar_regras_de_grid()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  quem uuid := (select auth.uid());
  conteudo_mudou boolean;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'a regra nasce como rascunho; a aprovação é um passo à parte'
        using errcode = 'check_violation', constraint = 'regras_de_grid_nasce_rascunho';
    end if;
    if quem is not null then new.origem := 'pessoa'; end if;
    new.aprovado_por := null;
    new.aprovado_em  := null;
    new.created_by   := coalesce(quem, new.created_by);
    new.updated_by   := coalesce(quem, new.updated_by);
    new.created_at   := now();
    new.updated_at   := now();
    return new;
  end if;

  if new.brand_id <> old.brand_id or new.workspace_id <> old.workspace_id or new.formato <> old.formato then
    raise exception 'a regra não muda de marca nem de formato'
      using errcode = 'check_violation', constraint = 'regras_de_grid_fixa';
  end if;

  conteudo_mudou := (new.tipo, new.unidade, new.colunas, new.linhas, new.medianiz, new.margem_sup, new.margem_inf,
                     new.margem_esq, new.margem_dir, new.linha_de_base, new.zonas, new.descricao, new.pagina)
    is distinct from (old.tipo, old.unidade, old.colunas, old.linhas, old.medianiz, old.margem_sup, old.margem_inf,
                      old.margem_esq, old.margem_dir, old.linha_de_base, old.zonas, old.descricao, old.pagina);
  -- Quem corrige passa a responder; sem corrigir, ninguém troca a origem
  -- pela sessão (nem forja "lida pela IA").
  if quem is not null then
    new.origem := case when conteudo_mudou then 'pessoa' else old.origem end;
  end if;

  if new.status = 'ready' and old.status = 'draft' then
    if quem is not null and not public.tem_capacidade_na_marca(new.brand_id, 'aprovar') then
      raise exception 'só quem aprova esta marca aprova a regra'
        using errcode = 'insufficient_privilege', constraint = 'regras_de_grid_aprovar_exige_capacidade';
    end if;
    if conteudo_mudou then
      raise exception 'aprove o grid que está na tela: alterar e aprovar são passos separados'
        using errcode = 'check_violation', constraint = 'regras_de_grid_aprova_sem_alterar';
    end if;
    new.aprovado_por := quem;
    new.aprovado_em  := now();
  elsif new.status = 'ready' and conteudo_mudou then
    new.status       := 'draft';
    new.aprovado_por := null;
    new.aprovado_em  := null;
  elsif new.status = 'ready' then
    if quem is not null then
      new.aprovado_por := old.aprovado_por;
      new.aprovado_em  := old.aprovado_em;
    end if;
  else
    new.aprovado_por := null;
    new.aprovado_em  := null;
  end if;

  if quem is not null then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := coalesce(quem, new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.governar_regras_de_grid() from public, anon, authenticated;

create trigger regras_de_grid_governadas
  before insert or update on public.regras_de_grid
  for each row execute function private.governar_regras_de_grid();

-- ─── Aprovar sem editar ─────────────────────────────────────────────────────
-- Regra inexistente e de marca alheia respondem igual: nada aprovado.
create function public.aprovar_regras_de_grid(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  aprovadas integer;
begin
  if (select auth.uid()) is null then
    raise exception 'sessão obrigatória' using errcode = '28000';
  end if;
  update public.regras_de_grid r
     set status = 'ready'
   where r.id = any (p_ids)
     and r.status = 'draft'
     and public.tem_capacidade_na_marca(r.brand_id, 'aprovar');
  get diagnostics aprovadas = row_count;
  return aprovadas;
end;
$$;

revoke all on function public.aprovar_regras_de_grid(uuid[]) from public, anon;
grant execute on function public.aprovar_regras_de_grid(uuid[]) to authenticated;

-- ─── A leitura da IA entra só onde não há regra ─────────────────────────────
-- Chamada pela rota do Grids com a chave de serviço, depois de conferir que
-- quem abriu alcança a marca. A regra vem como jsonb (os nomes das colunas);
-- valor fora do que o banco admite é recusado pelas constraints. Nunca
-- sobrescreve: a regra que já existe (de uma pessoa ou de leitura anterior) fica.
create function public.registrar_leitura_das_regras_de_grid(p_workspace_id uuid, p_brand_id uuid, p_regra jsonb)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  criadas integer;
  zonas numeric[];
begin
  if jsonb_typeof(p_regra -> 'zonas') = 'array' then
    select array_agg(z::numeric order by ord) into zonas
      from jsonb_array_elements_text(p_regra -> 'zonas') with ordinality as t(z, ord);
  end if;
  insert into public.regras_de_grid (
    workspace_id, brand_id, formato, tipo, unidade, colunas, linhas, medianiz,
    margem_sup, margem_inf, margem_esq, margem_dir, linha_de_base, zonas, descricao, pagina, origem
  ) values (
    p_workspace_id, p_brand_id, p_regra ->> 'formato', p_regra ->> 'tipo', p_regra ->> 'unidade',
    (p_regra ->> 'colunas')::smallint, (p_regra ->> 'linhas')::smallint, (p_regra ->> 'medianiz')::numeric,
    (p_regra ->> 'margem_sup')::numeric, (p_regra ->> 'margem_inf')::numeric,
    (p_regra ->> 'margem_esq')::numeric, (p_regra ->> 'margem_dir')::numeric,
    (p_regra ->> 'linha_de_base')::numeric, zonas,
    left(coalesce(p_regra ->> 'descricao', ''), 300), (p_regra ->> 'pagina')::integer, 'ia'
  )
  on conflict (brand_id, formato) do nothing;
  get diagnostics criadas = row_count;
  return criadas > 0;
end;
$$;

revoke all on function public.registrar_leitura_das_regras_de_grid(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_leitura_das_regras_de_grid(uuid, uuid, jsonb) to service_role;

-- ─── O teto da leitura pela IA ──────────────────────────────────────────────
-- Uma leitura por marca a cada 24 horas, reservada de forma atômica antes de
-- gastar IA (a mesma lição da revisão de segurança do Kit, 10/10/2026).
create table public.leituras_das_regras_de_grid (
  brand_id      uuid primary key,
  workspace_id  uuid not null,
  tentada_em    timestamptz not null default now(),
  constraint leituras_das_regras_de_grid_brand_workspace_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade
);
create index leituras_das_regras_de_grid_workspace_idx on public.leituras_das_regras_de_grid (workspace_id);

alter table public.leituras_das_regras_de_grid enable row level security;
revoke all on public.leituras_das_regras_de_grid from public, anon, authenticated;
grant select, insert, update on public.leituras_das_regras_de_grid to service_role;

create function public.reservar_leitura_das_regras_de_grid(p_workspace_id uuid, p_brand_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  reservadas integer;
begin
  insert into public.leituras_das_regras_de_grid (brand_id, workspace_id, tentada_em)
  values (p_brand_id, p_workspace_id, now())
  on conflict (brand_id) do update set tentada_em = now()
    where public.leituras_das_regras_de_grid.tentada_em < now() - interval '24 hours';
  get diagnostics reservadas = row_count;
  return reservadas > 0;
end;
$$;

revoke all on function public.reservar_leitura_das_regras_de_grid(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reservar_leitura_das_regras_de_grid(uuid, uuid) to service_role;
