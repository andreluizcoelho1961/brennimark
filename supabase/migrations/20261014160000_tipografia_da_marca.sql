-- A tipografia da marca — as fontes que o manual define, por uso — 14/10/2026.
--
-- ─── Por quê ────────────────────────────────────────────────────────────────
--
-- Decisão do André (14/10/2026): a fonte da marca vem de uma TIPOGRAFIA DA
-- MARCA, lida do manual e aprovada como a paleta. Até aqui nada guardava a
-- fonte: o envio de arquivo de fonte segue bloqueado até o termo de licença
-- (ADR-0007), e a importação do manual não extrai tipografia.
--
-- Esta tabela guarda o NOME da fonte e o USO — não o arquivo. O designer
-- instala a fonte na máquina dele; o InDesign a encontra pelo nome (família e
-- estilo, ou o nome PostScript, que é exato). Usam: o Grids (a fonte nos
-- estilos de texto), o Kit (a fonte substituta na assinatura de e-mail), o
-- Vini (citar a página) e, depois, o Brennimark Fonts.
--
-- Uma linha por USO (título, subtítulo, texto, legenda, destaque, apoio), com
-- SEGMENTO opcional para quando o manual separa por meio ("impresso",
-- "digital"). Cada linha tem a sua página, a sua situação e o seu aprovador.
--
-- Honestidade editorial (ADR-0004 §3.2): só tipografia APROVADA entra em
-- silêncio; o rascunho entra identificado.
--
-- ─── Quem faz o quê — o mesmo modelo da `paleta_da_marca` ───────────────────
--
--   quem consulta  lê;
--   quem edita     cria, altera e remove — SEMPRE como rascunho;
--   quem aprova    aprova (também pela função, sem precisar editar);
--   o sistema      grava a leitura da IA (sessão nula), só onde não há linha.
--
-- Alterar uma linha aprovada a devolve a rascunho; reordenar, não.
--
-- ⚖️ Tradeoff: duas tabelas e um gatilho a mais. Reversível: é dado novo, e
-- apagá-las não afeta o manual, os Materiais, a paleta nem as outras regras.

create table public.tipografia_da_marca (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  brand_id       uuid not null,
  uso            text not null,
  -- '' quando o manual não separa por meio.
  segmento       text not null default '',
  -- Como aparece no InDesign: "Bradesco Sans", "Bold".
  familia        text not null,
  estilo         text not null default '',
  -- O nome exato da fonte ("BradescoSans-Bold"), quando o manual dá.
  postscript     text,
  -- A fonte de sistema que o manual manda usar onde a da marca não roda.
  substituta     text,
  -- A hierarquia, quando o manual define: corpo e entrelinha em pt,
  -- espacejamento em milésimos de eme, caixa alta.
  corpo          numeric,
  entrelinha     numeric,
  espacejamento  integer,
  caixa_alta     boolean,
  descricao      text not null default '',
  pagina         integer,
  ordem          integer not null default 0,
  origem         text not null default 'pessoa',
  status         text not null default 'draft',
  aprovado_por   uuid references auth.users(id) on delete set null,
  aprovado_em    timestamptz,
  created_by     uuid references auth.users(id) on delete set null,
  updated_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint tipografia_da_marca_brand_workspace_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  constraint tipografia_da_marca_uso_check check (uso in ('titulo', 'subtitulo', 'texto', 'legenda', 'destaque', 'apoio')),
  constraint tipografia_da_marca_segmento_check check (char_length(segmento) <= 60 and segmento = btrim(segmento)),
  constraint tipografia_da_marca_familia_check check (char_length(btrim(familia)) between 1 and 120),
  constraint tipografia_da_marca_estilo_check check (char_length(estilo) <= 60),
  -- Nome PostScript não tem espaço: letras, números e hífen, até 127.
  constraint tipografia_da_marca_postscript_check check (postscript is null or postscript ~ '^[A-Za-z0-9-]{1,127}$'),
  constraint tipografia_da_marca_substituta_check check (substituta is null or char_length(btrim(substituta)) between 1 and 120),
  constraint tipografia_da_marca_corpo_check check (corpo is null or (corpo > 0 and corpo <= 1000)),
  constraint tipografia_da_marca_entrelinha_check check (entrelinha is null or (entrelinha > 0 and entrelinha <= 2000)),
  constraint tipografia_da_marca_espacejamento_check check (espacejamento is null or espacejamento between -500 and 2000),
  constraint tipografia_da_marca_descricao_check check (char_length(descricao) <= 300),
  constraint tipografia_da_marca_pagina_check check (pagina is null or pagina >= 1),
  constraint tipografia_da_marca_origem_check check (origem in ('ia', 'pessoa')),
  constraint tipografia_da_marca_status_check check (status in ('draft', 'ready')),
  constraint tipografia_da_marca_aprovacao_check check (
    (status = 'draft' and aprovado_em is null and aprovado_por is null)
    or (status = 'ready' and aprovado_em is not null)
  ),
  -- Um uso por segmento por marca.
  constraint tipografia_da_marca_um_por_uso unique (brand_id, uso, segmento)
);

create index tipografia_da_marca_brand_workspace_idx on public.tipografia_da_marca (brand_id, workspace_id);
create index tipografia_da_marca_aprovado_por_idx on public.tipografia_da_marca (aprovado_por);
create index tipografia_da_marca_created_by_idx   on public.tipografia_da_marca (created_by);
create index tipografia_da_marca_updated_by_idx   on public.tipografia_da_marca (updated_by);
create index tipografia_da_marca_workspace_idx    on public.tipografia_da_marca (workspace_id);

alter table public.tipografia_da_marca enable row level security;

create policy "Quem tem acesso à marca lê a tipografia" on public.tipografia_da_marca
  for select to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'consultar'));
create policy "Quem edita a marca cria tipografia" on public.tipografia_da_marca
  for insert to authenticated
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
create policy "Quem edita a marca altera tipografia" on public.tipografia_da_marca
  for update to authenticated
  using (public.tem_capacidade_na_marca(brand_id, 'editar'))
  with check (public.tem_capacidade_na_marca(brand_id, 'editar'));
-- Só RASCUNHO se apaga: tipografia aprovada não some sem rastro.
create policy "Quem edita a marca remove tipografia em rascunho" on public.tipografia_da_marca
  for delete to authenticated
  using (status = 'draft' and public.tem_capacidade_na_marca(brand_id, 'editar'));

-- Privilégio explícito: o hospedado dá escrita a `authenticated` por padrão.
revoke all on public.tipografia_da_marca from public, anon, authenticated;
grant select, insert, update, delete on public.tipografia_da_marca to authenticated;
grant select, insert, update on public.tipografia_da_marca to service_role;

-- ─── O gatilho: a aprovação é do banco ─────────────────────────────────────
create function private.governar_tipografia_da_marca()
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
      raise exception 'a tipografia nasce como rascunho; a aprovação é um passo à parte'
        using errcode = 'check_violation', constraint = 'tipografia_da_marca_nasce_rascunho';
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

  if new.brand_id <> old.brand_id or new.workspace_id <> old.workspace_id or new.uso <> old.uso or new.segmento <> old.segmento then
    raise exception 'a linha não muda de marca, de uso nem de segmento'
      using errcode = 'check_violation', constraint = 'tipografia_da_marca_fixa';
  end if;

  -- A ordem não é conteúdo: reordenar não devolve a rascunho.
  conteudo_mudou := (new.familia, new.estilo, new.postscript, new.substituta, new.corpo, new.entrelinha,
                     new.espacejamento, new.caixa_alta, new.descricao, new.pagina)
    is distinct from (old.familia, old.estilo, old.postscript, old.substituta, old.corpo, old.entrelinha,
                      old.espacejamento, old.caixa_alta, old.descricao, old.pagina);
  if quem is not null then
    new.origem := case when conteudo_mudou then 'pessoa' else old.origem end;
  end if;

  if new.status = 'ready' and old.status = 'draft' then
    if quem is not null and not public.tem_capacidade_na_marca(new.brand_id, 'aprovar') then
      raise exception 'só quem aprova esta marca aprova a tipografia'
        using errcode = 'insufficient_privilege', constraint = 'tipografia_da_marca_aprovar_exige_capacidade';
    end if;
    if conteudo_mudou then
      raise exception 'aprove a fonte que está na tela: alterar e aprovar são passos separados'
        using errcode = 'check_violation', constraint = 'tipografia_da_marca_aprova_sem_alterar';
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

revoke all on function private.governar_tipografia_da_marca() from public, anon, authenticated;

create trigger tipografia_da_marca_governada
  before insert or update on public.tipografia_da_marca
  for each row execute function private.governar_tipografia_da_marca();

-- ─── Aprovar sem editar ─────────────────────────────────────────────────────
-- Linha inexistente e de marca alheia respondem igual: nada aprovado.
create function public.aprovar_tipografia_da_marca(p_ids uuid[])
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
  update public.tipografia_da_marca t
     set status = 'ready'
   where t.id = any (p_ids)
     and t.status = 'draft'
     and public.tem_capacidade_na_marca(t.brand_id, 'aprovar');
  get diagnostics aprovadas = row_count;
  return aprovadas;
end;
$$;

revoke all on function public.aprovar_tipografia_da_marca(uuid[]) from public, anon;
grant execute on function public.aprovar_tipografia_da_marca(uuid[]) to authenticated;

-- ─── A leitura da IA entra só onde não há linha ─────────────────────────────
-- Chamada pela rota com a chave de serviço, depois de conferir que quem abriu
-- alcança a marca. A linha vem como jsonb (os nomes das colunas); valor fora
-- do que o banco admite é recusado pelas constraints. Nunca sobrescreve.
create function public.registrar_leitura_da_tipografia(p_workspace_id uuid, p_brand_id uuid, p_linha jsonb)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  criadas integer;
begin
  insert into public.tipografia_da_marca (
    workspace_id, brand_id, uso, segmento, familia, estilo, postscript, substituta,
    corpo, entrelinha, espacejamento, caixa_alta, descricao, pagina, ordem, origem
  ) values (
    p_workspace_id, p_brand_id, p_linha ->> 'uso', btrim(coalesce(p_linha ->> 'segmento', '')),
    p_linha ->> 'familia', coalesce(p_linha ->> 'estilo', ''), p_linha ->> 'postscript', p_linha ->> 'substituta',
    (p_linha ->> 'corpo')::numeric, (p_linha ->> 'entrelinha')::numeric, (p_linha ->> 'espacejamento')::integer,
    (p_linha ->> 'caixa_alta')::boolean, left(coalesce(p_linha ->> 'descricao', ''), 300),
    (p_linha ->> 'pagina')::integer, coalesce((p_linha ->> 'ordem')::integer, 0), 'ia'
  )
  on conflict (brand_id, uso, segmento) do nothing;
  get diagnostics criadas = row_count;
  return criadas > 0;
end;
$$;

revoke all on function public.registrar_leitura_da_tipografia(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_leitura_da_tipografia(uuid, uuid, jsonb) to service_role;

-- ─── O teto da leitura pela IA ──────────────────────────────────────────────
-- Uma leitura por marca a cada 24 horas, reservada de forma atômica antes de
-- gastar IA (a lição da revisão de segurança do Kit, 10/10/2026).
create table public.leituras_da_tipografia (
  brand_id      uuid primary key,
  workspace_id  uuid not null,
  tentada_em    timestamptz not null default now(),
  constraint leituras_da_tipografia_brand_workspace_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade
);
create index leituras_da_tipografia_workspace_idx on public.leituras_da_tipografia (workspace_id);

alter table public.leituras_da_tipografia enable row level security;
revoke all on public.leituras_da_tipografia from public, anon, authenticated;
grant select, insert, update on public.leituras_da_tipografia to service_role;

create function public.reservar_leitura_da_tipografia(p_workspace_id uuid, p_brand_id uuid)
returns boolean
language plpgsql
security definer
set search_path to ''
as $$
declare
  reservadas integer;
begin
  insert into public.leituras_da_tipografia (brand_id, workspace_id, tentada_em)
  values (p_brand_id, p_workspace_id, now())
  on conflict (brand_id) do update set tentada_em = now()
    where public.leituras_da_tipografia.tentada_em < now() - interval '24 hours';
  get diagnostics reservadas = row_count;
  return reservadas > 0;
end;
$$;

revoke all on function public.reservar_leitura_da_tipografia(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reservar_leitura_da_tipografia(uuid, uuid) to service_role;
