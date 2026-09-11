-- Etapa 2 — o documento-fonte durável e o manifesto por página.
--
-- ─── O defeito que esta migration existe para tornar impossível ──────────
--
-- A cobertura de páginas vive hoje em `brand_documents.source_pages`, um jsonb
-- de faixas. Ele lista o que as seções ABSORVERAM, não o que existia. Em
-- `src/lib/import/secoes.ts:289` uma página sem texto extraível é excluída da
-- faixa da própria seção que a contém — com comentário explícito.
--
-- Num manual de identidade, página sem texto extraível é ARTE: a prancha de
-- cor, o espécime tipográfico, a fotografia de aplicação. O produto identifica
-- corretamente que aquilo não tem texto e usa a conclusão para descartar.
-- Medido no manual do Bradesco: 47 páginas, 43 seções, 1 sem texto.
--
-- ─── A regra: constraint, não convenção ──────────────────────────────────
--
-- Uma linha por página, de 1 a N. Cada linha ou pertence a uma seção — e o
-- vínculo existe — ou declara POR ESCRITO por que não pertence.
--
-- ─── Revisão de 10/09: cinco brechas medidas, e todas fechadas aqui ──────
--
-- A primeira versão desta migration foi revisada e cinco afirmações foram
-- verificadas contra o banco antes de qualquer correção. Todas se confirmaram:
--
--   1. página 999 num documento com `page_count = 3`     ACEITA
--   2. owner reescrevia `pdf_sha256`, `storage_path`
--      e `page_count` do original                        ACEITO
--   3. página da marca B apontando para documento
--      da marca A                                        ACEITA
--   4. página apontando para seção de outra marca        ACEITA
--   5. manual e anexo ativos ao mesmo tempo              RECUSADO (errado:
--      o índice de "uma ativa" era por marca, não por tipo)
--
-- Cada uma tem prova negativa em `scripts/prova-manifesto-por-pagina.sh`.

-- ════════════════════════════════════════════════════════════════════════
-- 0. Pré-requisito: referência composta para seção
-- ════════════════════════════════════════════════════════════════════════
--
-- `brand_documents` tem `id`, `brand_id` e `workspace_id`, mas nenhuma
-- unicidade sobre os três — então não era possível referenciá-la de forma
-- composta, e uma página podia apontar para seção de OUTRA marca (brecha 4).
alter table public.brand_documents
  add constraint brand_documents_id_brand_workspace_key
  unique (id, brand_id, workspace_id);

-- ════════════════════════════════════════════════════════════════════════
-- 1. O documento-fonte
-- ════════════════════════════════════════════════════════════════════════
--
-- POR QUE TABELA NOVA, e não colunas em `brand_imports`. As duas respondem
-- perguntas diferentes, e fundi-las obrigaria uma linha a mentir numa delas.
--
--   brand_imports          o LOG: aconteceu uma importação, nesta data, por
--                          esta pessoa. Uma que falhou na metade ainda é fato.
--   brand_source_documents o ESTADO: este é o manual vigente desta marca.
create table public.brand_source_documents (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  brand_id      uuid not null,

  -- ─── Procedência: IMUTÁVEL depois de criada ───────────────────────────
  --
  -- O arquivo fica onde já está; nada é copiado. Estes campos descrevem o
  -- ORIGINAL, e o original não se edita — a garantia está em §4: não há
  -- `grant update` para `authenticated`, e a RPC de edição editorial não
  -- alcança nenhum destes.
  bucket_id     text not null default 'brand-imports',
  storage_path  text not null,
  pdf_sha256    text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size     bigint not null check (byte_size > 0),
  page_count    integer not null check (page_count > 0),

  -- ─── Editorial: muda por RPC específica ───────────────────────────────
  titulo        text not null default '',
  idioma        text,

  -- Um manual não é a única coisa que uma marca envia. Sem este campo, o
  -- primeiro anexo vira "manual" ou vira tabela nova.
  tipo          text not null default 'manual'
                check (tipo in ('manual', 'anexo', 'apresentacao', 'guia')),

  estado_de_processamento text not null default 'pendente'
                check (estado_de_processamento in ('pendente', 'processando', 'concluido', 'falhou')),

  versao        integer not null default 1 check (versao > 0),
  substitui_id  uuid,
  status        text not null check (status in ('ativa', 'substituida')) default 'ativa',

  created_by    uuid not null references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Composta, como todo vínculo com marca neste esquema.
  constraint brand_source_documents_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade,

  -- Permite que páginas e importações referenciem de forma COMPOSTA, o que
  -- fecha as brechas 3 e 4.
  constraint brand_source_documents_id_brand_workspace_key
    unique (id, brand_id, workspace_id),

  /*
   * A versão é única DENTRO DO TIPO, e não dentro da marca.
   *
   * Consequência direta da decisão de "uma ativa por tipo", e a prova pegou a
   * incoerência: com `unique (brand_id, workspace_id, versao)`, um manual v1 e
   * um anexo v1 colidiam — os dois tipos não podiam coexistir nem na primeira
   * versão. A decisão dizia uma coisa e o esquema outra.
   */
  unique (brand_id, workspace_id, tipo, versao)
);

/*
 * Substituição só dentro da MESMA marca (brecha 3, na variante de versão).
 *
 * Auto-referência composta: o documento que substitui e o substituído precisam
 * pertencer à mesma marca e à mesma conta. Sem isto, o histórico de versões de
 * uma marca podia apontar para o manual de outra.
 */
alter table public.brand_source_documents
  add constraint brand_source_documents_substitui_mesma_marca_fkey
  foreign key (substitui_id, brand_id, workspace_id)
  references public.brand_source_documents (id, brand_id, workspace_id)
  -- Coluna nomeada, pelo mesmo motivo da referência de seção: sem a lista,
  -- apagar a versão anterior zeraria `brand_id` e `workspace_id` da sucessora.
  on delete set null (substitui_id);

/*
 * ─── A unidade de versionamento: UMA ATIVA POR TIPO ────────────────────
 *
 * DECISÃO REGISTRADA (10/09/2026), e ela não podia ser silenciosa.
 *
 * A primeira versão tinha índice único por MARCA, e isso tornava impossível
 * uma marca ter manual e anexo ativos ao mesmo tempo — medido e confirmado.
 * Como a tabela declara quatro tipos, o índice contradizia o próprio esquema.
 *
 * As três opções consideradas:
 *
 *   por tipo             uma marca tem um manual ativo, um anexo ativo, uma
 *                        apresentação ativa. Simples, e escala sem tabela nova.
 *   por família          exigiria uma coluna de família e a pergunta "o que é
 *                        família" antes de existir tela que a use.
 *   manual único +       trata anexo como cidadão de segunda classe; o dia em
 *   anexos livres        que dois anexos com o mesmo papel coexistirem, não há
 *                        regra que os distinga.
 *
 * Escolhido: **por tipo**. É o que a coluna `tipo` já implica, não exige
 * esquema novo, e a substituição continua tendo significado dentro do tipo.
 *
 * Reversível: trocar este índice é uma migration de uma linha. Não trava dado.
 */
create unique index brand_source_documents_uma_ativa_por_tipo
  on public.brand_source_documents (brand_id, workspace_id, tipo)
  where status = 'ativa';

-- Sustenta a busca de idempotência da RPC: mesma marca, mesmo tipo, mesmo
-- arquivo. Sem ele, cada repetição varre a tabela.
create unique index brand_source_documents_idempotencia
  on public.brand_source_documents (brand_id, workspace_id, tipo, pdf_sha256);

create index brand_source_documents_marca_idx
  on public.brand_source_documents (brand_id, workspace_id, versao desc);
create index brand_source_documents_substitui_idx
  on public.brand_source_documents (substitui_id) where substitui_id is not null;

alter table public.brand_source_documents enable row level security;

create policy "Members read brand source documents" on public.brand_source_documents
  for select to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));

-- ════════════════════════════════════════════════════════════════════════
-- 2. O manifesto: uma linha por página física
-- ════════════════════════════════════════════════════════════════════════
create table public.brand_source_pages (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  brand_id            uuid not null,
  source_document_id  uuid not null,

  pagina              integer not null check (pagina > 0),

  -- Proporção ORIGINAL, em pontos do PDF. É o que o visualizador usa para
  -- montar a tabela de deslocamentos sem abrir o arquivo.
  largura_pt          numeric not null check (largura_pt > 0),
  altura_pt           numeric not null check (altura_pt > 0),
  rotacao             integer not null default 0 check (rotacao in (0, 90, 180, 270)),

  tem_texto           boolean not null,
  caracteres          integer not null default 0 check (caracteres >= 0),
  miniatura_path      text,

  /*
   * O vínculo com a seção — `set null`, NUNCA `cascade`.
   *
   * Apagar uma seção não pode apagar a página do manifesto: a página continua
   * existindo no PDF. Ela vira `sem-secao` com motivo (§5), e a procedência
   * sobrevive à curadoria.
   */
  document_id         uuid,

  cobertura           text not null check (cobertura in ('secao', 'sem-secao')),
  motivo_da_cobertura text not null default '',

  -- Auxiliar, NUNCA juíza: informa curadoria e miniatura, e não decide o que é
  -- preservado. Toda página existe independente do que o classificador achou.
  classificacao       text check (classificacao in ('texto', 'visual', 'misto', 'vazia')),
  confianca           numeric check (confianca >= 0 and confianca <= 1),

  estado_de_processamento text not null default 'concluido'
                        check (estado_de_processamento in ('pendente', 'processando', 'concluido', 'falhou')),
  erro                text,

  created_at          timestamptz not null default now(),

  constraint brand_source_pages_brand_workspace_fkey
    foreign key (brand_id, workspace_id)
    references public.brands(id, workspace_id) on delete cascade,

  /*
   * Referências COMPOSTAS — as duas fecham brechas medidas.
   *
   * Sem elas, uma página declarada da marca B podia apontar para o
   * documento-fonte da marca A (brecha 3), e para uma seção de outra marca
   * (brecha 4). Ambas foram confirmadas aceitas antes da correção.
   */
  constraint brand_source_pages_documento_mesma_marca_fkey
    foreign key (source_document_id, brand_id, workspace_id)
    references public.brand_source_documents (id, brand_id, workspace_id)
    on delete cascade,

  /*
   * `set null` DE UMA COLUNA SÓ, e isto não é detalhe de sintaxe.
   *
   * `on delete set null` sem lista zera TODAS as colunas da chave — inclusive
   * `brand_id` e `workspace_id`, que são `not null`. A prova pegou: apagar uma
   * seção produzia `UPDATE ... SET document_id=NULL, brand_id=NULL,
   * workspace_id=NULL`, a linha violava `not null`, e **o DELETE da seção
   * falhava**.
   *
   * É o mesmo defeito que a constraint de coerência já tinha causado uma vez,
   * reaparecendo por outro caminho: a curadoria ficaria impossível.
   *
   * Nomear a coluna resolve, e há precedente neste esquema —
   * `brand_imports_brand_workspace_fkey` usa `set null (brand_id)` desde 02/09.
   */
  constraint brand_source_pages_secao_mesma_marca_fkey
    foreign key (document_id, brand_id, workspace_id)
    references public.brand_documents (id, brand_id, workspace_id)
    on delete set null (document_id),

  -- Uma linha por página, e no máximo uma. Página repetida seria cobertura
  -- inflada: 743 linhas para 700 páginas passaria por "completo".
  unique (source_document_id, pagina),

  /*
   * ─── As duas constraints que são o CORAÇÃO desta migration ────────────
   *
   * Elas tornam a ausência silenciosa impossível de ESCREVER: a página ou
   * pertence a uma seção, ou diz por quê não pertence.
   */
  constraint brand_source_pages_cobertura_coerente
    check ((cobertura = 'secao') = (document_id is not null)),
  constraint brand_source_pages_ausencia_justificada
    check (cobertura <> 'sem-secao' or length(btrim(motivo_da_cobertura)) > 0)
);

-- `(source_document_id, pagina)` já tem índice pela UNIQUE acima — um índice
-- explícito sobre as mesmas colunas seria duplicata paga em toda escrita.
create index brand_source_pages_marca_idx
  on public.brand_source_pages (brand_id, workspace_id);
create index brand_source_pages_secao_idx
  on public.brand_source_pages (document_id) where document_id is not null;
create index brand_source_pages_sem_secao_idx
  on public.brand_source_pages (source_document_id) where cobertura = 'sem-secao';

alter table public.brand_source_pages enable row level security;

create policy "Members read brand source pages" on public.brand_source_pages
  for select to authenticated using (workspace_id in (
    select workspace_members.workspace_id from public.workspace_members
    where workspace_members.user_id = (select auth.uid())));

-- ════════════════════════════════════════════════════════════════════════
-- 3. `pagina` não passa de `page_count`
-- ════════════════════════════════════════════════════════════════════════
--
-- Medido antes da correção: um documento com `page_count = 3` aceitava uma
-- página de número 999. A verificação atravessa duas tabelas, então não cabe
-- num `check` — vai num gatilho.
--
-- Ele é cinto E suspensório: a RPC de §4 já valida a faixa inteira, e este
-- gatilho protege também o caminho da chave de serviço, que não passa por ela.
create function public.brand_source_pages_pagina_dentro_do_documento()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  total integer;
begin
  select page_count into total
  from public.brand_source_documents
  where id = new.source_document_id;

  if total is null then
    raise exception 'documento-fonte % não existe', new.source_document_id
      using errcode = '23503';
  end if;
  if new.pagina > total then
    raise exception 'página % está fora do documento, que tem % páginas', new.pagina, total
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke execute on function public.brand_source_pages_pagina_dentro_do_documento()
  from public, anon, authenticated;

create trigger brand_source_pages_pagina_dentro_do_documento
  before insert or update of pagina, source_document_id on public.brand_source_pages
  for each row execute function public.brand_source_pages_pagina_dentro_do_documento();

-- ════════════════════════════════════════════════════════════════════════
-- 4. Escrita só por RPC — completude e imutabilidade do original
/*
 * ─── O vínculo da importação com o documento-fonte ──────────────────────
 *
 * `brand_imports.source_document_id` é o SINAL de publicação completa: nulo
 * significa que o manifesto não foi registrado, e é isso que a interface
 * mostra como pendência.
 *
 * Ele era escrito pela rota, com o cliente da sessão, e não podia funcionar:
 * `authenticated` tem `select` e `insert` em `brand_imports` e nenhum
 * `update`. Toda publicação falharia com 42501 no último passo, e — pior — a
 * rota classificava isso como falha temporária, oferecendo eternamente uma
 * nova tentativa que jamais concluiria.
 *
 * Conceder `update` a `authenticated` seria a correção errada. Esta coluna
 * afirma que a publicação está completa; quem a escreve à mão pode afirmar
 * completude que não existe, e o produto passaria a confiar numa declaração do
 * cliente exatamente onde decidiu não confiar.
 *
 * Aqui dentro, o vínculo entra na MESMA transação do documento e do
 * manifesto. Os três acontecem juntos ou nenhum acontece.
 *
 * As quatro condições do `where` são a validação: a importação precisa ser
 * desta conta, desta marca e DESTE arquivo. Sem elas, um `p_import_id` de
 * outra marca marcaria como completa uma publicação alheia.
 */
create function private.vincular_importacao_ao_documento(
  p_import_id          uuid,
  p_source_document_id uuid,
  p_brand_id           uuid,
  p_workspace_id       uuid,
  p_pdf_sha256         text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  afetadas integer;
begin
  -- Documento-fonte sem importação de origem é legítimo: um original trazido
  -- por outro caminho não tem o que vincular.
  if p_import_id is null then
    return;
  end if;

  update public.brand_imports
     set source_document_id = p_source_document_id
   where import_id = p_import_id
     and brand_id = p_brand_id
     and workspace_id = p_workspace_id
     and pdf_sha256 = p_pdf_sha256;

  get diagnostics afetadas = row_count;

  /*
   * Zero linhas não é "nada a fazer": é um pedido que não corresponde ao
   * mundo. Ou a importação não existe, ou é de outra marca, ou é de outro
   * arquivo — e nos três casos gravar o documento sem o vínculo produziria
   * uma publicação permanentemente marcada como incompleta, que nenhuma
   * repetição conserta. Levantar aqui desfaz a transação inteira.
   *
   * `(workspace_id, import_id)` é único, então no máximo uma linha é atingida.
   */
  if afetadas = 0 then
    raise exception 'importação % não corresponde a esta marca e a este arquivo', p_import_id
      using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function private.vincular_importacao_ao_documento(
  uuid, uuid, uuid, uuid, text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════
--
-- ─── Por que não há `grant insert/update/delete` ─────────────────────────
--
-- Duas garantias não são expressáveis linha a linha:
--
--   COMPLETUDE   "existem exatamente as páginas 1..N, sem furo e sem
--                repetição" é uma propriedade do CONJUNTO. Nenhum `check`
--                alcança, porque cada linha é válida sozinha.
--   IMUTABILIDADE  medido antes da correção: o owner reescrevia `pdf_sha256`,
--                `storage_path` e `page_count` do original com um `update`.
--                Campo de procedência que aceita `update` não é procedência.
--
-- A saída é a mesma para as duas: **nenhuma escrita direta**. `authenticated`
-- só lê. Documento e manifesto entram juntos, numa transação, por uma função
-- que valida a faixa inteira antes de gravar.
--
-- Exclusão não tem RPC de propósito: ela acontece pelo `on delete cascade` da
-- marca, que já passa pela fila durável de remoção de arquivos.
create function public.registrar_documento_fonte(
  p_workspace_id uuid,
  p_brand_id     uuid,
  p_storage_path text,
  p_pdf_sha256   text,
  p_byte_size    bigint,
  p_page_count   integer,
  p_tipo         text,
  p_idioma       text,
  p_titulo       text,
  p_paginas      jsonb,
  p_created_by   uuid,
  /*
   * A importação a vincular, e ela entra AQUI de propósito.
   *
   * O vínculo era escrito pela rota, com o cliente da sessão. Não funcionava:
   * `authenticated` tem `select` e `insert` em `brand_imports` e nenhum
   * `update` — nem grant nem policy. O `update` falharia com 42501 em toda
   * publicação, e a interface classificaria isso como falha temporária,
   * oferecendo para sempre uma nova tentativa que nunca conclui.
   *
   * Liberar `update` a `authenticated` seria a correção errada: a coluna diz
   * que a publicação está completa, e quem pode escrevê-la à mão pode declarar
   * completa uma publicação que não é. Dentro desta função, documento,
   * manifesto e vínculo ficam na MESMA transação — que é o que a fatia
   * pretendia desde o começo e a rota não conseguia entregar.
   *
   * Nulo é permitido: registrar um documento-fonte sem importação de origem é
   * legítimo (um original trazido por outro caminho), e nesse caso não há o
   * que vincular.
   */
  p_import_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  novo_id uuid;
  quantas integer;
  distintas integer;
  proxima_versao integer;
  menor integer;
  maior integer;
begin
  if p_created_by is null then
    raise exception 'autor é obrigatório' using errcode = '22004';
  end if;
  -- Quem publica precisa administrar a conta. A função é definer, então esta
  -- verificação é a que substitui a RLS que ela contorna.
  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = p_workspace_id
      and workspace_members.user_id = p_created_by
      and workspace_members.role = 'owner'
  ) then
    raise exception 'só quem administra a conta registra documento-fonte'
      using errcode = '42501';
  end if;

  if coalesce(jsonb_typeof(p_paginas), 'null') <> 'array' then
    raise exception 'páginas devem vir num array' using errcode = '22023';
  end if;

  /*
   * A verificação de completude, e ela é o motivo desta função existir.
   *
   * Três perguntas sobre o CONJUNTO, que nenhum `check` de linha responde:
   * quantas vieram, quantas são distintas, e qual a faixa. As três precisam
   * fechar em 1..page_count para a gravação acontecer.
   */
  select count(*), count(distinct (pagina->>'pagina')::integer),
         min((pagina->>'pagina')::integer), max((pagina->>'pagina')::integer)
    into quantas, distintas, menor, maior
  from jsonb_array_elements(p_paginas) as pagina;

  if quantas <> p_page_count then
    raise exception 'manifesto incompleto: % páginas para um PDF de %',
      quantas, p_page_count using errcode = '22023';
  end if;
  if distintas <> quantas then
    raise exception 'manifesto com página repetida: % linhas, % números distintos',
      quantas, distintas using errcode = '22023';
  end if;
  -- Com contagem certa e sem repetição, min=1 e max=N implicam 1..N sem furo.
  if menor <> 1 or maior <> p_page_count then
    raise exception 'manifesto com furo: faixa % a %, esperada 1 a %',
      menor, maior, p_page_count using errcode = '22023';
  end if;

  /*
   * ─── IDEMPOTÊNCIA: mesma marca, mesmo tipo, mesmo arquivo ──────────────
   *
   * A publicação acontece em dois passos que NÃO são atômicos entre si: o
   * navegador publica marca e seções, e depois uma rota de servidor registra o
   * documento-fonte e o manifesto. Se a resposta do segundo passo se perder na
   * rede, a interface precisa poder repetir — e repetir não pode criar um
   * segundo documento nem duplicar 743 linhas de manifesto.
   *
   * A chave natural é o `sha256`: mesmo arquivo, mesma marca, mesmo tipo é o
   * mesmo documento. Encontrado, devolve o id existente e não toca no
   * manifesto.
   *
   * Isto NÃO afrouxa a regra de "uma ativa por tipo": um arquivo DIFERENTE do
   * mesmo tipo continua barrado pelo índice, porque substituir é ato
   * explícito. O que passa a ser tolerado é a repetição do mesmo ato.
   */
  select id into novo_id
  from public.brand_source_documents
  where brand_id = p_brand_id
    and workspace_id = p_workspace_id
    and tipo = coalesce(nullif(p_tipo, ''), 'manual')
    and pdf_sha256 = p_pdf_sha256;

  if novo_id is not null then
    -- Repetir precisa fechar o vínculo, e não só devolver o id: a tentativa
    -- anterior pode ter gravado o documento e sido interrompida antes disto.
    perform private.vincular_importacao_ao_documento(
      p_import_id, novo_id, p_brand_id, p_workspace_id, p_pdf_sha256);
    return novo_id;
  end if;

  /*
   * A próxima versão DENTRO DO TIPO.
   *
   * Registrar um segundo manual não substitui o primeiro em silêncio: a versão
   * avança, e o índice de "uma ativa por tipo" recusa a inserção enquanto a
   * anterior estiver ativa. Substituir é ato explícito, não efeito colateral
   * de importar de novo — perder o manual vigente por reimportação seria a
   * pior forma de descobrir essa regra.
   */
  select coalesce(max(versao), 0) + 1 into proxima_versao
  from public.brand_source_documents
  where brand_id = p_brand_id
    and workspace_id = p_workspace_id
    and tipo = coalesce(nullif(p_tipo, ''), 'manual');

  insert into public.brand_source_documents (
    workspace_id, brand_id, storage_path, pdf_sha256, byte_size, page_count,
    tipo, idioma, titulo, estado_de_processamento, versao, created_by)
  values (
    p_workspace_id, p_brand_id, p_storage_path, p_pdf_sha256, p_byte_size, p_page_count,
    coalesce(nullif(p_tipo, ''), 'manual'), nullif(p_idioma, ''), coalesce(p_titulo, ''),
    'concluido', proxima_versao, p_created_by)
  returning id into novo_id;

  insert into public.brand_source_pages (
    workspace_id, brand_id, source_document_id, pagina, largura_pt, altura_pt,
    rotacao, tem_texto, caracteres, miniatura_path, document_id,
    cobertura, motivo_da_cobertura, classificacao, confianca)
  select
    p_workspace_id, p_brand_id, novo_id,
    (p->>'pagina')::integer,
    (p->>'largura_pt')::numeric,
    (p->>'altura_pt')::numeric,
    coalesce((p->>'rotacao')::integer, 0),
    coalesce((p->>'tem_texto')::boolean, false),
    coalesce((p->>'caracteres')::integer, 0),
    nullif(p->>'miniatura_path', ''),
    nullif(p->>'document_id', '')::uuid,
    case when nullif(p->>'document_id', '') is null then 'sem-secao' else 'secao' end,
    coalesce(nullif(p->>'motivo_da_cobertura', ''),
             case when nullif(p->>'document_id', '') is null
                  then 'sem seção atribuída na importação' else '' end),
    nullif(p->>'classificacao', ''),
    nullif(p->>'confianca', '')::numeric
  from jsonb_array_elements(p_paginas) as p;

  perform private.vincular_importacao_ao_documento(
    p_import_id, novo_id, p_brand_id, p_workspace_id, p_pdf_sha256);

  return novo_id;
end;
$$;

/*
 * Server-only: chamada por rota do servidor com a chave de serviço, nunca do
 * navegador. É a disciplina que o CLAUDE.md exige de toda função definer.
 *
 * ─── E `service_role` precisa do grant EXPLÍCITO ─────────────────────────
 *
 * `revoke ... from public` remove o `EXECUTE` implícito de TODO MUNDO,
 * inclusive de `service_role`, que não é superusuário — ele tem `bypassrls`,
 * o que é outra coisa. Sem o grant abaixo a função ficava executável por
 * ninguém: "server-only" virava "nobody-only", e o manifesto nunca poderia
 * ser escrito.
 *
 * Medido antes da correção: `has_function_privilege('service_role', ...)`
 * devolvia **false** para as duas RPCs.
 */
revoke execute on function public.registrar_documento_fonte(
  uuid, uuid, text, text, bigint, integer, text, text, text, jsonb, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.registrar_documento_fonte(
  uuid, uuid, text, text, bigint, integer, text, text, text, jsonb, uuid, uuid)
  to service_role;

/*
 * A única mutação permitida: campos EDITORIAIS.
 *
 * Ela não alcança `storage_path`, `pdf_sha256`, `byte_size` nem `page_count` —
 * e é essa ausência que faz o original ser imutável. Um `update` amplo com boa
 * intenção reabriria a brecha 2.
 */
create function public.editar_documento_fonte(
  p_id     uuid,
  p_titulo text,
  p_idioma text,
  p_estado text,
  p_ator   uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  conta uuid;
begin
  select workspace_id into conta from public.brand_source_documents where id = p_id;
  if conta is null then
    raise exception 'documento-fonte não encontrado' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_members.workspace_id = conta
      and workspace_members.user_id = p_ator
      and workspace_members.role = 'owner'
  ) then
    raise exception 'só quem administra a conta edita o documento-fonte'
      using errcode = '42501';
  end if;

  update public.brand_source_documents
  set titulo = coalesce(p_titulo, titulo),
      idioma = coalesce(p_idioma, idioma),
      estado_de_processamento = coalesce(nullif(p_estado, ''), estado_de_processamento),
      updated_at = now()
  where id = p_id;
end;
$$;

revoke execute on function public.editar_documento_fonte(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.editar_documento_fonte(uuid, text, text, text, uuid)
  to service_role;

-- ─── Os grants, e o que a ausência deles significa ──────────────────────
--
-- Só leitura. Sem `insert`, o manifesto não nasce incompleto; sem `update`, a
-- procedência não é reescrita; sem `delete`, o original não desaparece fora do
-- fluxo durável de remoção da marca.
revoke all on public.brand_source_documents from anon, authenticated;
revoke all on public.brand_source_pages from anon, authenticated;
grant select on public.brand_source_documents to authenticated;
grant select on public.brand_source_pages to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- 5. A página sobrevive à seção — e sem isto ela IMPEDIA a curadoria
-- ════════════════════════════════════════════════════════════════════════
--
-- `document_id` é `on delete set null` de propósito. Mas a constraint de
-- coerência exige `(cobertura='secao') = (document_id is not null)` — então o
-- `set null` produzia linha incoerente, a check recusava, e **o DELETE da
-- seção falhava**.
--
-- O efeito seria o oposto do pretendido: em vez de a página sobreviver à
-- curadoria, a curadoria ficaria impossível. Unir ou remover seção — trabalho
-- central da Etapa 3 — abortaria com erro de constraint.
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

revoke execute on function public.brand_source_pages_soltar_secao()
  from public, anon, authenticated;

create trigger brand_source_pages_soltar_secao
  before update of document_id on public.brand_source_pages
  for each row execute function public.brand_source_pages_soltar_secao();

-- ════════════════════════════════════════════════════════════════════════
-- 6. O log aponta para o estado — com coerência de conta e marca
-- ════════════════════════════════════════════════════════════════════════
--
-- Nullable, e `null` ali é VERDADE e não buraco: importações anteriores a esta
-- migration aconteceram antes de o conceito existir.
--
-- A referência é COMPOSTA (brecha 5): sem isso, o registro de importação de
-- uma marca podia apontar para o documento-fonte de outra.
alter table public.brand_imports
  add column source_document_id uuid;

alter table public.brand_imports
  add constraint brand_imports_source_document_mesma_marca_fkey
  foreign key (source_document_id, brand_id, workspace_id)
  references public.brand_source_documents (id, brand_id, workspace_id)
  /*
   * Coluna NOMEADA — a terceira vez que este defeito aparece nesta migration,
   * e a que passou pela primeira revisão.
   *
   * `on delete set null` sem lista zera TODAS as colunas da chave, incluindo
   * `brand_id` e `workspace_id`, que são `not null`. Medido: apagar o
   * documento-fonte falhava com "null value in column workspace_id of relation
   * brand_imports violates not-null constraint" — e o registro de importação
   * ficava impossível de desvincular.
   *
   * Só `source_document_id` é opcional aqui; as outras duas são a identidade
   * da linha.
   */
  on delete set null (source_document_id);

create index brand_imports_source_document_idx
  on public.brand_imports (source_document_id) where source_document_id is not null;

comment on column public.brand_imports.source_document_id is
  'O documento-fonte que esta importação produziu. Null nas importações '
  'anteriores a 10/09/2026, quando o conceito passou a existir.';
