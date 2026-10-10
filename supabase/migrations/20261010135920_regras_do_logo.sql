-- As regras do logo da marca — o que o Brennimark Kit aplica — 10/10/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André (10/10/2026, "pode seguir, com a tabela das regras"): o Kit
-- do ASSINANTE lê o manual e aplica a área de proteção e a redução mínima sem
-- a pessoa digitar nada. Até aqui o banco sabia ONDE está a regra do logo
-- (`brand_asset_items.regra_paginas`, até cinco páginas), mas não O QUE ela
-- diz. Esta tabela guarda o valor, a página e quem respondeu por ele.
--
-- De onde vem o valor: a IA da plataforma lê as páginas do manual (a área de
-- proteção quase sempre é um DIAGRAMA, então lê a imagem da página) e propõe;
-- a proposta entra como RASCUNHO, com `origem = 'ia'`. Uma pessoa pode corrigir
-- (continua rascunho, `origem = 'pessoa'`), e quem tem `aprovar` aprova.
--
-- Honestidade editorial (ADR-0004 §3.2): só regra APROVADA é aplicada em
-- silêncio. O rascunho o Kit aplica com a etiqueta "lido pela IA — confira".
-- Em 24/09 ficou decidido que o sistema não ADIVINHA a regra pela busca; aqui
-- ele não adivinha — lê a página citada e diz que leu, até alguém confirmar.
--
-- ─── Quem faz o quê — ADR-0002, o mesmo modelo da `paleta_da_marca` ─────────
--
--   quem consulta  lê as regras;
--   quem edita     cria, altera e remove — SEMPRE como rascunho;
--   quem aprova    aprova (também pela função, sem precisar editar);
--   o sistema      grava a leitura da IA (sessão nula), só onde não há regra.
--
-- Alterar o valor de uma regra aprovada a devolve a rascunho.
--
-- ⚖️ Tradeoff: uma tabela e um gatilho a mais. Reversível: é dado novo, e
-- apagá-la não afeta o manual, os Materiais nem a paleta (as cores aprovadas
-- já moram em `paleta_da_marca`; o Kit as lê de lá, sem copiar).

create table public.regras_do_logo (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  brand_id      uuid not null,
  chave         text not null,
  valor         numeric not null,
  -- Como o manual diz, para a tela citar ("x = altura do B", "24 px").
  descricao     text not null default '',
  pagina        integer,
  origem        text not null default 'pessoa',
  status        text not null default 'draft',
  aprovado_por  uuid references auth.users(id) on delete set null,
  aprovado_em   timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint regras_do_logo_brand_workspace_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  constraint regras_do_logo_chave_check check (chave in ('area_de_protecao', 'reducao_minima_logo', 'reducao_minima_simbolo')),
  -- Área de proteção: fração da altura do logo (0,25 = um quarto); até 2 cobre
  -- os manuais mais folgados. Redução mínima: largura em px, de 4 a 2000.
  constraint regras_do_logo_valor_check check (
    (chave = 'area_de_protecao' and valor > 0 and valor <= 2)
    or (chave in ('reducao_minima_logo', 'reducao_minima_simbolo') and valor >= 4 and valor <= 2000)
  ),
  constraint regras_do_logo_descricao_check check (char_length(descricao) <= 200),
  constraint regras_do_logo_pagina_check    check (pagina is null or pagina >= 1),
  constraint regras_do_logo_origem_check    check (origem in ('ia', 'pessoa')),
  constraint regras_do_logo_status_check    check (status in ('draft', 'ready')),
  constraint regras_do_logo_aprovacao_check check (
    (status = 'draft' and aprovado_em is null and aprovado_por is null)
    or (status = 'ready' and aprovado_em is not null)
  ),
  -- Uma regra de cada tipo por marca.
  constraint regras_do_logo_uma_por_marca unique (brand_id, chave)
);

create index regras_do_logo_brand_workspace_idx on public.regras_do_logo (brand_id, workspace_id);
create index regras_do_logo_aprovado_por_idx on public.regras_do_logo (aprovado_por);
create index regras_do_logo_created_by_idx   on public.regras_do_logo (created_by);
create index regras_do_logo_updated_by_idx   on public.regras_do_logo (updated_by);
create index regras_do_logo_workspace_idx    on public.regras_do_logo (workspace_id);

alter table public.regras_do_logo enable row level security;

create policy "Quem tem acesso à marca lê as regras do logo" on public.regras_do_logo
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));
create policy "Quem edita a marca cria regra do logo" on public.regras_do_logo
  for insert to authenticated
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
create policy "Quem edita a marca altera regra do logo" on public.regras_do_logo
  for update to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'))
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
-- Só RASCUNHO se apaga: regra aprovada não some sem rastro. Para tirar uma
-- aprovada, altere-a (ela volta a rascunho) e então apague.
create policy "Quem edita a marca remove regra do logo em rascunho" on public.regras_do_logo
  for delete to authenticated
  using (status = 'draft' and public.tem_capacidade_na_marca(brand_id, 'editar'));

-- O Supabase hospedado dá escrita a `authenticated` em tabela nova por
-- privilégio padrão, e o local não: o que vale é o explícito.
revoke all on public.regras_do_logo from public, anon, authenticated;
grant select, insert, update, delete on public.regras_do_logo to authenticated;
grant select, insert, update on public.regras_do_logo to service_role;

-- ─── O gatilho: a aprovação é do banco ─────────────────────────────────────
create function private.governar_regras_do_logo()
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
        using errcode = 'check_violation', constraint = 'regras_do_logo_nasce_rascunho';
    end if;
    -- Quem grava pela sessão é uma pessoa; a IA grava pelo sistema.
    if quem is not null then new.origem := 'pessoa'; end if;
    new.aprovado_por := null;
    new.aprovado_em  := null;
    new.created_by   := coalesce(quem, new.created_by);
    new.updated_by   := coalesce(quem, new.updated_by);
    new.created_at   := now();
    new.updated_at   := now();
    return new;
  end if;

  if new.brand_id <> old.brand_id or new.workspace_id <> old.workspace_id or new.chave <> old.chave then
    raise exception 'a regra não muda de marca nem de tipo'
      using errcode = 'check_violation', constraint = 'regras_do_logo_fixa';
  end if;

  conteudo_mudou := (new.valor, new.descricao, new.pagina) is distinct from (old.valor, old.descricao, old.pagina);
  -- Uma pessoa que corrige o valor passa a responder por ele; sem mudar o
  -- valor, ninguém troca a origem pela sessão (nem forja "lido pela IA").
  if quem is not null then
    new.origem := case when conteudo_mudou then 'pessoa' else old.origem end;
  end if;

  if new.status = 'ready' and old.status = 'draft' then
    if quem is not null and not public.tem_capacidade_na_marca(new.brand_id, 'aprovar') then
      raise exception 'só quem aprova esta marca aprova a regra'
        using errcode = 'insufficient_privilege', constraint = 'regras_do_logo_aprovar_exige_capacidade';
    end if;
    if conteudo_mudou then
      raise exception 'aprove o valor que está na tela: alterar e aprovar são passos separados'
        using errcode = 'check_violation', constraint = 'regras_do_logo_aprova_sem_alterar';
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

revoke all on function private.governar_regras_do_logo() from public, anon, authenticated;

create trigger regras_do_logo_governadas
  before insert or update on public.regras_do_logo
  for each row execute function private.governar_regras_do_logo();

-- ─── Aprovar sem editar ─────────────────────────────────────────────────────
-- O dono da marca, do lado do cliente, aprova sem alcançar a escrita.
-- Regra inexistente e de marca alheia respondem igual: nada aprovado.
create function public.aprovar_regras_do_logo(p_ids uuid[])
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
  update public.regras_do_logo r
     set status = 'ready'
   where r.id = any (p_ids)
     and r.status = 'draft'
     and public.tem_capacidade_na_marca(r.brand_id, 'aprovar');
  get diagnostics aprovadas = row_count;
  return aprovadas;
end;
$$;

revoke all on function public.aprovar_regras_do_logo(uuid[]) from public, anon;
grant execute on function public.aprovar_regras_do_logo(uuid[]) to authenticated;

-- ─── A leitura da IA entra só onde não há regra ─────────────────────────────
-- Chamada pela rota do Kit com a chave de serviço, depois de conferir que quem
-- abriu o Kit alcança a marca. Nunca sobrescreve: se uma pessoa (ou uma leitura
-- anterior) já respondeu por aquela regra, a dela fica.
create function public.registrar_leitura_das_regras_do_logo(
  p_workspace_id uuid, p_brand_id uuid, p_chave text, p_valor numeric, p_descricao text, p_pagina integer
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  criadas integer;
begin
  insert into public.regras_do_logo (workspace_id, brand_id, chave, valor, descricao, pagina, origem)
  values (p_workspace_id, p_brand_id, p_chave, p_valor, left(coalesce(p_descricao, ''), 200), p_pagina, 'ia')
  on conflict (brand_id, chave) do nothing;
  get diagnostics criadas = row_count;
  return criadas > 0;
end;
$$;

revoke all on function public.registrar_leitura_das_regras_do_logo(uuid, uuid, text, numeric, text, integer) from public, anon, authenticated;
grant execute on function public.registrar_leitura_das_regras_do_logo(uuid, uuid, text, numeric, text, integer) to service_role;

-- ─── O teto da leitura pela IA ──────────────────────────────────────────────
--
-- Revisão de segurança (10/10/2026): se a IA não acha as regras, nada é
-- gravado, e cada abertura do Kit pagaria outra leitura — por qualquer pessoa
-- que só consulta, até esgotar a cota da conta. Aqui fica a última TENTATIVA
-- por marca: uma leitura a cada 24 horas, e a reserva é atômica (duas abas ao
-- mesmo tempo não pagam duas). Só a rota, pela chave de serviço, mexe nisto.
create table public.leituras_das_regras_do_logo (
  brand_id      uuid primary key,
  workspace_id  uuid not null,
  tentada_em    timestamptz not null default now(),
  constraint leituras_das_regras_do_logo_brand_workspace_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade
);
create index leituras_das_regras_do_logo_workspace_idx on public.leituras_das_regras_do_logo (workspace_id);

alter table public.leituras_das_regras_do_logo enable row level security;
revoke all on public.leituras_das_regras_do_logo from public, anon, authenticated;
grant select, insert, update on public.leituras_das_regras_do_logo to service_role;

-- true: a leitura pode acontecer agora (e ficou reservada). false: houve uma
-- nas últimas 24 horas.
create function public.reservar_leitura_das_regras_do_logo(p_workspace_id uuid, p_brand_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  reservadas integer;
begin
  insert into public.leituras_das_regras_do_logo (brand_id, workspace_id, tentada_em)
  values (p_brand_id, p_workspace_id, now())
  on conflict (brand_id) do update set tentada_em = now()
    where public.leituras_das_regras_do_logo.tentada_em < now() - interval '24 hours';
  get diagnostics reservadas = row_count;
  return reservadas > 0;
end;
$$;

revoke all on function public.reservar_leitura_das_regras_do_logo(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reservar_leitura_das_regras_do_logo(uuid, uuid) to service_role;
