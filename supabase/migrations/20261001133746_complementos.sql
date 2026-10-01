-- Complementos da marca — 01/10/2026.
--
-- ─── O que é ─────────────────────────────────────────────────────────────
--
-- Textos curtos em Markdown que quem gere a marca escreve para o que o manual
-- não cobre (decisões posteriores, orientações de uso). Ficam ao lado do PDF,
-- no segmento `Manual │ Materiais │ Complementos`, e o Vini passa a responder
-- também a partir deles, citando "Complemento: título".
--
-- ─── Regras que não se afrouxam (direção §20, decisões de 17/09) ─────────
--
--   o MANUAL é o cânone: o complemento acrescenta, nunca corrige em silêncio;
--   só o PUBLICADO alimenta o Vini e quem consulta — rascunho nunca;
--   quem pode editar, ao publicar, está aprovando (decisão 75).
--
-- ─── Decisões do André (01/10/2026) ──────────────────────────────────────
--
--   tabelas PRÓPRIAS, separadas das seções do manual: reimportar o manual
--   nunca toca num complemento, e nenhuma tela do manual precisa aprender a
--   ignorar complemento (as "duas verdades" que o ADR-0006 recusou);
--   histórico de versões só para consulta: cada publicação e cada
--   arquivamento guardam cópia, com autor e data; nada se reescreve.
--
-- ─── Por que quatro tabelas ──────────────────────────────────────────────
--
--   `complementos` guarda o PUBLICADO. Quem consulta lê a linha.
--   `rascunhos_de_complemento` guarda o texto em edição — em tabela à parte
--   porque a RLS filtra LINHAS, não colunas: com o rascunho na mesma linha do
--   publicado, quem só consulta o leria pela API.
--   `versoes_de_complemento` é o histórico, só de acréscimo.
--   `trechos_de_complemento` é o que o Vini busca, refeito a cada publicação.
--   Separado de `brand_chunks` de propósito: só lê complemento quem foi
--   ensinado a ler (a conferência da paleta, por exemplo, lê só o manual).
--
-- ─── Privilégios ─────────────────────────────────────────────────────────
--
-- No Supabase hospedado, tabela nova nasce com escrita para `authenticated`.
-- `revoke all` explícito em cada uma: as tabelas só se LEEM; toda escrita
-- passa pelas funções, que conferem `editar` na marca.

-- ─── 1. O complemento (o publicado) ──────────────────────────────────────

create table public.complementos (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  brand_id            uuid not null,
  slug                text not null,
  -- Versão 0 = nunca publicado: só existe o rascunho.
  versao              integer not null default 0,
  titulo              text,
  texto               text,
  publicado_em        timestamptz,
  publicado_por       uuid references auth.users(id) on delete set null,
  publicado_por_email text,
  arquivado_em        timestamptz,
  arquivado_por       uuid references auth.users(id) on delete set null,
  criado_por          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default clock_timestamp(),

  constraint complementos_marca_fkey
    foreign key (brand_id, workspace_id) references public.brands(id, workspace_id) on delete cascade,
  constraint complementos_slug_unico unique (brand_id, slug),
  constraint complementos_slug_forma check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  constraint complementos_versao_check check (versao >= 0),
  -- Publicado tem título, texto, data e autor; nunca publicado não tem nada disso.
  constraint complementos_publicacao_coerente check (
    (versao = 0) = (titulo is null and texto is null and publicado_em is null and publicado_por_email is null)
  ),
  constraint complementos_titulo_check check (titulo is null or length(btrim(titulo)) between 1 and 120),
  constraint complementos_texto_check check (texto is null or length(texto) between 1 and 20000),
  -- Só o que foi publicado se arquiva.
  constraint complementos_arquivo_coerente check (arquivado_em is null or versao > 0)
);

create index complementos_marca_idx on public.complementos (brand_id, created_at);
create index complementos_conta_idx on public.complementos (workspace_id);

-- ─── 2. O rascunho (só quem edita) ───────────────────────────────────────

create table public.rascunhos_de_complemento (
  complemento_id         uuid primary key references public.complementos(id) on delete cascade,
  workspace_id           uuid not null,
  brand_id               uuid not null,
  titulo                 text not null,
  texto                  text not null,
  atualizado_em          timestamptz not null default clock_timestamp(),
  atualizado_por         uuid references auth.users(id) on delete set null,
  atualizado_por_email   text not null,

  constraint rascunhos_de_complemento_titulo_check check (length(btrim(titulo)) between 1 and 120),
  constraint rascunhos_de_complemento_texto_check check (length(texto) <= 20000)
);

create index rascunhos_de_complemento_marca_idx on public.rascunhos_de_complemento (brand_id);

-- ─── 3. O histórico (só de acréscimo) ────────────────────────────────────

create table public.versoes_de_complemento (
  id             uuid primary key default gen_random_uuid(),
  complemento_id uuid not null references public.complementos(id) on delete cascade,
  workspace_id   uuid not null,
  brand_id       uuid not null,
  versao         integer not null,
  acao           text not null,
  titulo         text not null,
  texto          text not null,
  autor          uuid references auth.users(id) on delete set null,
  -- Copiado: o histórico continua dizendo quem fez depois que a pessoa sai.
  autor_email    text not null,
  created_at     timestamptz not null default clock_timestamp(),

  constraint versoes_de_complemento_acao_check check (acao in ('publicado', 'arquivado', 'reativado')),
  constraint versoes_de_complemento_versao_check check (versao >= 1)
);

create index versoes_de_complemento_idx on public.versoes_de_complemento (complemento_id, created_at desc);
create index versoes_de_complemento_marca_idx on public.versoes_de_complemento (brand_id, created_at desc);

-- ─── 4. Os trechos que o Vini lê (só do publicado e não arquivado) ───────

create table public.trechos_de_complemento (
  id             uuid primary key default gen_random_uuid(),
  complemento_id uuid not null references public.complementos(id) on delete cascade,
  workspace_id   uuid not null,
  brand_id       uuid not null,
  slug           text not null,
  titulo         text not null,
  secao          text,
  ordinal        integer not null,
  conteudo       text not null,
  tsv            tsvector not null
);

create index trechos_de_complemento_marca_idx on public.trechos_de_complemento (brand_id, complemento_id, ordinal);
create index trechos_de_complemento_tsv_idx on public.trechos_de_complemento using gin (tsv);

-- ─── 5. RLS ──────────────────────────────────────────────────────────────

alter table public.complementos enable row level security;
alter table public.rascunhos_de_complemento enable row level security;
alter table public.versoes_de_complemento enable row level security;
alter table public.trechos_de_complemento enable row level security;

-- Quem edita vê tudo da marca; quem consulta, só o publicado e não arquivado.
create policy "Quem alcança a marca lê os complementos publicados" on public.complementos
  for select to authenticated using (
    public.tem_capacidade_na_marca(brand_id, 'editar')
    or (versao > 0 and arquivado_em is null and public.tem_capacidade_na_marca(brand_id, 'consultar'))
  );
create policy "Só quem edita a marca lê os rascunhos" on public.rascunhos_de_complemento
  for select to authenticated using (public.tem_capacidade_na_marca(brand_id, 'editar'));
create policy "Só quem edita a marca lê as versões" on public.versoes_de_complemento
  for select to authenticated using (public.tem_capacidade_na_marca(brand_id, 'editar'));
-- Os trechos só existem para o publicado e não arquivado: quem alcança a marca lê.
create policy "Quem alcança a marca busca nos complementos" on public.trechos_de_complemento
  for select to authenticated using (public.tem_capacidade_na_marca(brand_id, 'consultar'));

revoke all on public.complementos from public, anon, authenticated;
revoke all on public.rascunhos_de_complemento from public, anon, authenticated;
revoke all on public.versoes_de_complemento from public, anon, authenticated;
revoke all on public.trechos_de_complemento from public, anon, authenticated;
grant select on public.complementos to authenticated;
grant select on public.rascunhos_de_complemento to authenticated;
grant select on public.versoes_de_complemento to authenticated;
grant select on public.trechos_de_complemento to authenticated;

-- ─── 6. Peças internas ───────────────────────────────────────────────────

/* O endereço do complemento, a partir do título: sem acento, minúsculo, com hífen. */
create function private.slug_de_complemento(p_titulo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(nullif(left(trim(both '-' from regexp_replace(lower(
    translate(p_titulo,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^a-z0-9]+', '-', 'g')), 60), ''), 'complemento');
$$;

revoke all on function private.slug_de_complemento(text) from public, anon, authenticated;

/*
 * Os trechos de um complemento: o texto publicado, cortado pelos títulos de
 * nível 2 (`## Seção`). O que vem antes do primeiro `##` é o trecho de abertura,
 * sem seção. Arquivado, ou nunca publicado, fica sem trecho nenhum.
 */
create function private.reconstruir_trechos_de_complemento(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c public.complementos%rowtype;
  config regconfig;
  linha text;
  secao text := null;
  corpo text := '';
  n integer := 0;
begin
  delete from public.trechos_de_complemento where complemento_id = p_id;
  select * into c from public.complementos where id = p_id;
  if c.id is null or c.versao = 0 or c.arquivado_em is not null then return; end if;

  config := public.config_de_busca((select b.language from public.brands b where b.id = c.brand_id));

  for linha in select l from regexp_split_to_table(c.texto || E'\n## ', E'\n') as l loop
    if linha ~ '^##\s' then
      if length(btrim(corpo)) > 0 then
        insert into public.trechos_de_complemento
          (complemento_id, workspace_id, brand_id, slug, titulo, secao, ordinal, conteudo, tsv)
        values (c.id, c.workspace_id, c.brand_id, c.slug, c.titulo, secao, n, btrim(corpo),
          to_tsvector(config, c.titulo || ' ' || coalesce(secao, '') || ' ' || corpo));
        n := n + 1;
      end if;
      secao := nullif(btrim(regexp_replace(linha, '^##\s+', '')), '');
      corpo := '';
    else
      corpo := corpo || linha || E'\n';
    end if;
  end loop;
end;
$$;

revoke all on function private.reconstruir_trechos_de_complemento(uuid) from public, anon, authenticated;

/* A marca do complemento, conferida para quem edita. Inexistente e alheio respondem igual. */
create function private.complemento_editavel(p_id uuid)
returns public.complementos
language plpgsql
set search_path = ''
as $$
declare
  c public.complementos%rowtype;
begin
  select * into c from public.complementos where id = p_id for update;
  if (select auth.uid()) is null or c.id is null or not public.tem_capacidade_na_marca(c.brand_id, 'editar') then
    raise exception 'complemento não encontrado' using errcode = '42501';
  end if;
  return c;
end;
$$;

revoke all on function private.complemento_editavel(uuid) from public, anon, authenticated;

create function private.email_de(p_quem uuid)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select u.email from auth.users u where u.id = p_quem), '(sem e-mail)');
$$;

revoke all on function private.email_de(uuid) from public, anon, authenticated;

-- ─── 7. As ações de quem edita ───────────────────────────────────────────
--
-- Recusas com constraint nomeada (a prova confere o nome) e o mesmo nome na
-- DICA, porque o PostgREST não devolve o nome da constraint à rota:
--   sem `editar` na marca                     → 42501
--   título fora de 1–120 / texto acima de 20 mil → *_titulo_check / *_texto_check
--   publicar sem rascunho                     → complementos_sem_rascunho
--   mexer em complemento arquivado            → complementos_arquivado
--   arquivar o que nunca foi publicado        → complementos_arquivo_coerente

create function public.criar_complemento(p_brand_id uuid, p_titulo text, p_texto text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  conta uuid;
  base text;
  candidato text;
  n integer := 1;
  novo uuid;
begin
  if quem is null or not public.tem_capacidade_na_marca(p_brand_id, 'editar') then
    raise exception 'só quem edita a marca cria complemento' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_titulo, ''))) not between 1 and 120 then
    raise exception 'o título vai de 1 a 120 caracteres'
      using errcode = 'check_violation', constraint = 'rascunhos_de_complemento_titulo_check', hint = 'rascunhos_de_complemento_titulo_check';
  end if;
  if length(coalesce(p_texto, '')) > 20000 then
    raise exception 'o texto vai até 20 mil caracteres'
      using errcode = 'check_violation', constraint = 'rascunhos_de_complemento_texto_check', hint = 'rascunhos_de_complemento_texto_check';
  end if;

  select b.workspace_id into conta from public.brands b where b.id = p_brand_id;
  base := private.slug_de_complemento(btrim(p_titulo));
  candidato := base;
  while exists (select 1 from public.complementos c where c.brand_id = p_brand_id and c.slug = candidato) loop
    n := n + 1;
    candidato := base || '-' || n;
  end loop;

  insert into public.complementos (workspace_id, brand_id, slug, criado_por)
  values (conta, p_brand_id, candidato, quem)
  returning id into novo;

  insert into public.rascunhos_de_complemento
    (complemento_id, workspace_id, brand_id, titulo, texto, atualizado_por, atualizado_por_email)
  values (novo, conta, p_brand_id, btrim(p_titulo), coalesce(p_texto, ''), quem, private.email_de(quem));

  return novo;
end;
$$;

revoke all on function public.criar_complemento(uuid, text, text) from public, anon;
grant execute on function public.criar_complemento(uuid, text, text) to authenticated;

create function public.salvar_rascunho_de_complemento(p_id uuid, p_titulo text, p_texto text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  c public.complementos%rowtype;
begin
  c := private.complemento_editavel(p_id);
  if c.arquivado_em is not null then
    raise exception 'complemento arquivado: reative antes de editar'
      using errcode = 'check_violation', constraint = 'complementos_arquivado', hint = 'complementos_arquivado';
  end if;
  if length(btrim(coalesce(p_titulo, ''))) not between 1 and 120 then
    raise exception 'o título vai de 1 a 120 caracteres'
      using errcode = 'check_violation', constraint = 'rascunhos_de_complemento_titulo_check', hint = 'rascunhos_de_complemento_titulo_check';
  end if;
  if length(coalesce(p_texto, '')) > 20000 then
    raise exception 'o texto vai até 20 mil caracteres'
      using errcode = 'check_violation', constraint = 'rascunhos_de_complemento_texto_check', hint = 'rascunhos_de_complemento_texto_check';
  end if;

  insert into public.rascunhos_de_complemento
    (complemento_id, workspace_id, brand_id, titulo, texto, atualizado_por, atualizado_por_email)
  values (c.id, c.workspace_id, c.brand_id, btrim(p_titulo), coalesce(p_texto, ''), quem, private.email_de(quem))
  on conflict (complemento_id) do update
    set titulo = excluded.titulo, texto = excluded.texto, atualizado_em = clock_timestamp(),
        atualizado_por = excluded.atualizado_por, atualizado_por_email = excluded.atualizado_por_email;
end;
$$;

revoke all on function public.salvar_rascunho_de_complemento(uuid, text, text) from public, anon;
grant execute on function public.salvar_rascunho_de_complemento(uuid, text, text) to authenticated;

/* Publicar é aprovar (decisão 75): o rascunho vira a versão seguinte, e o Vini passa a lê-la. */
create function public.publicar_complemento(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  c public.complementos%rowtype;
  r public.rascunhos_de_complemento%rowtype;
  email text;
begin
  c := private.complemento_editavel(p_id);
  if c.arquivado_em is not null then
    raise exception 'complemento arquivado: reative antes de publicar'
      using errcode = 'check_violation', constraint = 'complementos_arquivado', hint = 'complementos_arquivado';
  end if;
  select * into r from public.rascunhos_de_complemento where complemento_id = p_id;
  if r.complemento_id is null then
    raise exception 'não há rascunho para publicar'
      using errcode = 'check_violation', constraint = 'complementos_sem_rascunho', hint = 'complementos_sem_rascunho';
  end if;
  if length(btrim(r.texto)) = 0 then
    raise exception 'o texto do complemento está vazio'
      using errcode = 'check_violation', constraint = 'complementos_texto_check', hint = 'complementos_texto_check';
  end if;

  email := private.email_de(quem);
  update public.complementos
     set versao = c.versao + 1, titulo = r.titulo, texto = r.texto,
         publicado_em = clock_timestamp(), publicado_por = quem, publicado_por_email = email
   where id = p_id;

  insert into public.versoes_de_complemento
    (complemento_id, workspace_id, brand_id, versao, acao, titulo, texto, autor, autor_email)
  values (c.id, c.workspace_id, c.brand_id, c.versao + 1, 'publicado', r.titulo, r.texto, quem, email);

  delete from public.rascunhos_de_complemento where complemento_id = p_id;
  perform private.reconstruir_trechos_de_complemento(p_id);
  return c.versao + 1;
end;
$$;

revoke all on function public.publicar_complemento(uuid) from public, anon;
grant execute on function public.publicar_complemento(uuid) to authenticated;

/*
 * Descarta o rascunho. Se o complemento nunca foi publicado, ele inteiro se
 * vai: não há versão, histórico nem leitor — só o rascunho existia.
 */
create function public.descartar_rascunho_de_complemento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.complementos%rowtype;
begin
  c := private.complemento_editavel(p_id);
  if c.versao = 0 then
    delete from public.complementos where id = p_id;
  else
    delete from public.rascunhos_de_complemento where complemento_id = p_id;
  end if;
end;
$$;

revoke all on function public.descartar_rascunho_de_complemento(uuid) from public, anon;
grant execute on function public.descartar_rascunho_de_complemento(uuid) to authenticated;

/* Arquivar tira da leitura e do Vini, sem apagar nada. Reativar devolve. */
create function public.arquivar_complemento(p_id uuid, p_arquivar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  quem uuid := (select auth.uid());
  c public.complementos%rowtype;
begin
  c := private.complemento_editavel(p_id);
  if c.versao = 0 then
    raise exception 'só o que foi publicado se arquiva'
      using errcode = 'check_violation', constraint = 'complementos_arquivo_coerente', hint = 'complementos_arquivo_coerente';
  end if;
  -- Pedir o estado em que já está não grava nada.
  if p_arquivar = (c.arquivado_em is not null) then return; end if;

  update public.complementos
     set arquivado_em = case when p_arquivar then clock_timestamp() end,
         arquivado_por = case when p_arquivar then quem end
   where id = p_id;

  insert into public.versoes_de_complemento
    (complemento_id, workspace_id, brand_id, versao, acao, titulo, texto, autor, autor_email)
  values (c.id, c.workspace_id, c.brand_id, c.versao, case when p_arquivar then 'arquivado' else 'reativado' end,
          c.titulo, c.texto, quem, private.email_de(quem));

  perform private.reconstruir_trechos_de_complemento(p_id);
end;
$$;

revoke all on function public.arquivar_complemento(uuid, boolean) from public, anon;
grant execute on function public.arquivar_complemento(uuid, boolean) to authenticated;

-- ─── 8. A busca do Vini ──────────────────────────────────────────────────

/*
 * Os trechos de complemento da marca, do mais ao menos parecido com a
 * pergunta. ORDENA, não filtra: complementos são poucos e curtos, e descartar
 * um por falta de sinônimo esconderia exatamente o texto que a marca escreveu
 * para tapar a lacuna. `security invoker`: a RLS dos trechos decide.
 */
create function public.buscar_complementos(p_brand_id uuid, p_consulta text, p_limite integer default 6)
returns table (slug text, titulo text, secao text, ordinal integer, conteudo text, relevancia real)
language plpgsql
stable
set search_path = ''
as $$
declare
  config regconfig;
  consulta tsquery;
begin
  config := public.config_de_busca((select b.language from public.brands b where b.id = p_brand_id));
  -- Os radicais já vêm do dicionário da marca: viram consulta direto, sem
  -- passar de novo pelo dicionário (que poderia reduzir o radical outra vez).
  select string_agg(quote_literal(l), ' | ')::tsquery
    into consulta
    from unnest(tsvector_to_array(to_tsvector(config, coalesce(p_consulta, '')))) l;

  return query
  select t.slug, t.titulo, t.secao, t.ordinal, t.conteudo,
         coalesce(ts_rank(t.tsv, consulta), 0)::real
    from public.trechos_de_complemento t
   where t.brand_id = p_brand_id
   order by coalesce(ts_rank(t.tsv, consulta), 0) desc, t.slug, t.ordinal
   limit least(greatest(coalesce(p_limite, 6), 1), 20);
end;
$$;

revoke all on function public.buscar_complementos(uuid, text, integer) from public, anon;
grant execute on function public.buscar_complementos(uuid, text, integer) to authenticated;
