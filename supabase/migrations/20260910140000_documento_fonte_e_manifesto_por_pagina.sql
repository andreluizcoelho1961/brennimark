-- Etapa 2 — o documento-fonte durável e o manifesto por página.
--
-- ─── O defeito que esta migration existe para tornar impossível ──────────
--
-- Hoje a cobertura de páginas vive em `brand_documents.source_pages`, um jsonb
-- de faixas. Ele lista o que as seções ABSORVERAM, não o que existia. Em
-- `src/lib/import/secoes.ts:289` uma página sem texto extraível é excluída da
-- faixa da própria seção que a contém — com comentário explícito dizendo que
-- as vazias vão para `ignoradas`.
--
-- Num manual de identidade, página sem texto extraível é ARTE: a prancha de
-- cor, o espécime tipográfico, a fotografia de aplicação. O produto identifica
-- corretamente que aquilo não tem texto e usa a conclusão para descartar.
-- Medido no manual do Bradesco: 47 páginas, 43 seções, **1 sem texto**.
--
-- ─── A regra, e ela é uma constraint, não uma convenção ──────────────────
--
-- Toda importação passa a produzir UMA LINHA POR PÁGINA, de 1 a N. Se o PDF
-- tem 743 páginas, o manifesto tem 743 linhas. E cada linha ou pertence a uma
-- seção — e o vínculo existe — ou declara POR ESCRITO por que não pertence.
-- Não há terceiro estado. É a diferença entre registrar o que sobrou e
-- registrar o que faltou.

-- ════════════════════════════════════════════════════════════════════════
-- 1. O documento-fonte
-- ════════════════════════════════════════════════════════════════════════
--
-- POR QUE TABELA NOVA, e não colunas em `brand_imports`. As duas respondem
-- perguntas diferentes, e fundi-las obrigaria uma linha a mentir numa delas.
--
--   brand_imports          o LOG: aconteceu uma importação, nesta data, por
--                          esta pessoa, com este relatório. Uma importação que
--                          falhou na metade ainda é um fato a registrar.
--   brand_source_documents o ESTADO: este é o manual vigente desta marca.
--
-- Log não tem "vigente"; estado não tem "tentativa".
create table public.brand_source_documents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  brand_id      uuid not null,

  -- O arquivo fica ONDE JÁ ESTÁ. Nada é copiado: o caminho canônico do bucket
  -- de importação já é `workspaceId/importId/<sha256>.pdf`, conferido no
  -- servidor pela RPC de publicação desde 30/08.
  bucket_id     text not null default 'brand-imports',
  storage_path  text not null,
  pdf_sha256    text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size     bigint not null check (byte_size > 0),
  page_count    integer not null check (page_count > 0),

  -- Nome editável no Studio: "Manual da marca 2026". Vazio é estado válido —
  -- a agência nomeia quando quiser, e o produto não inventa nome por ela.
  titulo        text not null default '',

  -- Um manual não é a única coisa que uma marca envia. Sem este campo, o
  -- primeiro anexo vira "manual" ou vira tabela nova.
  tipo          text not null default 'manual'
                check (tipo in ('manual', 'anexo', 'apresentacao', 'guia')),

  -- O idioma do DOCUMENTO, que pode divergir do da marca: manual em inglês
  -- numa marca configurada em pt-BR é o caso comum, não a exceção.
  idioma        text,

  /*
   * Importar, renderizar miniaturas e extrair texto não terminam juntos.
   *
   * Sem estado, a interface não distingue "ainda processando" de "processou e
   * não achou nada" — e essa distinção é a diferença entre paciência e
   * desconfiança de quem está olhando.
   */
  estado_de_processamento text not null default 'pendente'
                check (estado_de_processamento in ('pendente', 'processando', 'concluido', 'falhou')),

  -- Versão e substituição: reimportar o manual não apaga o anterior.
  versao        integer not null default 1 check (versao > 0),
  substitui_id  uuid references public.brand_source_documents(id) on delete set null,
  status        text not null default 'ativa' check (status in ('ativa', 'substituida')),

  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Composta, como todo vínculo com marca neste esquema: o documento de uma
  -- conta não pode apontar para a marca de outra.
  constraint brand_source_documents_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade,

  unique (brand_id, workspace_id, versao)
);

/*
 * A peça que faz "vigente" ser verificável pelo BANCO, e não por convenção.
 *
 * Duas edições ativas para a mesma marca passam a ser impossíveis, não
 * improváveis. Sem isto, "qual é o manual vigente" seria respondido por
 * `order by created_at desc limit 1` — que é um palpite disfarçado de consulta.
 */
create unique index brand_source_documents_uma_ativa_por_marca
  on public.brand_source_documents (brand_id, workspace_id)
  where status = 'ativa';

create index brand_source_documents_marca_idx
  on public.brand_source_documents (brand_id, workspace_id, versao desc);

alter table public.brand_source_documents enable row level security;

create policy "Members read brand source documents" on public.brand_source_documents
  for select to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));

create policy "Owners write brand source documents" on public.brand_source_documents
  for insert to authenticated with check (
    created_by = (select auth.uid())
    and workspace_id in (
      select workspace_members.workspace_id from public.workspace_members
      where workspace_members.user_id = (select auth.uid())
        and workspace_members.role = 'owner'));

create policy "Owners update brand source documents" on public.brand_source_documents
  for update to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Owners delete brand source documents" on public.brand_source_documents
  for delete to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

revoke all on public.brand_source_documents from anon, authenticated;
grant select, insert, update, delete on public.brand_source_documents to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 2. O manifesto: uma linha por página física
-- ════════════════════════════════════════════════════════════════════════
create table public.brand_source_pages (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  brand_id            uuid not null,
  source_document_id  uuid not null
                        references public.brand_source_documents(id) on delete cascade,

  pagina              integer not null check (pagina > 0),

  -- Proporção ORIGINAL, em pontos do PDF. É o que o visualizador usa para
  -- montar a tabela de deslocamentos sem abrir o arquivo, e é o que impede a
  -- página de ser encaixada em proporção arbitrária.
  largura_pt          numeric not null check (largura_pt > 0),
  altura_pt           numeric not null check (altura_pt > 0),
  rotacao             integer not null default 0 check (rotacao in (0, 90, 180, 270)),

  tem_texto           boolean not null,
  caracteres          integer not null default 0 check (caracteres >= 0),

  -- Caminho da miniatura no Storage. A prévia e a curadoria mostram centenas
  -- de páginas; sem miniatura, mostram centenas de retângulos vazios.
  miniatura_path      text,

  /*
   * O vínculo com a seção publicada — e `set null`, NUNCA `cascade`.
   *
   * Apagar uma seção não pode apagar a página do manifesto: a página continua
   * existindo no PDF. Ela vira `sem-secao` com motivo, e a procedência
   * sobrevive à curadoria. É a regra do CLAUDE.md — nunca apagar histórico em
   * silêncio — expressa como constraint em vez de disciplina.
   */
  document_id         uuid references public.brand_documents(id) on delete set null,

  cobertura           text not null check (cobertura in ('secao', 'sem-secao')),
  motivo_da_cobertura text not null default '',

  -- Auxiliar, NUNCA juíza: informa curadoria e miniatura, e não decide o que é
  -- preservado. Toda página existe independente do que o classificador achou.
  classificacao       text check (classificacao in ('texto', 'visual', 'misto', 'vazia')),
  confianca           numeric check (confianca >= 0 and confianca <= 1),

  estado_de_processamento text not null default 'concluido'
                        check (estado_de_processamento in ('pendente', 'processando', 'concluido', 'falhou')),
  -- Quando a página falha, o motivo fica NA LINHA. "Algo deu errado em algum
  -- lugar do manual" não é diagnóstico.
  erro                text,

  created_at          timestamptz not null default now(),

  constraint brand_source_pages_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade,

  -- Uma linha por página, e no máximo uma. Página repetida seria cobertura
  -- inflada: 743 linhas para 700 páginas passaria por "completo".
  unique (source_document_id, pagina),

  /*
   * ─── As duas constraints que são o CORAÇÃO desta migration ────────────
   *
   * Elas tornam a ausência silenciosa impossível de ESCREVER. Uma página ou
   * pertence a uma seção — e então o vínculo existe — ou não pertence, e então
   * precisa dizer por quê, em texto, naquela linha.
   *
   * Hoje uma página some de uma faixa e não sobra registro. Depois disto,
   * sumir exige preencher um motivo.
   */
  constraint brand_source_pages_cobertura_coerente
    check ((cobertura = 'secao') = (document_id is not null)),
  constraint brand_source_pages_ausencia_justificada
    check (cobertura <> 'sem-secao' or length(btrim(motivo_da_cobertura)) > 0)
);

create index brand_source_pages_documento_idx
  on public.brand_source_pages (source_document_id, pagina);
create index brand_source_pages_marca_idx
  on public.brand_source_pages (brand_id, workspace_id);
-- Navegação seção → páginas, e a varredura de "quais páginas ficaram órfãs".
create index brand_source_pages_secao_idx
  on public.brand_source_pages (document_id) where document_id is not null;
create index brand_source_pages_sem_secao_idx
  on public.brand_source_pages (source_document_id) where cobertura = 'sem-secao';

alter table public.brand_source_pages enable row level security;

create policy "Members read brand source pages" on public.brand_source_pages
  for select to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));

create policy "Owners write brand source pages" on public.brand_source_pages
  for insert to authenticated with check (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Owners update brand source pages" on public.brand_source_pages
  for update to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

create policy "Owners delete brand source pages" on public.brand_source_pages
  for delete to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())
      and workspace_members.role = 'owner'));

revoke all on public.brand_source_pages from anon, authenticated;
grant select, insert, update, delete on public.brand_source_pages to authenticated;

-- `truncate` ignora RLS: uma linha apagaria o manifesto de todas as contas.
-- O mesmo achado que `20260830134312` registrou para `brand_documents`.
revoke truncate on public.brand_source_documents from authenticated;
revoke truncate on public.brand_source_pages from authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 3. O log aponta para o estado
-- ════════════════════════════════════════════════════════════════════════
--
-- Nullable, e `null` ali é VERDADE e não buraco: importações anteriores a esta
-- migration aconteceram antes de o conceito existir.
alter table public.brand_imports
  add column source_document_id uuid
    references public.brand_source_documents(id) on delete set null;

create index brand_imports_source_document_idx
  on public.brand_imports (source_document_id) where source_document_id is not null;

comment on column public.brand_imports.source_document_id is
  'O documento-fonte que esta importação produziu. Null nas importações '
  'anteriores a 10/09/2026, quando o conceito passou a existir.';

-- ════════════════════════════════════════════════════════════════════════
-- 4. A página sobrevive à seção — e sem isto ela IMPEDIA a curadoria
-- ════════════════════════════════════════════════════════════════════════
--
-- ─── O defeito, encontrado pela própria prova desta migration ────────────
--
-- `document_id` é `on delete set null` de propósito: apagar uma seção não pode
-- apagar a página, que continua existindo no PDF. Mas a constraint de
-- coerência exige `(cobertura = 'secao') = (document_id is not null)` — então
-- o `set null` produzia uma linha com `cobertura='secao'` e vínculo nulo, a
-- check recusava, e **o DELETE da seção falhava**.
--
-- O efeito seria o oposto do pretendido: em vez de a página sobreviver à
-- curadoria, a curadoria ficaria impossível. Unir ou remover seção — que é o
-- trabalho central da Etapa 3 — abortaria com erro de constraint.
--
-- O gatilho fecha a transição: quando o vínculo cai, a página passa a
-- `sem-secao` com motivo datado. A procedência não se perde e a curadoria
-- funciona.
create function public.brand_source_pages_soltar_secao()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.document_id is null and new.cobertura = 'secao' then
    new.cobertura := 'sem-secao';
    -- Motivo automático só quando ninguém escreveu um: quem cura pode dizer
    -- melhor, e a mão humana não deve ser sobrescrita pelo gatilho.
    if length(btrim(coalesce(new.motivo_da_cobertura, ''))) = 0 then
      new.motivo_da_cobertura :=
        'seção removida em ' || to_char(now(), 'YYYY-MM-DD') || '; página preservada';
    end if;
  end if;
  return new;
end;
$$;

-- Sem `security definer`: o gatilho só reescreve campos da linha que já está
-- sendo alterada, e não precisa de privilégio além do de quem altera.
revoke execute on function public.brand_source_pages_soltar_secao() from public, anon, authenticated;

create trigger brand_source_pages_soltar_secao
  before update of document_id on public.brand_source_pages
  for each row execute function public.brand_source_pages_soltar_secao();
