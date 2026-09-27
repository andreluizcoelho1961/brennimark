-- A ficha da paleta da marca — as cores curadas por uma pessoa — 27/09/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André, 26/09/2026 ("aprovo A e C"). No ensaio, o Vini contou 6
-- cores no manual do Bradesco, onde há 2 principais e 17 de apoio: a página da
-- paleta é uma TABELA de amostras, e o texto extraído dela é uma sopa de
-- códigos. A imagem da página (#50) ajuda a IA a ler; a FICHA resolve de vez —
-- uma pessoa confere cada cor uma vez, e daí em diante a resposta sai dela.
--
-- A ficha também é a base do que vem depois: o copiloto de prompts (hex exato,
-- ADR-0004) e a análise de peça precisam da cor como DADO, não como texto.
--
-- ─── Quem faz o quê — ADR-0002 ──────────────────────────────────────────────
--
--   quem consulta  lê a ficha;
--   quem edita     cria, altera e remove — SEMPRE como rascunho;
--   quem aprova    marca como aprovada.
--
-- "A agência redige, o dono da marca aprova": editar e aprovar são capacidades
-- separadas, e aqui a separação é do BANCO, não da tela. Alterar uma cor já
-- aprovada a devolve a rascunho — a aprovação vale para o que foi aprovado,
-- não para o que alguém escreveu depois.
--
-- Quem aprova sem editar (o cliente da agência) não passa pela policy de
-- escrita: aprova pela função `aprovar_cores_da_paleta`, que confere `aprovar`.
--
-- ─── Honestidade editorial ──────────────────────────────────────────────────
--
-- O status usa o vocabulário do resto do modelo (`draft` | `ready`), porque
-- atravessa o contexto de IA e as citações do mesmo jeito: só cor aprovada
-- entra em silêncio; rascunho é citado como rascunho (ADR-0004 §3.2).
--
-- ⚖️ Tradeoff: uma tabela e um gatilho a mais. Reversível: a ficha é dado novo,
-- e apagá-la não afeta o manual nem a busca.

create table public.paleta_da_marca (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  brand_id      uuid not null,
  nome          text not null,
  papel         text not null,
  segmento      text not null default '',
  hex           text,
  rgb           text,
  cmyk          text,
  pms           text,
  pagina        integer,
  ordem         integer not null default 0,
  status        text not null default 'draft',
  aprovado_por  uuid references auth.users(id) on delete set null,
  aprovado_em   timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  updated_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint paleta_da_marca_brand_workspace_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  constraint paleta_da_marca_nome_check     check (char_length(btrim(nome)) between 1 and 80),
  constraint paleta_da_marca_papel_check    check (papel in ('principal', 'apoio')),
  constraint paleta_da_marca_segmento_check check (char_length(segmento) <= 80),
  -- HEX é a forma canônica da amostra na tela e no prompt: maiúsculo, com #.
  constraint paleta_da_marca_hex_check      check (hex is null or hex ~ '^#[0-9A-F]{6}$'),
  -- RGB, CMYK e PMS ficam como o manual escreve — cada manual tem a sua forma
  -- ("C100 M0 Y0 K0", "100/0/0/0") e normalizar erraria o que a gráfica lê.
  constraint paleta_da_marca_rgb_check      check (rgb is null or char_length(btrim(rgb)) between 1 and 40),
  constraint paleta_da_marca_cmyk_check     check (cmyk is null or char_length(btrim(cmyk)) between 1 and 40),
  constraint paleta_da_marca_pms_check      check (pms is null or char_length(btrim(pms)) between 1 and 40),
  -- Uma cor sem código nenhum não é ficha, é um nome.
  constraint paleta_da_marca_algum_codigo   check (coalesce(hex, rgb, cmyk, pms) is not null),
  constraint paleta_da_marca_pagina_check   check (pagina is null or pagina >= 1),
  constraint paleta_da_marca_status_check   check (status in ('draft', 'ready')),
  -- Aprovada tem data; rascunho não carrega resto de aprovação. Quem aprovou
  -- pode ficar nulo numa cor aprovada: é a conta removida (LGPD, 24/09).
  constraint paleta_da_marca_aprovacao_check check (
    (status = 'draft' and aprovado_em is null and aprovado_por is null)
    or (status = 'ready' and aprovado_em is not null)
  )
);

create index paleta_da_marca_marca_idx
  on public.paleta_da_marca (brand_id, ordem);
create index paleta_da_marca_brand_workspace_idx
  on public.paleta_da_marca (brand_id, workspace_id);
-- `on delete set null` sem índice varre a tabela a cada login apagado.
create index paleta_da_marca_aprovado_por_idx on public.paleta_da_marca (aprovado_por);
create index paleta_da_marca_created_by_idx   on public.paleta_da_marca (created_by);
create index paleta_da_marca_updated_by_idx   on public.paleta_da_marca (updated_by);

alter table public.paleta_da_marca enable row level security;

create policy "Quem tem acesso à marca lê a paleta" on public.paleta_da_marca
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));
create policy "Quem edita a marca cria cor" on public.paleta_da_marca
  for insert to authenticated
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
create policy "Quem edita a marca altera cor" on public.paleta_da_marca
  for update to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'))
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
create policy "Quem edita a marca remove cor" on public.paleta_da_marca
  for delete to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'));

-- O Supabase hospedado dá escrita a `authenticated` em tabela nova por
-- privilégio padrão, e o local não: o que vale é o explícito.
revoke all on public.paleta_da_marca from public, anon, authenticated;
grant select, insert, update, delete on public.paleta_da_marca to authenticated;

-- ─── O gatilho: a aprovação é do banco ─────────────────────────────────────
--
-- Cada recusa leva o nome de uma constraint, e a prova confere o NOME.
-- `auth.uid()` nulo é escrita de sistema (migration, service role): passa sem
-- conferência de capacidade, mas as regras de forma valem igual.

create function private.governar_paleta_da_marca()
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
      raise exception 'a cor nasce como rascunho; a aprovação é um passo à parte'
        using errcode = 'check_violation', constraint = 'paleta_da_marca_nasce_rascunho';
    end if;
    new.aprovado_por := null;
    new.aprovado_em  := null;
    new.created_by   := coalesce(quem, new.created_by);
    new.updated_by   := coalesce(quem, new.updated_by);
    new.created_at   := now();
    new.updated_at   := now();
    return new;
  end if;

  -- Uma cor não muda de marca: seria copiar aprovação de uma marca para outra.
  if new.brand_id <> old.brand_id or new.workspace_id <> old.workspace_id then
    raise exception 'a cor não muda de marca'
      using errcode = 'check_violation', constraint = 'paleta_da_marca_marca_fixa';
  end if;

  conteudo_mudou := (new.nome, new.papel, new.segmento, new.hex, new.rgb, new.cmyk, new.pms, new.pagina)
    is distinct from (old.nome, old.papel, old.segmento, old.hex, old.rgb, old.cmyk, old.pms, old.pagina);

  if new.status = 'ready' and old.status = 'draft' then
    -- Aprovar: só quem tem `aprovar` nesta marca.
    if quem is not null and not public.tem_capacidade_na_marca(new.brand_id, 'aprovar') then
      raise exception 'só quem aprova esta marca aprova a cor'
        using errcode = 'insufficient_privilege', constraint = 'paleta_da_marca_aprovar_exige_capacidade';
    end if;
    new.aprovado_por := quem;
    new.aprovado_em  := now();
  elsif new.status = 'ready' and conteudo_mudou then
    -- Alterou o que estava aprovado: volta a rascunho.
    new.status       := 'draft';
    new.aprovado_por := null;
    new.aprovado_em  := null;
  elsif new.status = 'ready' then
    -- Só a ordem mudou: a aprovação continua a mesma, e ninguém a reescreve.
    -- Escrita de sistema passa: é por ela que chega o `on delete set null` de
    -- quem aprovou e teve o login apagado — travá-la travaria a exclusão.
    if quem is not null then
      new.aprovado_por := old.aprovado_por;
      new.aprovado_em  := old.aprovado_em;
    end if;
  else
    new.aprovado_por := null;
    new.aprovado_em  := null;
  end if;

  -- A autoria não se reescreve por sessão; o sistema a anula (conta removida).
  if quem is not null then
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := coalesce(quem, new.updated_by);
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.governar_paleta_da_marca() from public, anon, authenticated;

create trigger paleta_da_marca_governada
  before insert or update on public.paleta_da_marca
  for each row execute function private.governar_paleta_da_marca();

-- ─── Aprovar sem editar ─────────────────────────────────────────────────────
--
-- Quem só consulta e aprova — o dono da marca, do lado do cliente — não
-- alcança a policy de escrita. Esta função é o único caminho dele, e faz uma
-- coisa só: rascunho → aprovado, nas cores desta marca que a pessoa aprova.
--
-- Cor inexistente e cor de marca alheia respondem igual: nada aprovado.

create function public.aprovar_cores_da_paleta(p_ids uuid[])
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

  update public.paleta_da_marca p
     set status = 'ready'
   where p.id = any (p_ids)
     and p.status = 'draft'
     and public.tem_capacidade_na_marca(p.brand_id, 'aprovar');
  get diagnostics aprovadas = row_count;
  return aprovadas;
end;
$$;

revoke all on function public.aprovar_cores_da_paleta(uuid[]) from public, anon;
grant execute on function public.aprovar_cores_da_paleta(uuid[]) to authenticated;
