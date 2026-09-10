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

---

## 7. Revisão de 10/09 — os campos que o plano de produto acrescentou

O plano de 09/09 especificou a Etapa 2 com campos que este desenho não tinha.
Eles entram, e a lista abaixo é a definitiva.

### 7.1 `brand_source_documents` — acréscimos

| Campo | Por que o plano pede |
|---|---|
| `tipo` | um manual não é a única coisa que uma marca envia: haverá anexo, apresentação, guia de aplicação. Sem o campo, o primeiro anexo vira "manual" ou vira tabela nova |
| `idioma` | o manual da GE é em inglês e a interface em português; a extração e a IA precisam saber qual é qual. Já existe em `brands.language`, mas o **documento** pode divergir da marca |
| `estado_de_processamento` | importar, renderizar miniaturas e extrair texto não terminam juntos. Sem estado, a interface não distingue "ainda processando" de "processou e não achou nada" — e essa distinção é a diferença entre paciência e desconfiança |

### 7.2 `brand_source_pages` — acréscimos

| Campo | Por que o plano pede |
|---|---|
| `miniatura` | caminho no Storage. A prévia de importação e a curadoria mostram 743 páginas; sem miniatura, mostram 743 retângulos vazios |
| `estado_de_processamento` | por PÁGINA, e não só por documento: uma página pode falhar sozinha |
| `erro` | quando ela falha, o motivo fica NA LINHA. "Algo deu errado em algum lugar do manual" não é diagnóstico |

E permanecem, deste desenho, os dois que o plano não nomeia e que são a razão
de a tabela existir: **`cobertura` e `motivo_da_cobertura`**. Sem eles a tabela
registra o que sobrou; com eles, a ausência precisa de justificativa escrita.

### 7.3 O que esta fatia NÃO faz, e é decisão de escopo

O plano lista cinco estruturas na Etapa 2. Duas entram agora — as duas
fundacionais. As outras três ficam de fora, com motivo:

| Estrutura | Por que fica de fora |
|---|---|
| `outline_nodes` | o índice do PDF já é extraído e vive em memória na importação. Persistir é útil e não desbloqueia nada agora |
| `navigation_nodes` | navegação curada é a Etapa 3 (prévia e curadoria). Criar a tabela antes da tela que a edita é criar esquema sem consumidor |
| `managed_documents` | é a Etapa 4 (editor gerenciado). Depende da decisão de §9 — representação publicada como referência — que é da Fatia 7 |
| `brand_chunks` | é a Etapa 7 (busca e IA). Já existe recuperação lexical funcionando; trocá-la antes do manifesto estar populado seria mexer nas duas ao mesmo tempo |

**O critério:** entra o que faz a página parar de sumir. O resto entra quando
tiver tela ou consumidor.

---

## 8. Revisão de 10/09 — seis brechas medidas, e as decisões que elas forçaram

A primeira versão desta fatia foi revisada. **Cada afirmação da revisão foi
verificada contra o banco antes de qualquer correção**, e todas se
confirmaram.

| # | Brecha | Estado antes | Fechada por |
|---|---|---|---|
| 1 | página 999 num documento com `page_count = 3` | **aceita** | gatilho `pagina_dentro_do_documento` |
| 2 | owner reescrevia `pdf_sha256`, `storage_path`, `page_count` | **aceito** | sem `grant update`; escrita só por RPC |
| 3 | página da marca B em documento da marca A | **aceita** | FK composta `(source_document_id, brand_id, workspace_id)` |
| 4 | página apontando para seção de outra marca | **aceita** | FK composta contra `brand_documents` |
| 5 | `brand_imports.source_document_id` sem coerência | **aceito** | FK composta |
| 6 | manual e anexo ativos ao mesmo tempo | **recusado, e era errado** | índice único por `(marca, tipo)` |

### 8.1 A unidade de versionamento — decisão registrada

O índice de "uma ativa" era por MARCA, e isso contradizia a própria coluna
`tipo`: a tabela declarava quatro tipos e o esquema permitia um documento
ativo só. Três opções foram consideradas — por tipo, por família documental, e
manual único com anexos livres.

**Escolhido: uma ativa por TIPO.** É o que a coluna já implica, não exige
esquema novo, e a substituição continua tendo significado dentro do tipo. A
alternativa "por família" exigiria decidir o que é família antes de existir
tela que a use; "manual único" trata anexo como cidadão de segunda classe e
não resolve dois anexos com o mesmo papel.

**Reversível:** trocar o índice é uma migration de uma linha; não trava dado.

**Consequência que a prova pegou:** a unicidade de `versao` também precisou
passar a ser por tipo. Com `unique (brand_id, workspace_id, versao)`, um manual
v1 e um anexo v1 colidiam — a decisão dizia uma coisa e o esquema outra.

### 8.2 Escrita só por RPC — e o que isso resolve de uma vez

Duas garantias não são expressáveis linha a linha:

- **completude** — "existem exatamente 1..N, sem furo e sem repetição" é
  propriedade do CONJUNTO; nenhum `check` alcança, porque cada linha é válida
  sozinha;
- **imutabilidade** — campo de procedência que aceita `update` não é
  procedência.

A saída é a mesma para as duas: `authenticated` **só lê**. Documento e
manifesto entram juntos, numa transação, por `registrar_documento_fonte`, que
valida a faixa inteira antes de gravar. Campos editoriais mudam por
`editar_documento_fonte`, que não alcança nenhum campo de procedência.

Exclusão não tem RPC de propósito: acontece pelo `on delete cascade` da marca,
que já passa pela fila durável de remoção de arquivos.

### 8.3 Dois defeitos que a própria prova encontrou

Ambos da mesma família — `on delete set null` colidindo com constraints:

1. **a coerência tornava a curadoria impossível.** `document_id` é `set null`
   para a página sobreviver; mas a check exige
   `(cobertura='secao') = (document_id is not null)`, então o `set null`
   produzia linha incoerente e **o DELETE da seção falhava**. Fechado pelo
   gatilho `soltar_secao`;
2. **`set null` sem lista de colunas zerava as três.** A FK composta zerava
   também `brand_id` e `workspace_id`, que são `not null` — e o DELETE falhava
   de novo, por outro caminho. Fechado com `set null (document_id)`, nomeando
   a coluna. Há precedente no esquema desde 02/09.

### 8.4 A prova, refeita

A versão anterior tratava qualquer erro com "violates" como sucesso. Se a
preparação de um caso falhasse, ele passava **sem alcançar a constraint**. Foi
exatamente o que aconteceu quando a prova ficou estrita: dois casos de marca
cruzada estavam batendo na unicidade de página antes da chave composta — erro
certo pelo motivo errado.

A prova agora: **26 verificações**, cada uma conferindo o NOME EXATO da
constraint ou o SQLSTATE, com mundo próprio (duas contas, duas marcas), dados
isolados por caso, e `rollback` no fim.

## 9. Dívida arquitetural — a publicação em duas transações

**Registrado em 10/09/2026, com o Marco B integrado. Esta é uma decisão
transitória, autorizada como tal, e não o desenho pretendido.**

### 9.1 O que existe hoje

Publicar uma importação são **duas transações que não são atômicas entre si**:

| | Onde roda | Com que autoridade | O que grava |
|---|---|---|---|
| **A** | navegador | sessão, `security invoker` | `brands`, `brand_documents`, `brand_imports` |
| **B** | rota de servidor | `service_role`, `security definer` | `brand_source_documents`, `brand_source_pages` |

A separação não é preguiça: é consequência de duas exigências verdadeiras que
hoje não cabem no mesmo lugar. A transação A precisa da sessão de quem
importa, porque toda RLS de marca e documento se apoia em `auth.uid()`. A
transação B **não pode** rodar com essa sessão, porque completude do manifesto
(`1..N`, sem furo e sem repetição) e imutabilidade dos campos de procedência
não são expressáveis linha a linha — e conceder `insert` direto ao cliente
para depois pedir que ele se comporte seria uma garantia que a interface faz,
não que o banco impõe. Ver §8.2.

### 9.2 O que torna a janela habitável

Cinco coisas, e nenhuma delas fecha a janela — todas a tornam **legível e
recuperável**:

1. **A interface não declara sucesso antes de B.** O importador não navega até
   o registro concluir. Ver `registrar-do-navegador.ts`: um `200` sem
   `documentoId` não conta como sucesso.
2. **`brand_imports.source_document_id is null` é o sinal de publicação
   incompleta**, e ele é visível — no importador e no manual original.
3. **A RPC é idempotente por `sha256`**, então repetir é seguro. Medido:
   repetir devolve o mesmo documento, não cria um segundo, não duplica o
   manifesto.
4. **O pedido de B é derivado, não enviado.** O manifesto vive no relatório da
   transação A, e o servidor o lê de lá. É isso que faz a repetição usar o
   mesmo pedido por construção e a recuperação sobreviver a um recarregamento
   — inclusive de outro aparelho, e por outra pessoa.
5. **O vínculo é escrito por último.** Falhar nele deixa uma publicação
   completa marcada como incompleta, que é o erro seguro dos dois: a próxima
   tentativa fecha o vínculo sem duplicar nada.

O estado intermediário, portanto, não é corrupção: é uma marca legível, com o
manual original servindo normalmente, cujo registro por página está pendente e
declarado.

### 9.3 Por que ainda é dívida

O que as cinco mitigações **não** resolvem:

- **A janela existe.** Entre A e B há um intervalo em que a marca está no ar
  com procedência por página inexistente. Nenhuma quantidade de recuperação
  transforma isso em atomicidade.
- **A conclusão depende de alguém voltar.** Se quem publicou fechar a aba e
  ninguém abrir o manual original, a pendência permanece — visível, mas
  parada. Não há drenagem automática, ao contrário da fila de exclusão de
  objetos órfãos.
- **O manifesto viaja duas vezes.** Ele é gravado no relatório em A e lido de
  novo em B. Numa transação única seria montado uma vez.
- **Dois clientes Supabase numa rota** é superfície a mais para errar. Hoje a
  fronteira está clara — a chave de serviço só executa a RPC, e não tem
  `select` em `brand_documents` de propósito —, mas ela é mantida por
  disciplina e revisão, não pelo tipo.

### 9.4 Para onde migrar

**A publicação inteira deve virar uma transação única no servidor.** Uma rota
que recebe o pedido de importação completo, autentica a sessão, e chama **uma**
RPC `security definer` que grava marca, documentos, importação, documento-fonte
e manifesto — ou nada.

O que essa migração exige, e por isso não foi feita agora:

1. `publish_brand_import` passa a ser chamada pelo servidor, não pelo
   navegador. Ela é `security invoker` e derivaria o ator de `auth.uid()`;
   passaria a receber o ator como parâmetro, como `registrar_documento_fonte`
   já faz — e com ele a mesma verificação de titularidade.
2. O envio dos arquivos ao Storage continua no navegador (é ele que tem os
   bytes), então a ordem "arquivos primeiro, banco depois" não muda. A fila
   de limpeza de órfãos continua sendo a rede de segurança dessa metade.
3. O payload de publicação passa a atravessar a rede até o servidor. Medido em
   1.000 páginas: o manifesto sozinho são **234 KiB**, e os documentos com
   texto integral são maiores — precisa medir contra o limite de corpo de
   pedido da função antes de decidir se cabe numa chamada.
4. A prova SQL cresce: hoje ela prova as constraints do manifesto; passaria a
   precisar provar que **uma falha em qualquer ponto não deixa marca meia
   criada** — o caso que hoje é impossível de ter porque as duas transações
   são separadas de propósito.

### 9.5 Medição de 10/09/2026, em 1.000 páginas

`scripts/medir-manifesto-de-mil-paginas.sh`, no stack local:

| Medida | Valor |
|---|---|
| Páginas no manifesto | 1.000 |
| Payload do manifesto | 239.493 bytes (233,9 KiB) |
| Bytes por página | 239,5 |
| Folga contra 4,5 MB | 18,8× |
| **Duração da transação B** | **36,0 ms** |
| Duração da repetição idempotente | 3,1 ms |
| Páginas gravadas | 1.000 |
| Páginas sem seção (10% sintético) | 100 |
| Documentos-fonte após repetir | 1 |
| Páginas após repetir | 1.000 |
| Relatório com manifesto | 134,1 KiB (vai para TOAST) |

Duas leituras que mudam o planejamento:

- **36 ms não é o gargalo.** A publicação de um manual grande leva minutos, e
  eles estão na renderização das páginas visuais e no envio ao Storage. A
  transação que se temia — mil `insert` mais três verificações de conjunto —
  custa menos que uma requisição de rede. A migração para transação única não
  precisa ser feita por desempenho.
- **A repetição custa 3,1 ms.** O caminho de recuperação é dez vezes mais
  barato que o caminho normal, porque a idempotência sai por `sha256` antes de
  qualquer escrita. Oferecer "tentar de novo" não tem custo que justifique
  hesitar.

### 9.6 Condição de encerramento da dívida

Esta seção sai do documento quando existir **uma** transação de servidor que
grave marca, documentos, importação, documento-fonte e manifesto, com prova SQL
de que uma falha em qualquer ponto não deixa nada gravado. Até então, a §9.2
descreve garantias que não se afrouxam: cada uma tem teste, e nenhuma é
preferência de estilo.
