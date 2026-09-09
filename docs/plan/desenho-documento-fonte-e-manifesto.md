# Desenho — documento-fonte durável e manifesto por página

**Documento para aprovação. Nenhuma migration foi escrita, nenhuma foi
aplicada.** As decisões 1 e 7 do replanejamento (§20.1) exigem que o desenho
seja apresentado antes de existir em SQL. Isto é o desenho.

Base: `58eb1af`. Branch: `fatia-2/documento-fonte`.

---

## 0. Por que esta fatia existe, e por que agora

O pedido de 09/09 foi: *a importação do PDF precisa funcionar respeitando a
identidade visual do PDF e ser plenamente editável no Studio.*

Traduzido para o vocabulário do plano, isso é a §3.1 (camada visual canônica)
mais a §10 (o que "100% editável" significa). As duas dependem da mesma peça:
**o PDF existir como entidade governável, e cada página do PDF existir como
linha.**

A Fatia 1 está parada na Etapa A por dois bloqueios que não são técnicos —
resposta do suporte do Supabase (A.1) e conta de borda (A.2). Esta fatia foi
escolhida porque **não toca no transporte**: ela constrói o substrato que o
visualizador vai consumir quando o transporte for decidido, e que o Studio
precisa mesmo que o visualizador nunca exista.

**Isto não é a Fatia 1 e não altera a ordem vinculante dela.** A regra do
`AGENTS.md` — "nesta abertura não se constrói visualizador, rota intermediária,
nem schema" — vale para a abertura da Fatia 1. Esta é fatia própria, em branch
própria, e a Etapa A continua exatamente onde parou.

---

## 1. Correção ao replanejamento: o PDF **não** é descartado

O §3.1 e o §5.3 descrevem a preservação do PDF como coisa a construir. Fui ler
o código antes de desenhar, e **parte relevante já está construída desde
30/08**. Registrar isso muda o custo desta fatia para menos, e deixar a
descrição errada de pé produziria trabalho duplicado.

O que já existe hoje, na `main`:

| Peça | Onde | Estado |
|---|---|---|
| Bucket privado, só `application/pdf`, teto de 100 MiB | `20260830132402`, `20260901215333` | pronto |
| PDF sobe com a sessão de quem importa — a chave privilegiada não participa | policy `Owners upload brand imports` | pronto |
| Caminho canônico `workspace/import/<sha256>.pdf`, conferido no servidor | `publish_brand_import` | pronto |
| `brand_imports` com `storage_path`, `pdf_sha256`, `page_count`, `report` | `20260830132402` | pronto |
| A publicação recusa registrar procedência se o arquivo não estiver no Storage | `publish_brand_import`, erro `P0002` | pronto |
| Apagar a marca leva o PDF junto, com fila durável de exclusão | `20260830134312`, `20260902004818` | pronto |
| Leitura pelos membros da conta | policy `Members read brand imports` | pronto |

O PDF só é removido **quando a publicação falha** — limpeza de órfão, e ela é
durável (`BrandImporter.tsx:334`, com fila de fallback). No caminho feliz, o
arquivo fica.

**Portanto o §5.3 não precisa de "promover no lugar, sem cópia" como decisão
futura: o arquivo já está no lugar certo, com o caminho certo, e nada precisa
ser copiado.** A pendência 4 da §20.2 pode ser fechada por observação, não por
medição de custo.

## 1.1 O que falta de verdade

Três coisas, e só elas:

1. **`brand_imports` é registro de evento, não entidade durável.** Ele responde
   "esta importação aconteceu"; não responde "qual é o manual vigente desta
   marca". Reimportar cria uma segunda linha sem dizer se é *outra versão do
   mesmo documento* ou *outro documento*. Nada aponta para "o documento-fonte
   desta marca, agora".

2. **Não existe manifesto por página.** A cobertura de páginas vive em
   `brand_documents.source_pages`, que é jsonb de faixas — e ele lista o que as
   seções absorveram, não o que existia. Páginas sem texto extraível são
   excluídas da faixa da própria seção que as contém
   (`src/lib/import/secoes.ts:289`, comentário explícito). Numa marca real isso
   é arte de manual saindo da procedência em silêncio.

3. **Nada lê o PDF de volta.** Não há rota, não há URL assinada, não há tela. O
   arquivo está preservado e inalcançável — que é o estado exato de hoje.

---

## 2. O desenho

Duas tabelas novas. Nenhuma coluna existente muda de tipo, nenhum dado existente
é reescrito.

### 2.1 `brand_source_documents` — o documento-fonte

```
brand_source_documents
  id             uuid  pk
  workspace_id   uuid  not null  → workspaces(id) on delete cascade
  brand_id       uuid  not null
  storage_path   text  not null          -- o mesmo arquivo, no lugar onde já está
  bucket_id      text  not null default 'brand-imports'
  pdf_sha256     text  not null  check ~ '^[0-9a-f]{64}$'
  page_count     integer not null check (> 0)
  byte_size      bigint  not null check (> 0)
  title          text  not null default ''   -- "Manual da marca 2026", editável no Studio
  version        integer not null check (> 0)
  supersedes_id  uuid  null → brand_source_documents(id)
  status         text  not null check in ('active','superseded')
  created_by     uuid  not null → auth.users(id)
  created_at     timestamptz not null default now()

  fk composta (brand_id, workspace_id) → brands(id, workspace_id) on delete cascade
  unique (brand_id, workspace_id, version)
  unique parcial (brand_id, workspace_id) where status = 'active'
```

**Por que tabela nova em vez de acrescentar colunas a `brand_imports`.** As duas
respondem perguntas diferentes, e fundi-las obrigaria uma linha a mentir numa
delas. `brand_imports` é o **log**: aconteceu uma importação, em tal data, por
tal pessoa, com tal relatório de extração — e uma importação que falhou na
metade ainda é um fato que vale registrar. `brand_source_documents` é o
**estado**: este é o manual vigente desta marca. Log não tem "vigente"; estado
não tem "tentativa".

`brand_imports` ganha uma coluna só, `source_document_id`, nullable, apontando
para a linha criada. Importações antigas ficam com `null` — e `null` ali é
verdade, não buraco: elas aconteceram antes de o conceito existir.

**A `unique` parcial é a peça que faz o "vigente" ser verificável pelo banco**, e
não por convenção de código. Duas linhas ativas para a mesma marca passam a ser
impossíveis, não improváveis.

**`bucket_id` com default em vez de constante embutida** porque o nome do bucket
é `brand-imports` — nome de evento para uma coisa que passa a ser documento. O
tradeoff: renomear o bucket é migração de dados sobre objetos do Storage, com
janela de indisponibilidade e caminhos gravados em linhas existentes; carregar
um nome levemente errado numa coluna custa uma linha de comentário. **Fico com o
nome errado e o comentário.** Se o bucket for renomeado um dia, a coluna já
existe para absorver.

### 2.2 `brand_source_pages` — o manifesto

Uma linha para **cada** página, de 1 a N. Se o PDF tem 743 páginas, a tabela tem
743 linhas para esse documento.

```
brand_source_pages
  id                  uuid  pk
  workspace_id        uuid  not null  → workspaces(id) on delete cascade
  brand_id            uuid  not null
  source_document_id  uuid  not null → brand_source_documents(id) on delete cascade
  page_number         integer not null check (> 0)
  width_pt            numeric not null check (> 0)   -- proporção original, §3.1
  height_pt           numeric not null check (> 0)
  rotation            integer not null default 0 check in (0,90,180,270)
  has_text            boolean not null
  char_count          integer not null check (>= 0)
  document_id         uuid  null → brand_documents(id) on delete set null
  coverage            text  not null check in ('secao','sem-secao')
  coverage_reason     text  not null default ''
  classification      text  not null check in ('texto','visual','misto','vazia')
  classifier_score    numeric null
  created_at          timestamptz not null default now()

  fk composta (brand_id, workspace_id) → brands(id, workspace_id) on delete cascade
  unique (source_document_id, page_number)
  check (coverage = 'secao') = (document_id is not null)
  check (coverage = 'sem-secao') → coverage_reason <> ''
```

**Os dois `check` no fim são o coração do desenho.** Eles tornam a ausência
silenciosa impossível de escrever: uma página ou pertence a uma seção — e então
o vínculo existe — ou não pertence, e então **precisa dizer por quê**, em texto,
naquela linha. Não há terceiro estado. Hoje uma página some de uma faixa e não
sobra registro; depois disso, sumir exige preencher um motivo.

**Cobertura completa, verificada na publicação.** A RPC passa a exigir que o
manifesto tenha exatamente `page_count` entradas e que os números formem 1..N
sem furo nem repetição. Um manifesto incompleto derruba a transação inteira,
como já acontece hoje quando o PDF não está no Storage.

**`document_id` com `on delete set null`, não `cascade`.** Apagar uma seção não
pode apagar a página do manifesto — a página continua existindo no PDF. Ela vira
`coverage = 'sem-secao'` com motivo "seção removida em <data>", e a procedência
sobrevive à curadoria. Isto é a regra do `CLAUDE.md` sobre nunca apagar
histórico em silêncio, expressa como constraint.

**`classification` é auxiliar, nunca juíza** (§6 do replanejamento): ela informa
a curadoria e a miniatura, e **não** decide o que é preservado. Todas as páginas
existem independentemente do que o classificador achou.

### 2.3 O que a `source_pages` jsonb existente vira

**Nada. Ela fica onde está, com o conteúdo que tem.** O manifesto passa a ser a
fonte de verdade da cobertura; o jsonb continua servindo o que já serve (citação
da IA, `publish_records_source_pages`). Reescrever aquele campo agora seria
normalizar dado calado, e a regra do projeto proíbe.

Quando o manifesto estiver em produção e o Studio consumindo, a remoção do jsonb
vira dívida mecânica registrada — não parte desta fatia.

---

## 3. O que isto destrava da §10

Com o manifesto, estas operações passam a ser **expressáveis** (a interface é
trabalho da fatia seguinte; o dado deixa de ser o impedimento):

| Operação da §10 | Como o manifesto a sustenta |
|---|---|
| Ver toda página, inclusive as sem texto | a linha existe; a ausência de texto é atributo, não exclusão |
| Reordenar, mudar de capítulo | `document_id` é vínculo, não faixa embutida |
| Substituir uma página | a página tem identidade estável para apontar |
| Corrigir texto extraído | o alvo é uma linha, não um índice dentro de um jsonb |
| Restaurar / voltar ao original | o original é `brand_source_documents` + a página, imutáveis |
| Auditar "de onde veio esta página" | resposta direta, seis meses depois |

**O que isto ainda não destrava, e é honesto dizer:** a representação
**publicada como referência** (§9, decisão 2) continua sendo trabalho da Fatia 7,
e o editor visual nativo (§11) continua sendo a Fatia 10. Esta fatia entrega o
substrato, não a edição.

---

## 4. Tradeoffs e reversibilidade

**O que ganho:** a categoria inteira de erro "material do cliente sumiu em
silêncio" deixa de ser possível de escrever no banco. E o visualizador da
Fatia 1, quando vier, encontra a lista de páginas pronta, com proporção e
rotação — que é exatamente o que ele precisa para virtualizar sem baixar o PDF
inteiro só para saber quantas páginas existem.

**O que perco:** volume. Um manual de 743 páginas passa a escrever 743 linhas na
publicação, dentro da mesma transação. Isso precisa ser medido antes de fechar a
fatia — é a única incógnita de desempenho do desenho, e um `insert ... select`
sobre `jsonb_array_elements` é o caminho, não um laço.

**O que fica mais difícil depois:** mudar o vocabulário de `coverage` ou de
`classification` passa a exigir migração, porque viraram `check` no banco em vez
de convenção. É deliberado — foi a convenção solta que deixou a página sumir.

**Reversibilidade: alta, e esta é a razão de a fatia caber agora.** São duas
tabelas novas mais uma coluna nullable. Reverter é `drop table` das duas e
`drop column` da terceira; nenhum dado existente foi alterado, nenhuma coluna
mudou de tipo, nenhuma linha antiga foi reescrita. **A única parte não trivial
de desfazer é a assinatura da RPC** `publish_brand_import`, que ganha um
parâmetro e portanto precisa do `drop function` + `grant` refeito — o mesmo
procedimento já executado em `20260904144934`, com o mesmo comentário
explicando por quê.

---

## 5. Verificação exigida antes de integrar

Condição 2 do ADR-0003, sem exceção:

1. **Teste de autorização negativo** — a conta A não lê `brand_source_documents`
   nem `brand_source_pages` da conta B. Rodando como `set local role
   authenticated`, nunca como `postgres`: a lição de `20260830134312` é que um
   teste de autorização executado como superusuário não testa autorização.
2. **Teste de cobertura** — publicação com manifesto faltando uma página é
   recusada; com página repetida é recusada; com 1..N completo passa.
3. **Teste da constraint de motivo** — `coverage = 'sem-secao'` sem
   `coverage_reason` é recusado pelo banco, não pelo código.
4. **Teste de sobrevivência à curadoria** — apagar uma seção deixa as páginas
   dela como `sem-secao` com motivo, e não apaga linha nenhuma do manifesto.
5. **Índices** — `(source_document_id, page_number)` pela unique;
   `(brand_id, workspace_id)` para a leitura do Studio;
   `(document_id)` para a navegação seção → páginas.
6. **`npm run verify` verde** na branch, e CI remoto verde no PR.
7. **Histórico de migrations conferido contra o ledger de produção** antes de
   qualquer `db push` — `supabase/RECONCILIACAO.md`, na `fix/migration-history`.

---

## 6. Decisões que precisam da sua palavra

1. **Aprovar as duas tabelas como desenhadas**, ou apontar o que muda.
2. **`title` e `version` já nesta fatia, ou depois?** Eles antecipam
   reimportação e substituição de manual, que é comportamento de produto ainda
   não desenhado. Incluir as colunas agora é barato; usá-las é outra fatia.
   Minha recomendação: **incluir** — acrescentar coluna depois é migração, e
   `version = 1` para todo mundo é verdade.
3. **Confirmar que a pendência 4 da §20.2 está fechada por observação** (§1
   acima) — o arquivo já está no lugar, nada a promover, nada a copiar.
