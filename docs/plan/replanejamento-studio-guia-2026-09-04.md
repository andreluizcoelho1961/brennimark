# Brennimark — replanejamento consolidado

**Documento para revisão. Nada aqui foi construído.**

Esta é a segunda versão deste documento. Ela **incorpora integralmente a
diretriz consolidada de produto, design e implementação** recebida em
04/09, e substitui a primeira versão — que já estava desatualizada em sua
premissa central: a primeira versão ainda discutia *quais páginas do PDF
mereciam virar imagem*. A diretriz consolidada elimina a pergunta:
**todas as páginas são preservadas, e o PDF original é a verdade
visual.**

---

## 0. Estado exato, e as regras que valem enquanto ele durar

### 0.1 Onde o repositório está, agora

| | |
|---|---|
| `HEAD`, ao começar esta rodada | **`5ae917b`** — `docs: replanejamento de Fase 1g, Studio e Guia` |
| Referência da linha de base | **`6986fdb`** — o commit da Fase 1g |
| WIP de rotas | **11 arquivos**, nunca commitados (lista em §0.2) |

**Divergência a registrar, e ela é benigna:** a diretriz consolidada
descreve o estado como "`HEAD` em `6986fdb`, 14 arquivos: 10 modificados
e 4 novos". Isso era exato quando a diretriz foi escrita. Na rodada
anterior, a pedido explícito, a primeira versão deste documento foi
commitada **sozinha** (`5ae917b`, 1 arquivo, sem nada do WIP) — por isso
`HEAD` avançou e o quarto arquivo novo saiu da lista: virou o commit.

Nesta rodada saem mais dois commits isolados (§0.2), e o WIP de rotas
cai para 11 arquivos — **por subtração de duas peças que nunca foram de
rotas**, não por descarte: `alvo-client.tsx` e o teste de `comAlvo`.
Nenhuma linha do WIP de rotas foi commitada, revertida ou sobrescrita em
momento nenhum.

### 0.2 O que sai do WIP nesta rodada, e o que fica

Dois commits isolados, nesta ordem, **nenhum deles tocando a migração de
rotas**:

1. **Este documento**, sozinho, pelo caminho explícito.
2. **A correção do `comAlvo`** — três arquivos: `src/platform/alvo.ts`
   (módulo puro, novo), `src/platform/alvo.test.ts` (novo) e
   `src/platform/alvo-client.tsx` (passa a reexportar). Verificada em
   worktree isolado sobre `HEAD` limpo, com `npm run verify` completo.

**Depois dos dois, o WIP de rotas fica em 11 arquivos** — 9 modificados
e 2 novos:

```
 M src/components/shell/AppShellV2.tsx
 M src/components/shell/CommandPalette.tsx
 M src/components/shell/DesktopSidebar.tsx
 M src/components/shell/documentos.test.ts
 M src/components/shell/navigation.ts
 M src/lib/brandville/selecao.test.ts
 M src/lib/brandville/selecao.ts
 M src/lib/brandville/server.ts
 M src/platform/capabilities.test.ts
?? src/lib/brandville/rotas-antigas.test.ts
?? src/lib/brandville/rotas-antigas.ts
```

Nada nessa lista é commitado, descartado ou sobrescrito. Ela espera a
Fatia 8 (§18), e o que dela for aproveitado será decidido lá, item a
item — não agora (§18.1).

### 0.3 Commits desta rodada, e o CI

| Commit | Conteúdo | CI |
|---|---|---|
| `5ae917b` | primeira versão deste documento | — |
| `249b35b` | este documento com a diretriz consolidada | — |
| `25dbb56` | `comAlvo` extraída para módulo puro (3 arquivos) | **verde** |

CI concluído com sucesso em `25dbb56`
([run 33902004060](https://github.com/andreluizcoelho1961/brennimark/actions/runs/33902004060)).
Antes do commit, a mudança foi verificada em **worktree isolado sobre
`HEAD` limpo**, contendo só os três arquivos: lint, typecheck,
**480/480** unitários, build e **250/250** e2e.

Foi essa verificação isolada que expôs um defeito meu: **o teste que eu
havia escrito para `comAlvo` nunca compilou** — a suíte roda sem
`--jsx`, de propósito, e o teste importava de um `.tsx`. No checkout
principal, misturado ao WIP, teria passado despercebido.

### 0.2 Regras enquanto o WIP estiver parado

1. Nenhum `git checkout`, `restore`, `reset`, `clean` ou equivalente que
   possa apagar trabalho não commitado.
2. Nenhum `git add -A` ou `git add .`.
3. Commit deste documento, se pedido: **somente este arquivo, por nome**.
4. O WIP de rotas não é commitado.
5. Nenhum código de produto antes da aprovação deste replanejamento.
6. **Nenhuma fase é chamada de concluída porque o CI está verde.**

---

## 1. O que foi afirmado, e o que era verdade

Mantido da primeira versão, porque é o registro de por que este
replanejamento existe.

| Afirmei | Era |
|---|---|
| "Fase 1g ✅ concluída" | O código roda; a imagem que ele produz aparece **recortada** numa caixa 4:5, dentro de uma coluna de 5/12 da tela. Nunca foi vista numa importação real. |
| "a correção do `comAlvo` conserta um defeito real hoje" | **Não conserta.** Os 23 chamadores atuais vivem sob `[brandKey]`; os dois parâmetros sempre existem, e nada muda hoje. A correção é **preventiva** (§18.1). |
| Escrevi um teste para `comAlvo` e o dei por feito | Ele **nunca compilou**. A suíte roda sem `--jsx`, de propósito, e o teste importava de um `.tsx`. Só apareceu ao verificar num worktree isolado — no checkout principal, misturado ao WIP, teria passado despercebido (§18.1). |
| "Deploy verificado ao vivo" | Verifiquei que a **tela de login carrega sem erro de console**. Isso não é verificação de funcionalidade nenhuma. |
| "250/250 e2e passando" | Verdade, e irrelevante para o mérito: nenhum desses testes importa um PDF real nem olha uma imagem renderizada. |
| "Limite reconhecido: falta teste com PDF real" | Reconhecido no plano, e mesmo assim marquei a fase como concluída. Reconhecer um limite não é respeitá-lo. |
| Apaguei a GE | Apaguei **o único sujeito de teste existente** antes de haver qualquer medição. A remoção foi pedida; a ordem foi minha e estava errada. |

---

## 2. Norte do produto

O Brennimark deve ser desejado pelas melhores agências de propaganda,
estúdios de design e equipes de branding do mundo. Uma agência de alto
nível precisa reconhecer, ao olhar: respeito absoluto pelo trabalho
criativo, fidelidade visual, governança profissional, controle
editorial, inteligência contextual, segurança, organização, precisão e
qualidade de apresentação.

**Princípio do produto:** o Brennimark não redesenha a identidade do
cliente. Ele **preserva, organiza, governa e torna essa identidade
utilizável**.

**Regra técnica central:** o **PDF original é a verdade visual**. A
**estrutura extraída é a verdade semântica**. Nenhuma substitui a outra.

Essa regra é a espinha de tudo o que segue, e é o que muda o plano
inteiro em relação à versão anterior.

---

## 3. A mudança de arquitetura: duas camadas

### 3.1 Camada visual canônica — o PDF preservado

O PDF original é preservado e apresentado **página por página**, com
visualizador próprio (PDF.js ou equivalente técnico), oferecendo:

carregamento progressivo · virtualização · proporção original · ajuste à
largura · zoom · deslocamento · navegação por página · miniaturas ·
busca · tela cheia · preservação de vetores e tipografia na renderização
· **ausência absoluta de recorte**.

No mobile o manual **não é remontado**: mantém o layout original e
oferece zoom, ajuste e deslocamento.

**Todas as páginas são preservadas.** Nenhuma página deixa de existir
por não ter texto extraível.

### 3.2 Camada semântica — a estrutura extraída

Em paralelo, e sem substituir a visualização, o importador extrai: texto
· índice · títulos · grupos · faixas de páginas · idioma · nomes de
fontes · cores candidatas · imagens e sinais visuais · procedência ·
confiança · conteúdo para busca · trechos para recuperação pela IA ·
estrutura para acessibilidade.

Essa camada serve ao Studio, à busca e ao assistente.

### 3.3 O que isso faz com o que já foi entregue — prestação de contas

A diretriz supera trabalho que eu já commitei. Isso precisa estar
escrito, e não diluído:

| Entregue | Situação sob a nova arquitetura |
|---|---|
| **Fase 1g** — renderizar páginas "visual-dominantes" em PNG, subir ao Storage, exibir via `DocPageEntry.images` | **Superada, não aproveitada.** A pergunta que ela respondia — *quais páginas merecem virar imagem* — deixou de existir. O Guia passa a renderizar o PDF, não PNGs que nós geramos. |
| `renderizarPaginasComoImagem` (`pdf.ts`) | **Sobrevive com outro papel:** gerar **miniaturas** para a prévia de importação, para a curadoria e para o classificador (§6). Deixa de alimentar a leitura no Guia. |
| Migração `20260904160000` (`p_brand_id`, verificação de imagem no Storage) | **Parcialmente ociosa.** O `p_brand_id` vindo do cliente continua correto e útil; a verificação de existência de imagem passa a valer para miniaturas e assets, não para o corpo do manual. Não atrapalha, e não precisa ser revertida. |
| Colunas `title_method` / `title_confidence` | **Sobrevivem inteiras.** São camada semântica, exatamente o que a §3.2 pede. |
| `next.config.ts` com `remotePatterns` | **Sobrevive.** Miniaturas e assets continuam vindo do Storage. |
| Fase 1a — editor de tema, tokens de marca, `BrandCanvas` | **Reescopado.** O tema deixa de pintar o manual importado (o manual agora é o PDF, que já tem a identidade dele) e passa a valer para: páginas nativas criadas no Studio, versões gerenciadas, e o contexto de marca ao redor do documento no Guia. Continua necessário — para menos coisas, e com propósito mais claro. |

**Parecer técnico:** a nova arquitetura é melhor, e por um motivo que não
é estético. A anterior obrigava o produto a *decidir* o que preservar, e
toda decisão desse tipo é uma chance de perder material do cliente em
silêncio. A nova elimina a categoria inteira de erro: não se decide
preservar, preserva-se. O custo é um visualizador de PDF de verdade —
que é trabalho real, e é o maior risco técnico do plano (§19.1).

---

## 4. Fidelidade: o que o Brennimark não pode fazer com o documento

**A moldura do Brennimark termina na borda do documento.**

Dentro do manual importado, o produto **não pode**: reconstruir títulos
com composição própria · transformar texto em caixa-alta · colorir
palavras · introduzir filetes decorativos · reorganizar texto e imagem ·
encaixar páginas em proporções arbitrárias · aplicar `object-cover` ·
substituir a tipografia do manual · alterar fundos · reformatar páginas
como template genérico.

Esses recursos existem para **páginas nativas criadas no Studio** (§11) —
nunca para adulterar o original.

Preservados obrigatoriamente: layout, diagramação, cores, tipografia,
fotografias, vetores, diagramas, ilustrações, proporção, margens,
alinhamentos, hierarquia, sequência e as demais características visuais
do documento.

---

## 5. Manifesto por página

`sourcePageRanges` **não prova preservação** — ele lista o que as seções
absorveram, não o que existia. Hoje, uma página sem texto é excluída do
intervalo da própria seção que a contém (`secoes.ts:289`), e a prévia
ainda diz ao usuário que "provavelmente são imagens" e "não viram
seção". O produto identifica corretamente que aquilo é arte e usa a
conclusão para descartar.

**Toda importação passa a produzir um manifesto com uma entrada para
CADA página do PDF, de 1 a N.** Se o PDF tem 743 páginas, o manifesto tem
743 entradas. Uma ausência passa a ser impossível de esconder: ela
precisa de tratamento e de motivo.

### 5.1 Campos

| Campo | Por que existe |
|---|---|
| `pagina` | a chave; sem ela não há cobertura verificável |
| `secao` | liga a página ao conteúdo publicado (ou registra "nenhuma", explicitamente) |
| `largura`, `altura` | dimensões originais; sem elas o visualizador erra a proporção |
| `rotacao` | páginas horizontais e verticais no mesmo manual são comuns |
| `tem_texto_extraivel` | separa "sem texto" de "em branco" — a distinção que hoje não existe |
| `tratamento_visual` | como a página é representada visualmente |
| `tratamento_semantico` | o que foi extraído dela |
| `classificacao_proposta` | o palpite do classificador (§6) |
| `confianca` | 0–1; torna o limiar auditável página a página |
| `estado_processamento` | pendente · ok · falhou |
| `estado_upload` | quando aplicável (miniatura, asset derivado) |
| `motivo_falha` | falha sem motivo é falha sem responsável |
| `motivo_exclusao` | idem, e obrigatório para `excluded` |

**Dois eixos de tratamento, de propósito.** Sob a arquitetura de duas
camadas, "o que a página é visualmente" e "o que se conseguiu extrair
dela" deixaram de ser a mesma pergunta: uma página pode ser
perfeitamente preservada visualmente e não render texto nenhum. Um campo
só não expressaria isso sem mentir.

### 5.2 Vocabulário

`text` · `facsimile` · `mixed` · `blank` · `failed` · `excluded`

- **`blank`** — sem texto **e** sem arte. Página sem texto **não é**
  página em branco.
- **`failed`** — o processamento não completou. É estado, não descarte:
  aparece como pendência e pode ser repetido.
- **`excluded`** — só com **decisão explícita e justificável** de uma
  pessoa. É dívida visível, nunca efeito colateral.

A métrica "páginas preservadas" vem **deste manifesto**, não dos
intervalos das seções.

**Decisão de esquema: APROVADA (04/09) — tabela própria, uma linha por
página.** Não JSON dentro do relatório. A cobertura precisa ser apurável
por consulta (§21 exige número apurado, não estimado), e um documento
JSON de 743 entradas obriga a aplicação a ler tudo para responder
"quantas ficaram de fora". Tabela responde com uma contagem e permite
indexar por tratamento.

**A tabela não é criada na Fatia 0.** A Fatia 0 entrega o **contrato** do
manifesto — campos, vocabulário, invariantes, e como cada métrica sai
dele. A migração e o preenchimento são da Fatia 2 (§18). Nenhum esquema
é aplicado antes disso.

A entrada do manifesto referencia o **documento-fonte** (§5.3), não a
importação: uma marca pode ter várias edições ao longo do tempo, cada
uma com o seu próprio conjunto de páginas.

### 5.3 O PDF é documento-fonte durável, não resíduo de importação

Hoje o PDF vive em `brand-imports`, um bucket cujo nome e cujo ciclo de
vida dizem "artefato de processo": há fila de limpeza para importação
abandonada, e a exclusão da marca o enfileira para remoção. Isso está
correto para um resíduo, e **errado para a verdade visual permanente do
manual**.

**Decisão aprovada:** o PDF passa a ser **documento-fonte durável e
versionado**. O desenho de esquema segue abaixo — **para revisão, não
para implementar agora**.

#### Entidade `brand_source_documents` (desenho)

| Campo | Papel |
|---|---|
| `id` | identidade da edição |
| `brand_id` | a marca dona |
| `versao` | inteiro monotônico por marca — ordena as edições sem depender de data |
| `rotulo` | nome humano: "Manual principal 2024", "Guia regional LATAM" |
| `tipo` | `principal` · `atualizacao` · `regional` · `campanha` · `complemento` |
| `storage_path` | o arquivo original, por identificadores imutáveis |
| `sha256` | impressão digital do arquivo |
| `total_de_paginas` | contagem canônica; é o denominador de toda métrica de cobertura |
| `idioma` | idioma do documento, não da interface |
| `importado_em` | data |
| `importado_por` | responsável |
| `estado` | `processando` · `ativa` · `arquivada` · `falhou` |
| `import_id` | a importação que o originou (procedência) |

O manifesto (§5.1) ganha `source_document_id`, e é por aí que "páginas
preservadas" passa a ser sempre relativa a **uma edição**, não à marca
inteira.

#### Qual edição está ativa — duas formas, uma recomendação

| Forma | A favor | Contra |
|---|---|---|
| **Índice único parcial** (`ativa = true`, único por marca) | sem ciclo de referência; a invariante "no máximo uma ativa" fica no banco | exige o índice parcial correto, que é fácil de esquecer |
| Ponteiro em `brands.source_document_id` | leitura direta, uma junção a menos | referência circular entre `brands` e `brand_source_documents`, que complica criação e exclusão |

**Recomendo o índice único parcial.** A referência circular custa mais
do que a junção que ela economiza, e a invariante fica onde não depende
de ninguém lembrar.

**O piloto pode exibir uma só fonte ativa. O modelo não deve impedir
várias** — é a diferença entre uma decisão de interface e uma decisão de
dado, e só a segunda é cara de desfazer.

#### O bucket, e o que fazer com ele

Três opções, com recomendação:

1. **Mover o arquivo para um bucket durável no momento da publicação.**
   Semântica limpa; custa uma cópia de dezenas a centenas de MB por
   marca, com risco de falha parcial no meio.
2. **Renomear/segregar buckets por ciclo de vida.** Exige migrar o que
   já existe.
3. **Promover no lugar (recomendado).** O objeto fica onde está — o
   caminho já usa só identificadores imutáveis (`workspaceId/importId/<hash>.pdf`),
   que é a regra da casa e continua válida. O que muda é a
   **semântica**: ao publicar, o arquivo passa a ser referenciado por
   `brand_source_documents` e sai do alcance da limpeza de importação
   abandonada. Sem cópia, sem migração de arquivo, sem janela de falha.

Em qualquer das três, a distinção que precisa existir é a de **ciclo de
vida**: importação que falhou é resíduo e se limpa; importação que
publicou virou documento-fonte e só é removida com a marca.

---

## 5.4 Cinco estruturas, cinco granularidades

A medição da Fatia 0 (§18.2) produziu 500 seções, 354 delas de uma
página só. **Isso não se corrige ajustando a profundidade do outline nem
o teto de seções** — os dois seriam remendos sobre a causa real.

**A causa é que `brand_documents` é hoje cinco coisas ao mesmo tempo:** a
unidade de navegação do Guia, o recipiente das páginas de origem, a
unidade editável, a unidade de publicação e a base do que a IA recupera.
Quando uma tabela só carrega cinco papéis, a granularidade de um deles
impõe a granularidade de todos — e foi exatamente o que aconteceu: o
índice do PDF é fino (quase um marcador por página), então a navegação
virou fina, então a unidade editável virou fina, então tudo virou fino.

**O erro da Fase 1e, dito com precisão:** ela não foi "profunda demais".
Ela **achatou uma árvore numa lista**. `fronteirasDoOutline` pega uma
hierarquia e devolve fronteiras planas; usar mais níveis só fez a lista
plana ficar maior. A hierarquia — a informação que diria "estes 14
marcadores são filhos de *Basic Standards*" — é descartada na conversão,
e depois não há como recuperá-la sem reimportar.

As cinco estruturas, separadas:

| Estrutura | O que é | Granularidade típica na GE |
|---|---|---|
| **`source_pages`** | as páginas físicas do documento-fonte | **743** — uma por página, sempre |
| **`outline_nodes`** | a árvore declarada pelo PDF, **preservada com hierarquia** | centenas a milhares de nós, em vários níveis |
| **`navigation_nodes`** | a navegação editorial **curada** e publicada no Guia | dezenas — capítulos e seções que uma pessoa aprovou |
| **`managed_documents`** | conteúdos editáveis, nativos ou reconstruídos | tantos quantos a agência criar; pode ser zero |
| **`brand_chunks`** | fragmentos técnicos para recuperação pela IA | milhares, menores que qualquer seção |

**Elas se relacionam sem precisar coincidir:**

- `source_pages` pertence a um `brand_source_document` (§5.3) e é a
  única estrutura obrigatoriamente completa: 1 a N, sem lacuna. É o
  manifesto da §5 — o manifesto **é** `source_pages`.
- `outline_nodes` aponta para `source_pages` (a página de destino) e
  para o próprio pai. **Preservar a árvore é o ponto**: com ela gravada,
  mudar a profundidade que a navegação usa vira uma decisão de curadoria,
  não uma reimportação.
- `navigation_nodes` é uma árvore **curada**. Pode nascer semeada do
  outline, e a partir daí é editorial: renomear, fundir, reordenar,
  esconder. Aponta para faixas de `source_pages` e/ou para
  `managed_documents`.
- `managed_documents` referencia as `source_pages` que substitui ou
  reconstrói (§9, §10). Não precisa existir para uma marca funcionar —
  um manual pode ser 100% original.
- `brand_chunks` referencia `source_pages` pelo número, que é o que dá à
  citação da IA um destino clicável no visualizador (§19.4).

**O que isso resolve, concretamente:** o índice da GE pode continuar tão
fino quanto ele é — a árvore inteira fica gravada em `outline_nodes`,
sem perda — enquanto a navegação do Guia mostra as dezenas de entradas
que fazem sentido editorialmente, e a IA recupera fragmentos ainda
menores que qualquer uma delas. Nenhuma das três precisa concordar com
as outras, e é por isso que nenhuma precisa ser um meio-termo ruim.

**A regra que substitui o ajuste de parâmetro:** a árvore do PDF é
**preservada inteira** em `outline_nodes`, sem poda, sem teto, sem
escolha de profundidade na importação. **A navegação publicada é uma
projeção curada dessa árvore** — uma vista, não uma cópia, e não a
própria árvore renomeada. Projetar é uma operação de curadoria
(escolher até que nível mostrar, fundir irmãos curtos, renomear,
esconder, reordenar), reversível a qualquer momento porque o original
nunca foi tocado.

**Não escolho aqui novo limite nem nova profundidade** — e, com a
projeção no lugar, deixa de existir um número certo a escolher no
código. "Qual profundidade vira navegação" para de ser constante e vira
decisão por marca, revisável, com o índice completo atrás dela. O teto de
500 perde a função que tinha: ele existia para impedir que uma lista
plana explodisse, e não haverá mais lista plana.

**Isto é desenho, não implementação.** O esquema concreto das cinco
estruturas entra junto com o de `brand_source_documents` (§5.3), para
revisão, antes de qualquer migração.

---

## 6. Classificação visual — auxiliar, nunca juíza

**O classificador deixa de decidir quais páginas sobrevivem. Todas
sobrevivem.** Ele passa a servir para: gerar miniaturas, destacar
páginas visuais, sugerir estrutura, orientar futura reconstrução nativa,
e identificar páginas importantes.

A classificação é **por página**, combinando: geometria e cobertura do
texto · thumbnail renderizado · distribuição e variação de pixels ·
áreas de cor · proporção de área sem texto · imagens rasterizadas ·
vetores · preenchimentos · diagramas · sinais da lista de operações.

**O `operatorList` ajuda e não decide.** Um operador de imagem pode estar
sob máscara, recortado por *clipping path*, transformado a 2% do
tamanho, ou desenhado com transparência total. Um preenchimento de
página inteira pode ser coberto por um retângulo branco na operação
seguinte. Contar operações é contar intenções declaradas; o raster
renderizado é o que a pessoa vê, depois de todas as transformações — e
por isso é a referência primária.

Limiares calibrados com documentos reais (§17), registrados com o número
que os justificou, e permanentemente revisáveis.

---

## 7. Prévia da importação — superfície de revisão

A prévia deixa de ser confirmação.

**Mostra:** total de páginas · páginas preservadas · páginas em branco ·
páginas com falha · seções encontradas · títulos genéricos · origem dos
títulos · confiança · thumbnails · classificação de cada página · quais
páginas têm texto extraído · identidade visual sugerida · falhas de
processamento ou upload.

**Permite:** renomear seções · dividir e unir · mover páginas · corrigir
classificações · escolher títulos · revisar cores sugeridas · revisar
fontes detectadas · repetir páginas com falha · impedir publicação
incompleta · publicar com pendências **somente após confirmação
explícita**.

**Nenhuma falha visual pode virar omissão silenciosa.**

---

## 8. Identidade da marca

Nenhuma marca continua nascendo silenciosamente com o cinza do
Brennimark.

O importador **sugere**: cores predominantes · possíveis cores
institucionais · cores neutras · nomes de fontes · orientação de
contraste · **as páginas de onde cada sugestão foi extraída**. São
candidatos; a pessoa confirma, corrige ou rejeita.

### 8.1 Fontes — detectar não é poder usar

Detectar o nome de uma fonte **não autoriza** extrair, hospedar ou
redistribuir o arquivo incorporado ao PDF. A fonte embutida está sob
licença de incorporação em documento, que não cobre uso como webfont de
uma plataforma. Tecnicamente é possível — por isso precisa estar escrito
que não se faz.

Cinco estados distintos, visíveis na interface:

| Estado | Significa |
|---|---|
| **detectada** | o nome foi lido do PDF; é informação sobre a marca |
| **disponível no sistema** | existe uma fonte equivalente já licenciada para uso |
| **enviada pela agência** | arquivo recebido, aguardando validação |
| **licenciada e ativa** | aplicada de fato no Guia |
| **fallback temporário** | substituta em uso, com o nome original visível ao lado |

Uma marca com identidade não confirmada **permanece com pendência
visível no Studio e não pode ser apresentada como "pronta para o
cliente"**.

---

## 9. Original, versão gerenciada, versão publicada

Cada página distingue três representações:

| | O que é | Regras |
|---|---|---|
| **Original** | a página exata do PDF | imutável · preservada · nunca sobrescrita · base de comparação e auditoria |
| **Gerenciada** | a versão trabalhada pela agência | editável · versionada · pode ser estruturada, substituída ou reconstruída · **nunca destrói o original** |
| **Publicada** | o que o Guia apresenta hoje | pode ser o original, uma versão gerenciada, ou uma página nativa |

O Studio permite **comparar as três** (Original · Em edição ·
Publicada). Toda alteração gera histórico e permite restauração.

**Decisão de esquema: APROVADA (04/09) — a representação publicada é uma
referência explícita** a original, gerenciada ou nativa. Não é cópia:
cópia obriga duas fontes a concordarem para sempre, e elas divergem.

Já existe `brand_document_versions` (histórico e recuperação de página
excluída), e ele não expressa isso — expressa histórico linear, não "qual
das três está no ar". O desenho concreto (coluna de referência + tipo da
representação apontada, ou tabela de publicação) é trabalho da Fatia 7,
e será apresentado antes de aplicado, como o de `brand_source_documents`
(§5.3).

**Uma consequência que precisa estar dita:** com a publicada sendo
referência, "voltar ao original" é **repontar**, não restaurar conteúdo.
Isso é o que torna a operação instantânea, sem risco de perder a versão
gerenciada — ela continua lá, só não está publicada.

---

## 10. O que "100% editável" significa

O objetivo é a agência poder alterar **100% do que publica**. Isso **não
é** a promessa de converter qualquer PDF em objetos editáveis perfeitos:
PDFs contêm texto em curvas, imagens achatadas, transparências fundidas,
elementos sem semântica, fontes sem licença e páginas inteiramente
rasterizadas.

**O requisito é de governança:** tudo que entra pode ser governado,
atualizado, substituído, reconstruído, versionado e republicado pelo
Studio, **sem perder o original**.

Na primeira versão vendável, toda página precisa poder: ser substituída
integralmente · ser removida · ser reordenada · mudar de capítulo · ter
título e metadados editados · ter texto extraído corrigido · receber
assets · receber uma versão gerenciada · ser restaurada · voltar a usar
o original · ser criada nativamente.

---

## 11. Editor visual nativo

Fase própria no roadmap (Fatia 10). Capacidades desejadas: canvas com
dimensões livres · páginas com proporção configurável · texto · estilos
tipográficos · imagens · vetores · formas · fundos · camadas ·
alinhamento · grids · guias · margens · componentes reutilizáveis ·
páginas-mestre · bloqueio e agrupamento · comparação com o original ·
importação progressiva de objetos recuperáveis do PDF · reconstrução
manual do que não for recuperável.

**Não é um "Figma genérico".** É especializado em governança e
manutenção de identidade.

**Parecer técnico:** esta é a maior peça de produto do documento inteiro
— ordem de grandeza de meses, não de semanas, e com risco de
descaracterizar o foco se começar cedo demais. Começar por **substituir
e criar páginas** (que já entrega o essencial da §10) e evoluir para
objetos, camadas e tipografia depois é a única sequência que não
transforma o roadmap inteiro num editor gráfico.

---

## 12. Studio e Guia

### 12.1 Guia — "o que a marca determina, e como aplico?"

**Contém:** manual (visualização canônica) · navegação editorial · busca
· assets autorizados **para consulta e download** · assistente
unificado.

**Não contém:** importação · edição · curadoria · upload · remoção de
assets · configuração de IA · gestão de equipe · configurações da conta.

**O Guia não muda de estrutura porque quem olha é owner.** Um owner que
quer administrar vai ao Studio.

```
/g/<conta>/<marca>              o manual
/g/<conta>/<marca>/<pagina>     uma página
/g/<conta>/<marca>/assets       acervo: consultar e baixar
                                busca e assistente: em qualquer lugar
```

### 12.2 Studio — "em que estado está o trabalho?"

**Contém:** portfólio · importação · painel de estado da marca ·
curadoria · identidade visual · editor · assets · equipe · permissões ·
conexões de IA · uso e orçamento · histórico · publicação.

```
/studio                              portfólio
/studio/<conta>/importar             importar
/studio/<conta>/<marca>              painel de estado
/studio/<conta>/<marca>/curadoria    fila de trabalho
/studio/<conta>/<marca>/identidade   cor, tipografia, logo
/studio/<conta>/<marca>/editor       editor visual (Fatia 10)
/studio/<conta>/<marca>/assets       gestão do acervo
/studio/<conta>/equipe               pessoas e papéis
/studio/<conta>/ia                   provedores, uso, orçamento
```

**O Studio não é o mesmo `AppShellV2` com outro menu.** Compartilha
componentes e tokens; tem **hierarquia operacional própria** — portfólio
→ marca → frente de trabalho —, um nível que o Guia não tem.

**O manual é um só.** O Studio não renderiza uma segunda cópia: ao
precisar ver a página como ela é, manda para o Guia. Duas telas que
precisam concordar para sempre divergem.

---

## 13. Identidade visual do Brennimark

Etapa obrigatória **antes** de implementar Studio e Guia (Fatia 5).

**Dezesseis entregáveis:** semantic board · moodboard · princípios
visuais · tipografia do produto · paleta da plataforma · sistema de
superfícies · raios · espaçamento · iconografia · comportamento de cards
· estados · movimento e transições · **dois conceitos visuais
concorrentes** · protótipos de alta fidelidade · desktop e mobile ·
**teste com quatro marcas visualmente opostas**.

**Princípios:** Brennimark reconhecível como produto · plataforma premium
· precisão · calma · **neutralidade ativa** · marca do cliente sempre
soberana · moldura presente sem disputar atenção · **ausência de herança
visual de Hairline, Bootstrap ou releases anteriores**.

Referências como Refero orientam pesquisa; não são copiadas.

**Neutralidade ativa é o conceito central, e é o que hoje falta.** O
produto lê "neutro" como cinza e caixa. Neutro em relação ao conteúdo
hospedado não significa sem desenho: significa carácter próprio expresso
em espaçamento, tipografia de interface, densidade e precisão de
estados — nunca disputando cor com a marca do cliente.

O teste das quatro marcas opostas reaproveita infraestrutura existente
(fixtures de marcas opostas e o teste de moldura universal já em uso).

---

## 14. Papéis e permissões

### 14.1 Os três papéis

| Papel | Escopo |
|---|---|
| **Owner** | controla a conta · gerencia equipe · configura IA · controla orçamento · administra todas as marcas · aprova · publica · exclui marcas |
| **Editor** | entra no Studio · importa · edita · reconstrói páginas · gerencia identidade · gerencia assets · executa curadoria · **publica e aprova nesta fase** · não acessa credenciais, faturamento ou gestão de equipe · não exclui conta nem marca |
| **Member** | acessa o Guia · consulta · baixa assets autorizados · usa o assistente quando contratado · **não acessa o Studio** |

### 14.2 `editor` aprova — decisão registrada

**Decisão explícita do piloto: nesta fase o `editor` também aprova.** Se
clientes exigirem separação entre produção e aprovação, um papel
`reviewer`/`approver` será criado depois.

Registro honesto: **eu havia recomendado o contrário** — negar `aprovar`
ao `editor`, pelo argumento de reversibilidade (ampliar depois é
indolor; retirar depois é regressão). A decisão foi tomada em sentido
oposto, e a aceito: o gargalo de exigir um owner para cada publicação é
concreto e imediato num piloto, enquanto o risco que eu apontava é
hipotético. **O caminho de saída continua aberto sem regressão**, desde
que a separação futura seja introduzida como *papel novo* (produção sem
aprovação) para quem precisar dela — não retirando `aprovar` de quem já
o tem.

### 14.3 O trabalho real

Não termina ao adicionar `editor` no banco. **Toda política RLS, função
privilegiada, API e rota precisa ser auditada individualmente** contra a
matriz — uma a uma, não por varredura.

**Testes obrigatórios:** owner · editor · member · usuário externo ·
duas contas · duas marcas · tentativa de acesso cruzado · tentativa de
ação destrutiva · configuração de IA e orçamento · **acesso direto por
URL**.

**Parecer técnico:** este é o item de maior risco de segurança do plano.
Um `editor` que alcança a exclusão de marca, ou um `member` que abre
qualquer rota de Studio, é falha de segurança — não defeito de
navegação. Nenhuma fatia posterior deve começar com esta em aberto.

---

## 15. Assistente unificado

**Um botão · um painel · uma conversa · um compositor · anexos ·
histórico contextual à marca.**

Três intenções: **consultar a marca** · **analisar uma peça** · **gerar
ou aperfeiçoar um prompt**. O histórico **é a conversa**, não um quarto
modo — contá-lo como modo repetiria o erro que transformou chat, análise
e histórico em três rotas.

**Regras:** contextual à marca ativa · trocar de marca fecha o painel ·
conversa de uma marca não aparece em outra · anexar imagem muda a
intenção automaticamente · pedir um prompt é linguagem natural · toda
resposta relevante apresenta procedência · citações incluem documento,
status e páginas · ausência de evidência gera recusa honesta · falta de
provedor gera mensagem de produto · **nunca mostrar erro técnico** ·
configuração de modelo, provedor e orçamento fica no Studio · **usuário
comum não escolhe o motor da IA**.

Com a arquitetura de duas camadas, a citação ganha um destino real: ela
aponta para **a página do documento canônico**, e o visualizador abre
nela.

---

## 16. Wireframes

Baixa fidelidade de propósito — decidem hierarquia, não estética. A
estética é a Fatia 5 (§13).

### 16.1 Guia — leitura canônica

```
┌────────────────────────────────────────────────────────────────────┐
│ GE ▾                                        ⌘K Buscar        ◍     │
├────────┬───────────────────────────────────────────────────────────┤
│ ▤ ▤ ▤ │  ┌─────────────────────────────────────────────────┐      │
│ ▤ ▤ ▤ │  │                                                 │      │
│ ▤ ▤ ▤ │  │      página 41 do PDF, como ela é               │      │
│ ▤ ▤ ▤ │  │      proporção original, sem recorte            │      │
│ ▤ ▤ ▤ │  │      vetores e tipografia preservados           │      │
│ ▤ ▤ ▤ │  │                                                 │      │
│ ▤ ▤ ▤ │  └─────────────────────────────────────────────────┘      │
│        │                                                           │
│ mini-  │   ‹  41 / 743  ›      − ▭ +      ⤢        ┌────────────┐  │
│ aturas │   navegação           zoom     tela cheia │ ✦ Perguntar│  │
└────────┴───────────────────────────────────────────┴────────────┴──┘
```

A coluna é de **miniaturas do documento**, não de títulos inventados. A
navegação editorial (índice, grupos, seções) vem da camada semântica e
convive com ela — mas quem manda na tela é o documento.

### 16.2 Studio — portfólio

```
┌────────────────────────────────────────────────────────────────────┐
│ Brennimark · Studio        Agência Norte ▾      Importar     ◍ ana │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌──────────────────────────┐        │
│  │ GE                       │  │ Padaria do Bairro        │        │
│  │ 743 págs · 122 seções    │  │ 24 págs · 18 seções      │        │
│  │ ████████░░░░░░░  46%     │  │ ███████████████ 100%     │        │
│  │ ⚠ identidade não definida│  │ ✓ identidade definida    │        │
│  │ ⚠ 68 títulos genéricos   │  │ ✓ 24/24 páginas          │        │
│  │ ✓ 743/743 páginas        │  │ Guia ativo · 3 pessoas   │        │
│  └──────────────────────────┘  └──────────────────────────┘        │
│  ┌──────────────────────────┐                                      │
│  │  +  Importar um manual   │                                      │
│  └──────────────────────────┘                                      │
└────────────────────────────────────────────────────────────────────┘
```

"743/743 páginas" sai do manifesto (§5) — é a preservação virando
informação de produto.

### 16.3 Studio — a marca, com as três representações

```
┌────────────────────────────────────────────────────────────────────┐
│ Studio › GE › página 41                        Ver no Guia ↗   ◍   │
├──────────────┬─────────────────────────────────────────────────────┤
│ GE           │  ORIGINAL        EM EDIÇÃO        PUBLICADA         │
│  Painel      │  ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│  Curadoria   │  │          │    │          │    │          │       │
│  Identidade  │  │  pág 41  │    │  pág 41  │    │  = orig. │       │
│  Editor      │  │  do PDF  │    │ revisada │    │          │       │
│  Assets      │  │ imutável │    │ rascunho │    │          │       │
│              │  └──────────┘    └──────────┘    └──────────┘       │
│ ───────────  │                  [ Publicar ]   [ Voltar ao orig. ] │
│ Portfólio    │                                                     │
│ Equipe       │  HISTÓRICO                                          │
│ Provedores   │  04/09 14:22 ana · texto corrigido      [restaurar] │
│              │  04/09 09:10 importação · original                  │
└──────────────┴─────────────────────────────────────────────────────┘
```

Esta tela é a §9 e a §10 em concreto, e **não existe no Guia**.

### 16.4 Prévia da importação

```
┌────────────────────────────────────────────────────────────────────┐
│ Importar · GE_ID000.pdf · 743 páginas                              │
├────────────────────────────────────────────────────────────────────┤
│ 743 preservadas · 0 em branco · 2 com falha · 122 seções           │
│ Identidade sugerida: ■ #E1251B  ■ #000000  ■ #FFFFFF   [revisar]   │
│ Fontes detectadas: Helvetica Neue LT Pro  (detectada)  [revisar]   │
├────────────────────────────────────────────────────────────────────┤
│ ▾ Basic Standards                       págs 9–16 · índice ✓       │
│   ▤9  ▤10  ▤11  ▤12  ▤13  ▤14  ▤15  ▤16                            │
│   ▲visual ▲visual  ▲texto ▲texto ▲texto ▲texto ▲texto ▲misto       │
│                                                    [corrigir]      │
│ ▾ Páginas 17–24                         págs 17–24 · intervalo ⚠   │
│   sem título no índice do PDF — revisar na curadoria               │
│   ▤17 ▲visual   ▤18 ✗falhou [repetir]   ▤19 ▲texto  …              │
├────────────────────────────────────────────────────────────────────┤
│ ⚠ 2 páginas com falha. Publicar assim exige confirmação.           │
│                          [ Criar a marca com estes rascunhos ]     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 17. Protocolo de testes

### 17.1 Sujeitos

- **PDF real da GE** — **teste manual local apenas**. Depende de você
  fornecer o arquivo: a plataforma não o guarda mais.
- **Fixture sintética versionada** — no repositório, e é ela que sustenta
  **todo o teste automatizado**.
- **Ao menos três outros manuais ou fixtures visualmente opostos.**

**Decisão aprovada (04/09): material real da GE não entra no Git sem
autorização expressa.** A fixture automatizada é sintética; o PDF real
serve exclusivamente ao teste manual local. Isso tem uma consequência de
projeto que vale explicitar: **a fixture sintética precisa ser boa o
bastante para o CI provar regressão sozinho**, porque o sujeito real não
estará disponível na integração contínua. Se um defeito só aparece com o
manual da GE, ele não está coberto — e isso passa a ser declarado, não
suposto.

O projeto já tem gerador de fixture de PDF (`npm run fixtures:pdf`,
`scripts/gerar-fixtures-pdf.py`); a fixture da Fatia 0 estende esse
caminho em vez de inventar outro.

**Achado ao verificar o `comAlvo` em worktree limpo:** o padrão da casa
é **script versionado + binário pequeno versionado**, e só as fixtures
grandes ficam de fora. `e2e/fixtures/*.pdf` está no git (sete arquivos),
enquanto `mil-paginas.pdf` e `mil-e-uma-paginas.pdf` estão no
`.gitignore` — por isso quatro testes de escala falharam num checkout
novo até eu rodar o gerador.

Para a decisão 5 isso resolve bem: a fixture sintética (§18.2.7) é
**inteiramente construída por código**, sem nenhum material de terceiro,
então versioná-la junto das outras não conflita com a licença — e o CI
não depende de gerar nada antes de rodar. As fixtures grandes continuam
geradas, pelo tamanho.

**Segundo achado, que decide COMO estender:** o gerador
(`scripts/gerar-fixtures-pdf.py`, 179 linhas) escreve **bytes de PDF à
mão, sem biblioteca nenhuma** — importa apenas `pathlib` e `sys`. É
escolha deliberada, e boa: o CI não instala dependência de Python para
gerar fixture. Já cobre hoje: texto, **página sem texto**
(`sem-texto.pdf`), cabeçalho repetido, índice/outline, corrompido,
protegido por senha, mil páginas, e "não é PDF".

Falta, e é o que a Fatia 0 acrescenta: **página horizontal**,
**fotografia** (imagem rasterizada), **imagem achatada**, **vetor**,
**diagrama**, e **tipografia convertida em curvas**.

**Recomendação: manter o zero-dependência.** É mais trabalho do que usar
uma biblioteca, e evita instalar cadeia de dependências no CI só para
gerar fixture. Tecnicamente é viável sem nenhuma: imagem entra como
fluxo RGB embutido (não precisa nem de compressão); vetor e diagrama são
operadores de traçado e preenchimento; e **"tipografia em curvas" é, na
prática, mais simples do que texto** — são caminhos preenchidos, sem
fonte embutida nenhuma. A alternativa (adotar uma biblioteca de geração
de PDF) fica registrada como opção caso a fidelidade da fotografia
sintética se mostre insuficiente para calibrar o classificador.

A fixture sintética deve conter: abertura em cor sólida · fotografia ·
diagrama · texto corrido · **página sem texto extraível** · página
horizontal · página vertical · **tipografia convertida em curvas** ·
imagem achatada · índice em múltiplos níveis.

### 17.2 Linha de base

Medir o comportamento anterior a partir de uma **referência de git
separada criada em `6986fdb`** — nunca do checkout principal, que tem os
13 arquivos de WIP, e nunca com comando destrutivo.

**Ressalva:** `6986fdb` não produz manifesto. As métricas de cobertura
no "antes" são **reconstruídas** a partir de `sourcePageRanges`,
`ignoradas` e o total de páginas — e serão apresentadas como
reconstrução, não como se os dois lados tivessem sido medidos pelo mesmo
instrumento.

### 17.3 Métricas, antes e depois

total de páginas · páginas preservadas · páginas com representação
visual · páginas com texto extraído · páginas em branco · páginas com
falha · títulos reais · títulos genéricos · seções · classificação
visual · falhas de processamento · falhas de upload · tema sugerido ·
tema confirmado · **tempo de importação · memória · Storage utilizado ·
desempenho da visualização**.

Selecionar **antecipadamente** quatro páginas da GE — abertura,
fotografia, diagrama, texto — e comparar **lado a lado o PDF original e
o Brennimark**.

---

## 18. Sequência de implementação

| # | Fatia | Entrega |
|---|---|---|
| **0** | **Contrato, sondagem e linha de base** | contrato do manifesto (sem tabela) · fixture sintética · sondagem técnica de entrega do PDF · medição anterior reconstruída · quatro páginas da GE escolhidas antes · **nenhuma migração** |
| **1** | Visualização canônica | PDF completo · todas as páginas · sem recorte · virtualização · zoom · miniaturas · busca · desktop e mobile |
| **2** | Camada semântica e manifesto | **tabela do manifesto, preenchimento e ligação semântica** · texto · índice · títulos · procedência · busca · IA · acessibilidade |
| **3** | Importação revisável | thumbnails · estrutura · classificação · falhas · correções · revisão humana · publicação consciente |
| **4** | Identidade | cores candidatas · fontes detectadas · confirmação · upload licenciado · pendência · proibição de "pronto" com tema padrão |
| **5** | Direção visual do Brennimark | semantic board · moodboard · conceitos · quatro marcas · alta fidelidade · aprovação |
| **6** | Papéis e segurança | editor · matriz · RLS · funções · rotas · testes cruzados |
| **7** | Studio | portfólio · painel · curadoria · original/edição/publicada · identidade · assets · equipe · IA · histórico |
| **8** | Guia | leitura · navegação · assets para download · fidelidade · mobile · **rotas definitivas** |
| **9** | Assistente unificado | consulta · análise · prompts · anexos · histórico · citações · troca de marca |
| **10** | Editor visual | progressivo: começa por substituir e criar páginas; evolui para objetos, camadas, tipografia, imagens, vetores, grids |

**As rotas definitivas e os redirecionamentos são instalados quando as
novas experiências estiverem validadas — não antes.**

### 18.0 Escopo da Fatia 0 — o que ela é, e o que ela não é

A Fatia 0 **não implementa o manifesto**. Ela produz o **contrato** dele
e o conhecimento técnico que decide o desenho da Fatia 1. **Nenhuma
migração de manifesto ou de representação é aplicada aqui.**

**Faz:**

- referência ou worktree separado a partir de `6986fdb`, **sem alterar o
  checkout principal** e **preservando integralmente o WIP**;
- fixture sintética cobrindo: página vertical · página horizontal ·
  fotografia · vetor · diagrama · texto corrido · **página sem texto
  extraível** · **tipografia convertida em curvas** · **imagem
  achatada**;
- contrato do manifesto: campos, vocabulário, invariantes, e de qual
  campo sai cada métrica;
- linha de base reconstruída, **declarando que o instrumento anterior é
  diferente do novo**;
- quatro páginas da GE escolhidas **antecipadamente**: abertura,
  fotografia, diagrama, texto;
- **sondagem técnica de entrega do PDF:**
  - a entrega assinada do Storage suporta Range Requests?
  - tempo até a primeira página;
  - volume transferido antes da primeira página;
  - memória em desktop e em mobile;
  - comportamento quando a URL expira **durante** a sessão;
  - URL assinada direta **versus** rota de servidor com Range;
- recomendação técnica e de custo.

**Não faz:** visualizador definitivo · qualquer esquema · retomada da
migração de rotas · qualquer alteração em Studio ou Guia.

Ao terminar: apresentar evidências e **aguardar aprovação para a Fatia
1**.

### 18.1 O WIP, sob esta sequência

A sequência empurra rotas para a Fatia 8. O WIP fica parado até lá, e
**não é presumido aproveitável**:

| Parte | Prognóstico |
|---|---|
| `rotas-antigas.ts` + teste | provavelmente sobrevive — lógica pura de endereço |
| `caminhoDaMarca` / `caminhoDoStudio` + testes | provavelmente sobrevive — a IA da §12 está aprovada |
| correção do `comAlvo` + teste | **sobrevive** — é correção de defeito real, independente de tudo isto |
| `resolverWorkspaceAtivo` com filtro de donos | provavelmente sobrevive |
| `shellSections` sem "Conta" · `studioSections` · remoção do `foraDaMarca` · testes de navegação | **a reavaliar depois da Fatia 5** — é exatamente a navegação que a direção visual decide |

**`comAlvo`: saiu do WIP, commitado isolado (decisão 6).** E a verificação
isolada — worktree limpo em `HEAD` com só esses arquivos — **encontrou um
defeito que a verificação no checkout principal teria escondido**: a
suíte de testes compila sem `--jsx`, de propósito, então um `.test.ts`
importando de `alvo-client.tsx` **não compilava**. O teste que eu havia
escrito nunca tinha rodado.

A correção seguiu o padrão da casa em vez de afrouxar a suíte: `comAlvo`
foi extraída para `src/platform/alvo.ts`, módulo puro, e
`alvo-client.tsx` a reexporta — nenhum dos 23 chamadores mudou. É o mesmo
arranjo de `selecao.ts`, `secoes.ts` e `permissao.ts`: regra pura
separada do componente de cliente, testável sem subir a aplicação.

**Correção do registro anterior:** eu havia descrito este defeito como
"conserta um defeito real hoje". Não conserta. Todos os 23 chamadores
atuais vivem sob `[brandKey]`, então os dois parâmetros sempre existem e
**nenhum comportamento muda hoje**. A correção é **preventiva**: ela
impede que a primeira tela escopada só na conta — `/studio/<c>/ia`, na
Fatia 7 — nasça devolvendo 409 para quem tem dois workspaces. O defeito
nasceria em produção, na conta de uma agência com mais de um cliente,
porque em desenvolvimento ninguém tem duas contas.

---

## 18.2 Fatia 0 — resultados medidos (04/09)

Medições feitas em worktree separado, com o **PDF real da GE** e o
**código de `6986fdb`**. O checkout principal não foi tocado.

### 18.2.0 INCIDENTE P0 — o documento do cliente não foi apagado

A medição começou com uma descoberta que **não é uma conveniência, é uma
falha**: o PDF da GE **ainda está no Storage** — 11,3 MiB, 743 páginas —
**dois dias depois de a marca ter sido excluída**.

O que aconteceu, em ordem:

1. A marca foi excluída, e a exclusão em cascata funcionou: `brands`,
   `brand_documents`, `brand_imports`, versões, chunks, orçamento e
   razão de IA — tudo removido do banco, verificado por consulta.
2. O arquivo no Storage foi **enfileirado** em `brand_deletions`, como o
   desenho manda (a cascata do banco não alcança o Storage).
3. **A fila nunca drenou.** Ela drena em dois momentos, ambos
   oportunistas: quando alguém exclui outra marca, ou quando alguém
   **abre a administração**.
4. Ninguém abriu a administração desde então. O objeto continua lá.

**Por que isto é P0, e não um detalhe operacional:**

- A promessa do produto — "excluir a marca leva TODOS os arquivos dela",
  escrita na própria migração — **não se cumpriu**.
- A limpeza depende de uma ação humana futura e não relacionada. Numa
  conta que exclua sua única marca e não volte mais, **o documento do
  cliente permanece indefinidamente**.
- É falha de **ciclo de vida** e de **privacidade**: material de marca
  de terceiro sobrevivendo à decisão explícita de removê-lo.
- E é silenciosa: nada na interface, no log ou no banco avisa que existe
  pendência não drenada. Só apareceu porque fui procurar um arquivo para
  medir.

**O que NÃO fiz, de propósito:** não apaguei o objeto. Apagá-lo durante
a medição destruiria a evidência do incidente e o sujeito de teste, sem
autorização. **Ele também não é uma fixture permanente** — está ali por
falha, não por decisão, e continuará contando como pendência até você
decidir.

**Proposta de correção, para revisão — nada implementado, nenhum esquema
aplicado, nenhuma automação ligada nesta rodada.**

#### As quatro camadas

| Camada | O que faz | Por que não basta sozinha |
|---|---|---|
| Drenagem oportunista (existe hoje) | limpa ao abrir a administração ou ao excluir outra marca | depende de alguém aparecer |
| **Drenagem autônoma e repetível** | tarefa agendada, independente de sessão humana, que drena a fila periodicamente e registra cada tentativa | é o que fecha o buraco deste incidente |
| **Contabilidade da pendência** | idade da entrada mais antiga na fila e contagem, visíveis na administração | torna o silêncio impossível |
| **Reconciliação periódica** | varredura comparando `storage.objects` com o que o banco referencia, para achar órfão que nunca chegou à fila | a fila só protege o que foi enfileirado; isto protege o resto |

A reconciliação é a única que teria pego este caso mesmo se a inserção na
fila tivesse falhado — e a única que responde "existe arquivo de cliente
aqui que ninguém deveria mais ter?".

#### As dez garantias que a limpeza precisa ter

Apagar arquivo de cliente automaticamente é a operação mais perigosa
deste plano. Uma limpeza mal desenhada apaga o que não devia, e não há
desfazer. Por isso ela nasce com estas garantias, e não ganha nenhuma
delas depois:

| Garantia | O que significa, e por quê |
|---|---|
| **1. Modo `dry-run` por padrão** | a primeira execução **lista** o que apagaria e não apaga nada. Só um sinal explícito liga a remoção. Uma limpeza que só sabe apagar não pode ser observada antes de confiar nela. |
| **2. Período de carência** | nada é removido antes de um intervalo mínimo (ex.: 7 dias) desde o enfileiramento. Protege contra a corrida entre "importação falhou" e "importação está terminando", e dá janela humana para reverter uma exclusão feita por engano. |
| **3. Dupla verificação** | no instante da remoção, reconfere no banco que o objeto continua sem dono — não confia na decisão tomada quando a entrada entrou na fila. Estado muda entre enfileirar e executar. |
| **4. Proteção a fonte ativa** | um objeto referenciado por `brand_source_documents` com estado `ativa` **nunca** é candidato, mesmo se aparecer na fila. Sob a nova arquitetura, esse arquivo é o manual — apagá-lo é apagar o produto do cliente. |
| **5. Proteção a importação em andamento** | objeto de uma importação sem desfecho (nem publicada, nem falhada) é intocável até ela concluir. É exatamente o caso em que o arquivo existe legitimamente sem linha de marca ainda. |
| **6. Fila idempotente** | processar a mesma entrada duas vezes tem o mesmo efeito de processar uma. Sem isso, duas execuções concorrentes (a agendada e a oportunista) disputam o mesmo objeto e uma registra falha do que a outra já removeu. |
| **7. Remoção pela API do Storage — nunca `DELETE` em `storage.objects`** | apagar a linha do catálogo **não apaga o arquivo**: deixa o objeto órfão no armazenamento, agora sem nenhum registro apontando para ele. Seria trocar um órfão visível por um invisível. |
| **8. Confirmação de ausência** | depois de remover, confere que o objeto realmente não responde mais. Só então a entrada sai da fila. "Mandei apagar" não é "está apagado". |
| **9. Auditoria** | cada tentativa registra o quê, quando, por qual execução, com qual resultado — inclusive as que não apagaram nada. Sem trilha, uma remoção indevida é indistinguível de um arquivo que nunca existiu. |
| **10. Reconciliação periódica** | a varredura da tabela acima, com relatório, também em `dry-run` por padrão. |

**Ordem de implantação sugerida, quando autorizada:** contabilidade da
pendência primeiro (torna o problema visível sem tocar em nada), depois
reconciliação em `dry-run` (mede o tamanho real do problema), depois
drenagem autônoma, e a remoção automática por último — quando os
relatórios já mostrarem, por vários ciclos, que o conjunto candidato é
exatamente o esperado.

**Recomendação de sequência:** não é trabalho de uma fatia distante. Um
documento de cliente retido indevidamente é risco jurídico e de
confiança, e a correção é pequena perto do risco. Sugiro item próprio,
logo após a Fatia 1 — ou antes, se você preferir.

#### O que está proibido enquanto não houver autorização expressa

O arquivo **não é fixture** e **não pode ficar indefinidamente**. Até o
proprietário autorizar, sobre ele **não se faz**: apagar · mover ·
copiar · publicar · transformar em fixture · **qualquer uso novo além
das medições já autorizadas**.

**Cumprimento até aqui:** ele foi lido para a linha de base do pipeline
(§18.2.3) e servido por URL assinada para as medições de transporte
(§18.2.8, §18.2.9). Nenhuma cópia foi versionada, publicada ou
transformada em fixture — a fixture do repositório é 100% sintética
(§18.2.7). O arquivo continua exatamente onde estava, com o mesmo hash.

#### ✅ RESOLVIDO — arquivo excluído em 04/09, com autorização expressa

| Campo | Valor |
|---|---|
| Autorização | **expressa**, de André, em 04/09, após pergunta direta que descrevia a irreversibilidade |
| Responsável | André (autorizou) · execução por mim |
| Caminho | `brand-imports/b0a2b4dc-b594-48a1-8406-47ddb3f6380d/6ad11b2a-3457-47bc-bdb7-4aa5b92e8d39/1a42778a9f9033e73f4a6b17bf82fe7ff57a3255360a2ec9536055955902c740.pdf` |
| Tamanho | 11.844.340 bytes · 743 páginas |
| `ETag` antes | `5a689505f4eb7803c25a2db1eb582c0a` |
| Método | **`DELETE` na API do Storage** (`/storage/v1/object/...`) — **nunca** `DELETE` em `storage.objects` |
| Resposta | `200` · `{"message":"Successfully deleted"}` |

**Provas de ausência, colhidas depois:**

| Prova | Resultado |
|---|---|
| Assinar o objeto de novo | **404 `NoSuchKey`** — "Object not found" |
| URL assinada anterior | **400** — não entrega mais bytes |
| `GET` autenticado direto | **400** |
| Objetos no bucket `brand-imports` | **0** |
| Qualquer vestígio do hash em `storage.objects` | **0** |
| Entradas em `brand_deletions` | **0** |
| `brand_imports` · `brands` · `brand_documents` · `brand_document_versions` · `brand_chunks` · `brand_assets` | **0 em todas** |

**Nota sobre a fila:** como a exclusão foi feita pela API direta, ela não
passou por `drenarFilaDeExclusao`, e a entrada ficou órfã apontando para
um arquivo que já não existia. Fechei-a **por observação da ausência** —
que é exatamente o critério que a drenagem do produto usa — com a
remoção condicionada, na própria consulta, a `not exists` do objeto no
Storage. Isso é a fila do produto, não `storage.objects`.

**O incidente P0 continua aberto como defeito.** Este arquivo foi
resolvido; a **causa** — limpeza que depende de alguém abrir a
administração — não. As quatro camadas e as dez garantias acima seguem
como trabalho a fazer, e agora sem um sujeito de teste vivo para
lembrar dele.

<details><summary>Registro de retenção que seria preenchido caso a decisão fosse reter</summary>

Se houver autorização de retenção, ela precisa destes campos
**preenchidos**, não implícitos:

| Campo | Valor |
|---|---|
| Finalidade exclusiva | *(a declarar)* — as medições da Fatia 0 já usaram o arquivo; qualquer uso além disso precisa de finalidade nova |
| Data de início | *(a declarar)* |
| Prazo máximo | *(a declarar)* |
| Condição objetiva de encerramento | *(a declarar)* — sugestão: "encerradas as medições da Fatia 0" |
| Caminho exato | `brand-imports/b0a2b4dc-b594-48a1-8406-47ddb3f6380d/6ad11b2a-3457-47bc-bdb7-4aa5b92e8d39/1a42778a9f9033e73f4a6b17bf82fe7ff57a3255360a2ec9536055955902c740.pdf` |
| Hash do objeto | `sha256` no nome do arquivo; `ETag` medido: `5a689505f4eb7803c25a2db1eb582c0a` |
| Tamanho | 11.844.340 bytes (11,3 MiB), 743 páginas |
| Responsável pela exclusão | *(a declarar)* |
| Prova posterior de ausência | *(a produzir)* — no Storage **e** na fila `brand_deletions` |

**Procedimento de exclusão, quando autorizada:** remoção **pela API
normal do Storage**, nunca por `DELETE` direto em `storage.objects` (o
motivo está na garantia 7 acima: apagar a linha do catálogo deixa o
arquivo órfão e invisível). Depois: confirmar que o objeto não responde
mais, confirmar que a entrada saiu da fila, e registrar as duas provas
aqui.

*(Este bloco ficou sem uso: a decisão foi apagar.)*

</details>

**Sobre a exigência de autorização expressa:** ela não foi inferida de
concordância técnica. Na revisão de 04/09 o usuário escreveu "não vejo
mais motivo técnico para manter o PDF órfão" e listou a exclusão entre
as "ações que dependem de você" — o que é diferente de conceder. Perguntei
de forma direta, descrevendo a irreversibilidade e o fato de ser o único
exemplar na plataforma, e só executei com o "sim" explícito. **Apagar
material de marca de terceiro não se faz por interpretação.**

### 18.2.1 A medição pôde ser feita

Como consequência (indesejada) do incidente acima, o arquivo estava
disponível e a linha de base pôde ser medida agora, sem depender de você
reenviar o PDF.

### 18.2.2 Sondagem de entrega — resultado favorável, conclusão limitada

| Medida | Resultado |
|---|---|
| `accept-ranges: bytes` | **sim** |
| Intervalo inicial (0-1023) | **206 Partial Content**, `content-range` correto |
| **Intervalo sufixo** (últimos 1024 B) | **206**, resolvido para `11843316-11844339/11844340` |
| Bootstrap típico do PDF.js (sufixo 64 KiB + início 64 KiB) | **220 ms, 128 KiB** |
| Download completo (o que acontece sem Range) | **1031 ms, 11,3 MiB** |
| Razão | **90× menos bytes** para mostrar a primeira página |

**O intervalo-sufixo é o que decide**, e ele funciona: o PDF.js lê o fim
do arquivo primeiro (tabela de referências cruzadas). Sem suporte a
sufixo, não há carregamento progressivo — teria de baixar tudo.

**Custo de CPU é irrelevante perto da rede:** abrir o documento
(xref + catálogo) leva **42 ms**; a página 1 fica pronta em **1 ms**.

**O que esta sondagem NÃO autoriza concluir.** Ela mostra que o Storage
aceita Range e intervalo-sufixo **para este objeto, via curl**. Isso
**não** é o mesmo que "o visualizador está tecnicamente resolvido".
Ficou de fora tudo que só o navegador responde — e é onde os problemas
costumam morar:

| A medir no navegador, antes da Fatia 1 |
|---|
| Brennimark na **origem real**, não curl |
| **PDF.js** fazendo as requisições, com seu próprio padrão de intervalos |
| **CORS** na origem real |
| **Tempo até canvas visível** — distinto de `getPage()` resolver |
| **Bytes transferidos até a primeira página visível** |
| **Tempo de pintura** |
| Navegação até **página distante** (ex.: 1 → 700) |
| **Retorno a páginas anteriores** (o cache funciona?) |
| **Zoom** e o custo de re-renderizar |
| **Cancelamento de renders** que saíram da viewport |
| **Memória durante** a navegação |
| **Memória depois** de liberar páginas — há vazamento? |
| Comportamento quando a **URL expira** com o leitor rolando |
| **Obtenção de nova URL e retomada** sem perder a posição |

**Distinção que precisa estar explícita na medição:** `getPage()`
resolver **não é** página pintada e visível. Os 42 ms e 1 ms medidos
aqui são de estrutura, não de pixel. O número que importa para o produto
é o tempo até a pessoa **ver** a página.

**Recomendação preliminar (superada — ver §18.2.8):** a URL assinada
direta parecia a candidata por desempenho. **A medição no navegador
inverteu isso**, e por um motivo que a sondagem por curl não podia
alcançar: o navegador não deixa o PDF.js *ver* que o servidor aceita
intervalos.

**Hipótese atualmente favorecida: rota de mesma origem.** Não é parecer
fechado, e a distinção importa. O que a evidência **permite** concluir:

> A URL assinada direta, **na configuração atual do Supabase Storage**,
> não oferece carregamento progressivo ao PDF.js no navegador, porque os
> cabeçalhos necessários não ficam expostos por CORS.

O que ela **não** permite concluir: que a rota intermediária de mesma
origem seja a arquitetura definitiva. Isso depende de oito investigações
(§19.2.1), das quais quatro já têm resposta e **uma delas encontrou um
limite que muda o desenho**.

O argumento a favor da hipótese não é auditoria nem controle de
download — é que **a URL direta não entrega carregamento progressivo**.
Cross-origin, `accept-ranges` e `content-range` ficam invisíveis ao
JavaScript, o PDF.js desiste dos intervalos e baixa 11,3 MiB para
mostrar a primeira página. Não é preferência de arquitetura: é a
diferença entre ter e não ter a funcionalidade que a Fatia 1 existe para
construir.

O que a rota resolve de uma vez:

| | URL direta | Rota de mesma origem |
|---|---|---|
| Carregamento progressivo | **não funciona** (metadados invisíveis) | funciona — 0,61 MiB até a 1ª página |
| Autorização por usuário/conta/marca | fora do produto (só o token) | dentro do produto |
| Auditoria de acesso | impossível | natural |
| Separar ver de baixar | impossível | `Content-Disposition` sob controle |
| Renovação de credencial | o cliente precisa detectar 400 e repedir | invisível ao cliente |
| Custo | banda do Storage | banda do Storage **+ banda e tempo da aplicação** |

**A ressalva honesta continua valendo:** nada disso impede quem vê o
documento inteiro de obter os bytes (§19.2). A rota melhora governança e
observabilidade — não cria uma garantia que não existe.

### 19.2.1 As oito investigações antes de decidir

**1. O Supabase permite configurar `Access-Control-Expose-Headers`?**
**INVESTIGAÇÃO INCONCLUSIVA.** Procurei e não encontrei — e *não
encontrar não prova que não exista*. A busca na documentação só devolve
CORS para (a) o gateway Envoy do **self-hosted** e (b) Edge Functions,
onde os cabeçalhos são do seu próprio código; nada para o Storage
hospedado. Mas "a documentação pública não menciona" e "não é
configurável" são afirmações diferentes, e só a primeira está provada.

**O que fecharia esta pergunta, e não foi feito:** perguntar ao suporte
do Supabase; procurar configuração fora da documentação (painel do
projeto, API de gerenciamento, configuração de bucket); e verificar se
um domínio próprio na frente do Storage muda a resposta. Enquanto isso
não acontecer, o item fica **em aberto**, não resolvido pela negativa.

E a medição fecha o diagnóstico. Preflight (`OPTIONS`) do objeto real:

```
access-control-allow-origin:  *
access-control-allow-headers: range
access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS,...
(nenhum access-control-expose-headers)
```

Ou seja: **mandar `Range` é permitido; ler a resposta dele, não.** O
`GET` com `Origin` devolve `content-range` e `etag` **no fio** — e sem
`Access-Control-Expose-Headers` o navegador os esconde do JavaScript. O
servidor faz tudo certo; a declaração que falta é de uma linha.

**2. Uma CDN ou camada de entrega resolve sem o PDF atravessar a
aplicação?** **Parcialmente, e o achado é útil:** o Storage **já está
atrás do Cloudflare** (`server: cloudflare`, `cf-ray`, e no teste
`cf-cache-status: HIT`, `age: 19`). Um cabeçalho de CORS não pode ser
acrescentado "de fora" sem que a resposta passe por quem o acrescenta —
mas **passar por uma camada de borda não é o mesmo que passar pela
aplicação**. Um worker de borda transforma cabeçalho e repassa o fluxo
perto da origem, sem consumir função da aplicação. Fica registrado como
alternativa real à rota, e não foi medido.

**3. A rota transmite 100 MiB por streaming, sem montar em memória?** A
sonda repassa `upstream.body` (um `ReadableStream`) direto para a
resposta, sem `arrayBuffer()` — estruturalmente é streaming. **Mas não
foi medido com 100 MiB**, e o item 4 abaixo mostra que a pergunta certa
é outra.

**4. Limites e custos reais na Vercel — ACHADO QUE MUDA O DESENHO.** A
documentação é explícita: **o corpo de resposta de uma Vercel Function
tem teto de 4,5 MB**, e acima disso vem `413 FUNCTION_PAYLOAD_TOO_LARGE`.

Consequências prováveis — e **nenhuma delas está verificada no ambiente
publicado**:

- Uma rota que sirva **o arquivo inteiro** (200, 11,3 MiB — mais ainda
  num manual de 100 MiB) deve **estourar o teto em produção**.
- Uma rota que sirva **intervalos de 64 KiB** deve passar. **Mas isso é
  inferência a partir do número documentado, não medição.** Cada
  resposta caber no teto não prova que a **sequência inteira** funcione
  na Vercel: falta ver as onze requisições reais atravessando o ambiente
  publicado, com o `Range` chegando à função, o `206` e o
  `Content-Range` voltando intactos pela borda, e o comportamento sob
  concorrência e duração.
- **A minha medição não podia revelar nada disso:** a sonda rodou em
  `localhost`, onde o teto não existe. O proxy transmitiu 11,8 MiB sem
  reclamar. **Concluir daí que "64 KiB passa" seria repetir o erro que
  este documento existe para corrigir** — afirmar comportamento de
  produção a partir de um ambiente que não é o de produção.

Outros números documentados: duração máxima 300 s no plano Hobby
(streaming conta para a duração), memória 2 GB, custo por CPU ativa e
memória provisionada. Falta confirmar se o teto de 4,5 MB vale
igualmente para o runtime Edge com streaming — a página não distingue, e
**não vou supor**.

**Conclusão honesta do item 4:** existe um limite documentado que
*provavelmente* proíbe servir o arquivo inteiro por função da Vercel.
Isso é forte o bastante para desenhar contra ele, e **fraco demais para
considerar o transporte resolvido**. O teste no ambiente publicado é
condição para decidir.

**5. Cancelamento quando o navegador abandona a requisição.** A sonda
agora cancela o fluxo de origem no `cancel()` do `ReadableStream` — sem
isso ela continuaria baixando o que ninguém vai ler, pagando banda e
duração. **Implementado na sonda, ainda não medido sob abandono real.**

**6. Semântica HTTP — medida contra o Storage, e ela é completa:**

| Caso | Resposta do Storage |
|---|---|
| `HEAD` | 200, com `content-length` e `accept-ranges` |
| `Range` além do fim | **416**, com `content-range: bytes */11844340` |
| `If-Range` com `ETag` correto | **206** |
| `If-Range` com `ETag` errado | **200** (arquivo inteiro) |
| `If-None-Match` | **304** |
| Multi-range | **206** `multipart/byteranges` |

**Isto é a especificação que a rota precisa honrar** — e o fato de a
origem já fazer tudo certo significa que a rota pode repassar em vez de
reimplementar. O multi-range é o caso que dá mais trabalho e que talvez
nem precise ser suportado (o PDF.js não o usa).

**7. Autorização antes de qualquer byte.** Requisito de desenho, não
medido: a rota resolve sessão, conta e marca **antes** de tocar no
Storage, e só então abre o fluxo. A sonda **não faz isso** — ela é
instrumento e está explicitamente sem autorização.

**8. Impossibilidade de alcançar arquivo de outra conta ou marca.**
Requisito de desenho: a rota **não pode aceitar um caminho vindo do
cliente**, como a sonda aceita (`?u=`). Ela recebe o identificador do
documento-fonte, resolve o caminho no servidor a partir da marca
autorizada, e confere os segmentos de conta e marca — a mesma disciplina
de `pertenceAMarca` que já existe em `caminhos.ts`. A sonda é o
contra-exemplo do que a rota definitiva precisa ser.

**Resumo das oito:** uma **inconclusiva** (1 — não achar não é provar que
não existe), duas respondidas (2, 6), uma **parcialmente respondida com
inferência não verificada** (4), uma implementada e não medida (5), uma
parcial (3), duas são requisitos de desenho (7, 8).

### 19.2.2 O que a medição de rede JÁ decide: Range é requisito

Isto não é hipótese, e não depende de qual transporte vencer:

> **O visualizador precisa operar com Range.** Sem intervalos, a primeira
> página de um manual de 743 páginas leva **≈64 segundos** numa conexão
> móvel razoável, contra **≈5 segundos** com intervalos (§18.2.9).

Consequência prática: **qualquer transporte que não entregue Range
utilizável ao navegador está fora**, independentemente de custo,
simplicidade ou preferência. A URL assinada direta, na configuração
atual, é justamente isso — e é por isso que ela sai da disputa **hoje**,
sem que a rota entre eleita por consequência.

### 19.2.3 As cinco validações que faltam para a hipótese virar decisão

A "rota de mesma origem" **continua hipótese** até que estas cinco
tenham resposta medida:

| # | Validação | Por que não dá para pular |
|---|---|---|
| 1 | **Teste na Vercel real**, não no servidor local | o teto de 4,5 MB, a borda, a duração e a concorrência só existem lá (§19.2.1, item 4) |
| 2 | **Transmissão de arquivo próximo de 100 MiB** | 11,3 MiB não estressa nem memória, nem duração, nem contagem de requisições; um manual grande estressa os três |
| 3 | **Cancelamento por abandono real** | a sonda cancela o fluxo de origem no `cancel()`, mas ninguém verificou o que acontece quando o navegador some no meio |
| 4 | **Autorização e isolamento entre marcas** | a rota precisa resolver o caminho no servidor a partir da marca autorizada, e recusar qualquer tentativa de alcançar arquivo de outra conta ou marca |
| 5 | **Comparação com solução de CDN/borda** que exponha os cabeçalhos | se uma camada de borda resolver o CORS sem passar pela aplicação, ela ganha em custo e em simplicidade — e essa comparação nunca foi feita |

**Enquanto as cinco não fecharem, o documento não chama isso de
decisão.** A decisão do transporte definitivo pertence à Fatia 1, depois
do teste publicado.

**Duas medições que faltam antes de fechar:** rede estrangulada (§18.2.9)
e aparelho móvel real — este último passa a ser **portão da Fatia 1**,
não bloqueio da Fatia 0.

**Expiração no meio da sessão — medida, e ela morde:** com uma URL de 5
segundos, o pedido de intervalo depois de expirada devolve
**`HTTP 400 InvalidJWT`** (`"exp" claim timestamp check failed`). Não é
401 nem 403 — então **um cliente que trate só "não autorizado" não vai
reconhecer a expiração**, e o PDF.js receberia um erro opaco no meio do
documento, com o leitor já rolando.

Isso vira requisito da Fatia 1: ou a URL é reemitida antes de vencer
(renovação silenciosa, preservando a posição de leitura), ou o
visualizador trata `400 InvalidJWT` como "reautenticar e continuar" —
nunca como falha de leitura. Uma sessão de leitura de manual dura mais
que qualquer validade curta e segura.

**Três pontos a resolver na Fatia 1, todos observados na sondagem:**

1. `cache-control: no-cache` na resposta assinada — o navegador
   revalida a cada pedaço. Para um documento imutável, é desperdício;
   vale investigar controle de cache mais longo.
2. Não há `content-disposition` na resposta. Para a decisão 3 (§19.2),
   `inline` precisa ser explícito, não herdado do padrão do navegador.
3. A renovação da URL assinada, pelo comportamento de expiração acima.

**Memória:** 165 MiB de RSS após abrir o documento em Node, 275 MiB após
varrer o texto das 743 páginas — **sem renderizar nada**. É o número que
mais preocupa para o mobile, e só a Fatia 1 mede de verdade, com
renderização e virtualização reais.

### 18.2.3 Linha de base do pipeline — e três correções ao que escrevi

Rodando o pipeline real do produto (`detectarRepetidos` → `agrupar`, o
código de `6986fdb`) sobre o manual da GE:

| Métrica | Resultado |
|---|---|
| Páginas no PDF | 743 |
| Páginas em alguma seção | **743** |
| **Páginas perdidas** | **0 — cobertura 100%** |
| Páginas em `ignoradas` | **0** |
| Seções | **500** |
| Títulos genéricos | **0 (0%)** |
| Método de detecção | 493 outline · 7 heading |
| Cabeçalhos/rodapés removidos | 1 |
| Fronteiras dissolvidas pelo teto | 19 |

**Correção 1 — eu estava errado sobre a perda de páginas.** Escrevi:
*"Suspeita fundamentada, pelo defeito da §5: não é zero."* **É zero,
neste manual.** O caminho de código que descarta página sem texto
(`secoes.ts:271,289`) existe e continua sendo um defeito real de
arquitetura — mas **não disparou para a GE**, porque toda página deste
manual tem algum texto útil, inclusive as de arte (a tipografia script
das aberturas é texto extraível, não curva). A consequência prática é
importante: **a fixture sintética precisa cobrir esse caso, porque o
manual real não o cobre.**

**Correção 2 — são DUAS linhas de base distintas, e não uma comparação
direta.** 122 e 500 não são o mesmo experimento com resultados
diferentes: são instrumentos diferentes, em código diferente.

| | Importação histórica publicada | Execução em `6986fdb` |
|---|---|---|
| Quando | antes da Fase 1e | agora, na medição |
| Código | pré-`d7a26ab` | pós-1e, 1f, 1g |
| Seções | **122** | **500** |
| Títulos genéricos | **68 (56%)** | **0 (0%)** |
| Seções de 1 página | não medido | **354** |
| Fronteiras dissolvidas | não medido | **19** |
| Imagens | 0 | (a 1g classificaria 17) |

**A leitura correta das duas:** a Fase 1e **corrigiu a falta de títulos**
— de 56% de genéricos para zero — **e, no mesmo movimento, produziu
fragmentação editorial excessiva**. As duas coisas são consequência da
mesma mudança, e nenhuma anula a outra. Tratar "122 → 500" como
progresso seria tão errado quanto tratar como regressão: o que houve foi
uma troca de um defeito visível (seções sem nome) por outro defeito
visível (seções sem tamanho editorial).

A causa estrutural dessa troca — achatar uma árvore numa lista — está
na §5.4, e é lá que ela se resolve, não ajustando profundidade ou teto.

**Correção 3 — a fragmentação, medida.** O teto de 500 seções foi
**atingido** (19 fronteiras dissolvidas para caber), e a distribuição é:

| Tamanho da seção | Quantidade |
|---|---|
| 1 página | **354** |
| 2–3 páginas | 123 |
| 4–8 páginas | 20 |
| 9+ páginas | 3 |

**Média de 1,5 páginas por seção.** Um manual de 743 páginas virou 500
seções — na prática, uma seção por página. Isso não é estrutura
editorial, é paginação com outro nome, e é o defeito oposto ao que a 1e
corrigiu. **Novo item para a Fatia 3:** o índice profundo precisa de um
critério de granularidade (usar até certo nível, ou fundir irmãos
curtos), calibrado contra este número — e o teto de 500 deixou de ser
teoria, está ativo.

### 18.2.4 O classificador visual, medido

| Medida | Resultado |
|---|---|
| Seções classificadas visuais (`ehVisualDominante`) | **17 de 500 (3%)** |
| Páginas nessas seções | 17 |
| Imagens que a 1g geraria | 17 |
| Caracteres por seção | mín 96 · **mediana 1562** · máx 28189 |

**3% num manual art-direcionado é baixo demais**, e o motivo aparece na
mediana: o limiar de `< 300 caracteres` está muito abaixo da massa. Isso
confirma, com número, o que a §6 já argumentava por raciocínio — contar
caracteres não mede dominância visual.

Observação de método: como as seções ficaram com ~1 página, o defeito
"só a primeira página é renderizada" (§1.3 da versão anterior) **não
perdeu nada aqui** — 0 páginas visuais ficaram de fora. Ele continua
real; este manual, com esta granularidade, simplesmente não o expõe.

### 18.2.5 As quatro páginas da GE — escolhidas e registradas ANTES do resultado

Escolhidas olhando o PDF original, **antes de existir qualquer
visualizador do Brennimark para comparar**. É essa ordem que dá valor à
comparação: elas não podem ser escolhidas depois, pelo que ficou bom.

| Papel | Página | O que é | Sinais medidos |
|---|---|---|---|
| **Abertura** | **730** | Divisor "FAQ — Frequently Asked Questions": tipografia script grande em diagonal, monograma GE, filete vermelho, mini-sumário | 94 chars · cobertura de texto 17,1% · 0 imagens · 5 preenchimentos |
| **Fotografia** | **197** | "Promotional Brochures / Creative Matrix": 12 capas de brochura com fotografia de aeronave, fundos vermelho e preto | 1022 chars · cobertura 5,2% · **21 imagens** · 68 preenchimentos |
| **Diagrama** | **372** | "Wall Lights": desenho isométrico de luminária em painel de exposição, com cotas de 18" e 42" | 463 chars · cobertura 3,1% · **33 imagens** · 520 preenchimentos |
| **Texto** | **630** | "Acquired Affiliates / Naming Process Overview": texto corrido em três colunas, subtítulos em vermelho, miniaturas de página embutidas | **15.617 chars** · cobertura 13,1% · 0 imagens |

As renderizações de referência dessas quatro páginas foram geradas a
partir do PDF original e ficam guardadas fora do repositório (material
de terceiro, decisão 5) para a comparação lado a lado da Fatia 1.

**Duas observações que já saem da escolha:**

1. **A página 372 (diagrama) tem 463 caracteres** — acima do limiar de
   300 do classificador atual. Uma página que é inequivocamente desenho
   técnico **não seria classificada como visual hoje**. É o contraexemplo
   concreto que faltava à §6.
2. **Mesmo a página de "texto corrido" é art-direcionada** — três
   colunas, hierarquia de cor, miniaturas embutidas. Reconstruí-la como
   parágrafos sequenciais perde a diagramação, ainda que preserve as
   palavras. Reforça a §3: o PDF é a verdade visual, e a extração é outra
   coisa.

### 18.2.6 O que ainda falta na Fatia 0

| Item | Estado |
|---|---|
| Contrato do manifesto | ✅ §5.1, §5.2 — e consolidado como `source_pages` em §5.4 |
| Separação das cinco estruturas | ✅ §5.4 |
| Sondagem de Range/sufixo/expiração por curl | ✅ §18.2.2 |
| Linha de base do pipeline em `6986fdb` | ✅ §18.2.3 |
| Duas linhas de base registradas separadamente | ✅ §18.2.3 |
| Registro do PDF órfão (P0) e proposta de limpeza | ✅ §18.2.0 |
| Quatro páginas escolhidas e registradas | ✅ §18.2.5 |
| Estado final do CI | ✅ verde em `25dbb56` (§0.3) |
| **Fixture sintética com os nove casos** | ✅ §18.2.7 |
| **Medições no navegador real** (a lista da §18.2.2) | ✅ §18.2.8 — com limitações declaradas |
| **Canvas efetivamente pintado**, distinto de `getPage()` | ✅ 482.863 pixels provados por `getImageData` |
| **Expiração e renovação vistas pelo PDF.js** | ✅ `ResponseException` 400; renovação restaura página, zoom e rolagem |
| **Pixel visível na tela** | ❌ não medido — painel oculto suspende o `rAF` (§18.2.8, limitação 1) |
| **Memória de canvas** | ❌ não medido — `performance.memory` não enxerga buffer de canvas (limitação 3) |
| **Mobile** | ❌ não medido — a emulação de viewport não pegou (limitação 4) |
| **Rede estrangulada** | ❌ não medido (limitação 5) |

A **comparação visual lado a lado** das quatro páginas será executada
quando existir o visualizador da Fatia 1. As páginas já estão escolhidas
e registradas (§18.2.5), que é o que precisava acontecer agora.

### 18.2.11 Critério de fechamento da Fatia 0

**Quem declara a Fatia 0 concluída é André, depois de examinar as
evidências.** Não é uma declaração minha. O que segue é o estado de cada
item exigido:

**A fronteira, decidida em 04/09:**

| Escopo | O quê |
|---|---|
| **Fatia 0** | navegador visível e **layout** em viewport mobile |
| **Portão da Fatia 1** | **desempenho e memória** em aparelho físico |
| **Durante a Fatia 1** | **transporte definitivo**, decidido após teste no ambiente publicado |

Aparelho físico deixa de bloquear o encerramento investigativo da Fatia
0 — o que a Fatia 0 precisa provar sobre mobile é que o **layout**
funciona, não quanto de memória o aparelho gasta.

| Entregável | Estado |
|---|---|
| Contrato das estruturas | ✅ §5.1, §5.2, §5.4 (as cinco entidades) |
| Fixture sintética e testes | ✅ §18.2.7 · commit `20d50eb` · 15 testes |
| Linha de base antiga e atual, separadas | ✅ §18.2.3 (122/68 histórica × 500/0 em `6986fdb`) |
| Rede estrangulada | ✅ §18.2.9 — dois perfis, 1600 e 400 kbps |
| Range como requisito do visualizador | ✅ §19.2.2 — decidido pela medição |
| Comparação dos transportes **sem virar decisão** | ✅ §19.2 — hipótese, com as oito investigações (§19.2.1) e as cinco validações que faltam (§19.2.3) |
| Plano de medição física para a Fatia 1 | ✅ §18.2.10 |
| **Destino do PDF órfão** | ✅ **excluído em 04/09** com autorização expressa, provas em §18.2.0 |
| **Navegador visível** | ✅ §18.2.9-b — quatro estados medidos, sem ponte de `rAF` |
| **Layout em viewport mobile** | ✅ §18.2.9-c — 375×812 confirmado de dentro da página |

### ✅ FATIA 0 APROVADA E CONCLUÍDA — 04/09, por André

Declarada concluída após exame das evidências. As duas ressalvas abaixo
**acompanham formalmente o encerramento** e delimitam o que a Fatia 0
provou:

> **1. Os 31 ms são deste ambiente e desta fixture.** Eles **não** viram
> garantia universal de que "render concluído equivale a visível". O
> número saiu de um navegador, numa máquina, com uma fixture sintética de
> 9 páginas. Manual grande, aparelho lento ou canvas maior podem afastar
> os dois estados — a distinção entre *render concluído* e *pixel na
> tela* continua tendo de ser **medida, não presumida**, sempre que o
> custo de errar for relevante.

> **2. A fixture comprova geometria, não qualidade final.** Ela prova que
> retrato e paisagem cabem, que a proporção é preservada e que não há
> estouro — **não** prova como o visualizador se comporta com um manual
> de verdade. **Aparelho físico, PDF grande e rota publicada continuam
> sendo portões da Fatia 1.**

**A Fatia 1 não está iniciada nem automaticamente autorizada.**

---|---|
| Status da resposta com `Range` | **206 Partial Content** (o servidor honra) |
| Cabeçalhos que o JavaScript enxerga | `content-length`, `content-type`, `expires`, `last-modified` |
| **`accept-ranges`** | **invisível** |
| **`content-range`** | **invisível** |

Cross-origin, o navegador só entrega ao JavaScript os cabeçalhos que o
servidor autorizar por `Access-Control-Expose-Headers`. O Storage do
Supabase **não expõe `accept-ranges` nem `content-range`**. O PDF.js lê
exatamente esses dois para decidir se pode pedir intervalos — não os
vendo, conclui que o servidor não suporta, e **baixa o arquivo inteiro**.

Medido: **4 requisições, nenhuma com cabeçalho `Range`, 11.844.340 bytes
antes da primeira página.** O arquivo inteiro, para mostrar uma página.

**A mesma requisição em mesma origem expõe tudo** —
`accept-ranges: bytes`, `content-range: bytes 0-1023/374775`, mais
`etag`, `cache-control`, `vary`. Sem CORS no meio, não há filtro.

#### Os dois transportes, medidos lado a lado

Com `disableStream: true` e `disableAutoFetch: true` — a configuração que
um visualizador de verdade usaria:

| | URL assinada direta | Rota de mesma origem |
|---|---|---|
| Requisições até a 1ª página | **1** | **11** (10 pedaços pequenos) |
| **Bytes até a 1ª página** | **11,3 MiB** (arquivo inteiro) | **0,61 MiB** |
| Estrutura carregada | 743 ms | 848 ms |
| 1ª página com tinta | 955 ms | 1953 ms |
| Tinta no canvas | 99,6% | 99,6% |

**A rota transfere ~5% dos bytes. E, nesta ligação, chega depois.** As
duas coisas são verdade ao mesmo tempo: numa conexão rápida, baixar 11
MiB de uma vez vence 11 idas e voltas sequenciais no relógio. O que a
rota ganha é **volume**, e volume é o que decide em conexão móvel,
plano medido, e memória.

#### O resto do comportamento (modo direto, sequência completa)

| Etapa | Resultado |
|---|---|
| Estrutura carregada | 203 ms · 743 páginas |
| Render concluído (pág. 1) | 412 ms · **482.863 pixels com tinta (99,6%)** |
| Página distante (700) | tinta 29,1% · **0 bytes extras** (já tinha tudo) |
| Retorno à página 1 | **0 bytes extras** |
| Zoom 2,5× | canvas 1530×1980 · tinta 99,5% · 0 bytes extras |
| Rotação 90° | canvas 792×612 (dimensões trocadas, correto) |
| Cancelamento fora da viewport | **`RenderingCancelledException`** — cancela de verdade |
| URL expirada no meio da leitura | **`ResponseException`, status 400** — igual ao curl |
| Renovação e restauração | página, zoom (2,5×) e rolagem **restaurados**, 3322 ms |

#### Limitações desta medição — declaradas, não escondidas

1. **"Pixel visível na tela" continua NÃO medido — e eu tentei duas
   vezes.** O painel embutido reporta `visibilityState: "hidden"`; o
   Chrome real, acionado pela extensão, reporta **o mesmo** — porque a
   janela dele também não está em primeiro plano. Aba oculta suspende o
   `requestAnimationFrame`, e sem ele não há pintura.
   Trazer uma janela para frente exige consentimento de **controle de
   tela**, e não achei certo disparar esse diálogo na tela do usuário
   por causa de uma medição. **Fica pendente, e depende de você estar
   presente** (ou de autorizar o acesso de tela explicitamente).
   O que **foi** medido são os outros dois estados, e eles são
   distintos: **documento aberto** (a estrutura resolve), **render
   concluído** (a promessa do PDF.js resolve) e **canvas com tinta**
   (pixels realmente escritos, provados por `getImageData` — 482.863
   deles). O quarto estado, *visível a um ser humano*, é o que falta.
2. **E a suspensão do rAF é, ela mesma, um achado de produto:** o laço
   de render do PDF.js **depende** de `requestAnimationFrame`. Em aba
   oculta ele **não avança** — a primeira execução do harness travou
   indefinidamente por isso. Consequência real: página enfileirada para
   render com a aba em segundo plano não pinta até a pessoa voltar.
   Qualquer estratégia de pré-carregamento na Fatia 1 precisa contar com
   isso. Para medir, instalei uma ponte de `rAF` para `setTimeout`
   (usada 22 vezes), o que **invalida os tempos rotulados
   `pixel_visivel_ms`** — eles são tempo de ponte, não de pintura.
3. **`performance.memory` NÃO é prova de liberação de canvas — e não
   será usada como tal.**
   `performance.memory` reporta só o *heap* de JavaScript (6,5 → 22,7 MB
   no pico). O buffer de um canvas mora **fora** dele: o canvas de zoom
   2,5× (1530×1980 RGBA) sozinho são ~12 MB que **não aparecem** nessa
   conta. Por isso a liberação de canvases medida (22,7 → 22,8 MB) não
   significa "não liberou" — significa "este instrumento não vê". Medir
   memória de canvas de verdade exige outra ferramenta.
4. **Mobile NÃO foi medido.** Tentei: pedi emulação de viewport 375×812
   e, ao conferir dentro da página, `innerWidth` reportou **1480** — a
   emulação não sobreviveu à navegação, e a execução que eu chamaria de
   "mobile" rodou em viewport de desktop. Não vou apresentar como
   medição de mobile algo que mediu desktop.
   E vale o registro que já valeria se tivesse dado certo: **emulação de
   viewport é proxy, não aparelho**. Não tem a CPU, a memória, a pressão
   de coletor de lixo nem o descarte agressivo de aba de um telefone —
   serve para layout, nunca para concluir sobre memória ou desempenho
   em mobile. O número real depende de aparelho real.
5. **Ligação rápida, sem estrangulamento.** Nenhuma medição foi feita em
   rede lenta ou medida. É exatamente o cenário que favorece o download
   inteiro — a vantagem da rota cresce quando a banda encolhe.
6. **A rota de proxy medida é instrumento**, servida pelo servidor de
   desenvolvimento, sem autorização, auditoria ou cache. Não é desenho
   de produto; é o mínimo para comparar transportes. **E rodou em
   localhost, onde o teto de 4,5 MB da Vercel não existe** (§19.2.1,
   item 4) — em produção a mesma requisição teria falhado.

### 18.2.9 Rede estrangulada — onde a diferença deixa de ser acadêmica

Na medição anterior, em banda plena, a rota com intervalos transferia 5%
dos bytes **e chegava depois**. Isso levantava a dúvida certa: a economia
de volume importa na prática?

Para responder sem misturar variáveis, os dois transportes passaram a ser
servidos **pela mesma sonda, sob a mesma taxa** — a única diferença é se
`accept-ranges`/`content-range` ficam visíveis. É a reprodução, em mesma
origem, do que o CORS do Storage impõe na URL direta.

| Perfil | Requisições | Bytes | Documento aberto | **1ª página** |
|---|---|---|---|---|
| Plena · com Range | 11 | **0,61 MiB** | 1999 ms | 3162 ms |
| Plena · sem Range | 1 | 11,3 MiB | 2803 ms | **3005 ms** |
| Móvel 1600 kbps · com Range | 11 | **0,61 MiB** | 3450 ms | **4999 ms** |
| Móvel 1600 kbps · sem Range | 1 | 11,3 MiB | 63.147 ms | **63.997 ms** |
| Móvel 400 kbps · com Range | 11 | **0,61 MiB** | 11.564 ms | **14.996 ms** |

**Em banda plena os dois empatam. Numa conexão móvel razoável, a
diferença é 5 segundos contra 64 — treze vezes.** E a 400 kbps, com
intervalos, ainda são 15 segundos; sem intervalos seriam mais de quatro
minutos (não medido, para não prender a sonda — a projeção sai dos
mesmos 11,3 MiB).

É este quadro que transforma o achado de CORS de curiosidade técnica em
problema de produto: **na conexão em que uma pessoa de fato abre um
manual pelo celular, a URL direta leva um minuto para mostrar a primeira
página.**

**Navegar até página distante (700):** com intervalos, +2 requisições e
+262 KiB; sem intervalos, 0 e 0 — o arquivo inteiro já estava lá. Os
tempos desse passo (≈4 s em quase todos os perfis) ficaram dominados pela
ponte de `rAF`, não pela rede, e **não devem ser lidos como medida de
rede**.

**O que este experimento NÃO é:** estrangulamento na camada de rede. A
sonda limita a taxa do fluxo, sem simular latência de ida e volta, perda
de pacote ou crescimento de janela — coisas que penalizariam *mais* o
caminho com 11 requisições. A conclusão que ele sustenta é sobre
**volume × taxa**, e é robusta justamente porque a assimetria é grande.

### 18.2.9-b Navegador visível — os quatro estados, medidos sem ponte

Executado com a **fixture sintética** (página 9, a abertura em cor
sólida), em aba **realmente visível**: `visibilityState: "visible"`,
`rAF_dispara: true`. **Sem substituir `requestAnimationFrame`** — a
página foi reescrita para *esperar* a visibilidade em vez de abortar ou
falsear o relógio com `setTimeout`.

| Estado | Tempo | O que significa |
|---|---|---|
| **Documento aberto** | **72 ms** | a estrutura do PDF resolveu |
| **Render concluído** | **94 ms** | a promessa do PDF.js resolveu |
| **Pixel na tela** | **125 ms** | dois quadros reais depois |
| **Atraso render → pintura** | **31 ms** | a distância que a ponte escondia |

Tinta 99,6% do canvas (612×792), elemento dentro da viewport.

**Os 31 ms são o número que faltava.** Eles não são grandes, e é
exatamente por isso que valia medir: a suspeita razoável era que
`getPage()`/render fossem um proxy aceitável para "a pessoa vê". Neste
caso são, com um atraso pequeno e constante. **Mas o valor só é
conhecido porque foi medido em janela visível** — nas execuções
anteriores, com a aba oculta, esse tempo não existia (a pintura nunca
acontecia) e a ponte de `rAF` produzia números que não correspondiam a
nada.

### 18.2.9-c Layout em viewport mobile — 375×812 confirmado de dentro

| | |
|---|---|
| Viewport pedida | 375×812 |
| **Viewport confirmada de dentro da página** | **`innerWidth: 375`, `clientWidth: 375`** |
| Instrumento | navegador automatizado com viewport controlada |

Três páginas da fixture, escolhidas para estressar o layout:

| Pág. | Orientação | Natural | Canvas | Cabe na largura | Proporção preservada |
|---|---|---|---|---|---|
| 1 | retrato | 612×792 | 375×485 | ✅ | ✅ |
| 2 | **paisagem** | 792×612 | 375×289 | ✅ | ✅ |
| 9 | retrato (arte sólida) | 612×792 | 360×465 | ✅ | ✅ |

**Sem estouro horizontal:** `scrollWidth` 360 = `clientWidth`. A página
**em paisagem no meio de um manual em retrato não quebra o layout** —
que era a pergunta real.

**Um falso defeito, encontrado e descartado.** A primeira execução
acusou `overflow_horizontal: true`, `scrollWidth: 454`. Antes de
registrar isso como defeito do visualizador, fui atrás do elemento
responsável: era o **`<pre>` de diagnóstico do meu próprio instrumento**,
cujo JSON tem tokens sem espaço e não quebrava linha. **Nenhum canvas
estourava.** Corrigi o instrumento, separei a medição do estouro *do
documento* da do *instrumento*, e repeti — daí os números acima. Fica
registrado porque quase virou um achado falso no relatório.

**Medição complementar, não de telefone:** uma execução em janela real de
Chrome ficou em **500×812**, porque o macOS impõe largura mínima de
janela em torno de 500 — 375 não é alcançável redimensionando janela. Ela
serve como **viewport estreita complementar**, e **não** como telefone:
500px pode atravessar breakpoints diferentes dos de 375. O número que
fecha o item é o de 375, obtido por emulação de viewport, que não sofre
esse limite.

**O que isto NÃO é:** aparelho físico. Continua valendo a fronteira
acordada — layout aproximado fecha na Fatia 0; **desempenho e memória em
aparelho real são portão da Fatia 1** (§18.2.10).

### 18.2.10 Memória: o que substitui a medição

A conclusão da limitação 3 é que **nenhum número de `performance.memory`
serve de prova** para memória de canvas. Em vez de perseguir um
instrumento melhor agora, a Fatia 1 passa a garantir por **construção**:

| Garantia | Por quê |
|---|---|
| **Quantidade limitada de canvases montados** | uma janela virtual pequena (a página visível e as vizinhas), nunca 743 |
| **Cancelar o render ao sair da janela** | já provado possível: `RenderingCancelledException` funciona (§18.2.9) |
| **`canvas.width = 0` e `canvas.height = 0` ao liberar** | é o que devolve o buffer; remover o elemento do DOM não basta |
| **Descartar as referências do PDF.js** (`page.cleanup()`, soltar a página) | o objeto de página guarda estruturas próprias, fora do canvas |
| **Nenhum cache ilimitado de bitmap** | cache de página renderizada precisa de teto por contagem E por pixels |
| **Teto de escala por PIXELS, não por zoom** | zoom 4× numa página A3 é ordem de grandeza diferente de 4× numa A5; o limite tem de ser área × densidade, não o multiplicador |

**A medição em aparelho físico vira portão de conclusão da Fatia 1** —
não impede o encerramento investigativo da Fatia 0.

**Plano de medição física (Fatia 1):** aparelho Android e iPhone reais,
manual completo, três exercícios — rolagem contínua da página 1 à 100,
salto para a 700 e volta, e zoom máximo seguido de liberação. Instrumento:
o painel de memória do próprio navegador (que **enxerga** buffer de
canvas, ao contrário de `performance.memory`), com leitura antes, no
pico e após a coleta. Critério objetivo: a memória depois da liberação
volta à faixa inicial, e o aplicativo não é descartado pelo sistema
durante os três exercícios.

### 18.2.7 Fixture sintética — e ela prova o defeito que a GE esconde

`scripts/gerar-fixture-visual.py` (novo, não commitado) gera
`e2e/fixtures/manual-visual.pdf`: **9 páginas, 11 KB**, no mesmo padrão
zero-dependência do gerador existente — nenhuma biblioteca, nenhum
binário versionado, nenhum material de terceiro.

Cobre os nove casos pedidos: retrato · paisagem · fotografia (XObject de
imagem) · imagem achatada de página inteira · vetor · diagrama com cotas
· **página sem texto extraível** · **tipografia convertida em curvas** ·
abertura em cor sólida. Mais um **índice declarado em três níveis**.

**O teste decisivo — rodei o pipeline de `6986fdb` contra ela:**

```
Páginas no PDF ............. 9
Páginas em alguma seção .... 6
PÁGINAS PERDIDAS ........... 3   (páginas 4, 7 e 8)
Ignoradas .................. 3   todas com motivo "sem-texto"
```

**As três páginas perdidas são exatamente as três de identidade visual
pura:** a imagem achatada de página inteira (4), a arte em vermelho
sólido sem texto (7) e o "G" desenhado em curvas (8).

Isto é o que a §17.1 antecipou e agora está provado: **o manual real da
GE não expõe este defeito** (743 de 743 páginas têm texto), e **a fixture
expõe em 9 páginas**. Sem ela, o CI não teria como reprovar a regressão.

**Dois achados adicionais, que a fixture revelou de graça:**

1. **A hierarquia do índice é destruída.** `lerOutline` lê a árvore
   corretamente — Basic Standards › Photography › Flattened artwork, três
   níveis — e `agrupar` devolve **6 seções planas**, sem pai, sem
   profundidade. É a §5.4 demonstrada: não é "profundidade demais", é
   achatamento.
2. **O índice aponta para uma página que foi descartada.** O nó
   "Flattened artwork" tem destino na página 4 — que sumiu. A navegação
   declarada referencia conteúdo que o produto jogou fora, e ninguém
   avisa.

Também apareceu uma colisão de título: "Basic Standards" surge duas
vezes (uma pelo outline, outra pela detecção de heading na página 9),
que hoje vira sufixo numérico no slug — anotado para a curadoria.

---

## 18.3 Fatia 1 — plano executável

**Escrito depois da aprovação da Fatia 0, a partir do que ela mediu.**
Nada aqui está iniciado. A ordem não é preferência: ela sai da regra que
a própria Fatia 0 estabeleceu — **decidir o transporte antes de construir
a interface que depende dele.**

### 18.3.0 Etapa A — transporte publicado com Range (ANTES da interface)

Construir o visualizador antes de saber como os bytes chegam seria
apostar a interface inteira numa hipótese não verificada (§19.2.3).

**A.1 — Fechar a investigação inconclusiva (§19.2.1, item 1).**
Perguntar ao suporte do Supabase se `Access-Control-Expose-Headers` é
configurável no plano hospedado; procurar no painel e na API de
gerenciamento; testar se um domínio próprio à frente do Storage muda a
resposta. **Se a resposta for sim, a rota deixa de ser necessária** e
todo o resto desta etapa encolhe. É a pergunta mais barata e a de maior
alavanca — por isso vem primeiro.

**A.2 — Avaliar a camada de borda (§19.2.1, item 2).** O Storage já está
atrás do Cloudflare. Um worker de borda que só acrescente o cabeçalho e
repasse o fluxo resolve o CORS **sem o PDF atravessar a aplicação** —
sem teto de 4,5 MB, sem duração de função, sem custo de CPU da Vercel.
Comparar contra a rota antes de escolher.

**A.3 — Rota mínima publicada**, só se A.1 e A.2 não resolverem. Requisitos
que **nascem com ela**, não depois:

| Requisito | Por quê |
|---|---|
| **Exige `Range`** — sem intervalo, redireciona ou recusa | o teto de 4,5 MB proíbe servir o arquivo inteiro (§19.2.1, item 4) |
| **Autoriza antes do primeiro byte** | resolve sessão, conta e marca antes de tocar no Storage |
| **Resolve o caminho no servidor** | recebe o id do documento-fonte, nunca um caminho do cliente — a sonda aceita `?u=` e é o contra-exemplo |
| **Confere conta e marca no caminho** | mesma disciplina de `pertenceAMarca` (`caminhos.ts`) |
| **Cancela a origem no abandono** | senão continua baixando o que ninguém vai ler, pagando banda e duração |
| **Repassa `206`, `Content-Range`, `Accept-Ranges`, `ETag`** | são o que o navegador precisa VER (§18.2.8) |

**A.4 — Medir no ambiente publicado**, que é o único que vale:

- a sequência inteira de Range atravessando a borda da Vercel — não uma
  requisição, as onze;
- `206` e `Content-Range` chegando **intactos** ao JavaScript;
- o teto de 4,5 MB na prática, com resposta de 64 KiB **e** com uma
  tentativa de arquivo inteiro, para ver o erro real;
- **arquivo próximo de 100 MiB** — 11,3 MiB não estressa duração,
  memória nem contagem de requisições;
- cancelamento por abandono real;
- duração, concorrência e custo.

**A.5 — Decidir o transporte definitivo**, com os números de A.4 na mesa.
**Só depois disso a Etapa B começa.**

### 18.3.1 Etapa B — visualizador canônico

Com o transporte decidido, e herdando o que a Fatia 0 já provou:

- **Range obrigatório** (§19.2.2) — 5 s contra 64 s em rede móvel;
- **virtualização** com janela pequena de canvases montados, e as seis
  garantias estruturais de memória (§18.2.10) — cancelar ao sair da
  janela, `width/height = 0` ao liberar, descartar referências do
  PDF.js, nenhum cache ilimitado, teto por **pixels** e não por
  multiplicador de zoom;
- **cancelamento de render fora da viewport** — já provado funcionar
  (`RenderingCancelledException`);
- **renovação da URL sem perder posição** — a expiração devolve
  **400**, não 401/403, então o cliente precisa reconhecer esse código;
  a restauração de página, zoom e rolagem já foi medida funcionando;
- **camada de texto do PDF.js**, para acessibilidade, seleção e busca
  nativa — sem ela o canvas é opaco para leitor de tela (§19.3);
- zoom, rotação, miniaturas, navegação por página, tela cheia;
- **mobile mantém o layout original**, com zoom e deslocamento — nunca
  remontagem (§3.1).

### 18.3.2 Portões de conclusão da Fatia 1

Além dos doze critérios da §21, três específicos:

| Portão | Por quê |
|---|---|
| **Aparelho físico** (Android e iPhone) | `performance.memory` não vê buffer de canvas; emulação não tem CPU, GC nem descarte de aba de telefone |
| **PDF grande** (~100 MiB) | a fixture prova geometria, não comportamento em escala |
| **Rota publicada** | localhost não tem teto de 4,5 MB, borda, duração nem concorrência |

### 18.3.3 Uma dependência que a exclusão do PDF criou

A §18.2.5 escolheu quatro páginas da GE — **730** (abertura), **197**
(fotografia), **372** (diagrama), **630** (texto) — para comparação lado
a lado com o visualizador. Essa comparação era item da Fatia 1, e **o
arquivo foi excluído** (§18.2.0).

**Isto eu deveria ter levantado no momento da exclusão, e não levantei.**
A autorização foi concedida e cumprida corretamente; a consequência para
a Fatia 1 é que a comparação precisa de um manual real — o mesmo PDF da
GE reenviado por você, ou outro manual equivalente. Os sinais medidos das
quatro páginas continuam registrados na §18.2.5, então a escolha não se
perdeu; o material de comparação, sim.

**Sobras locais a decidir:** a medição deixou em `/tmp` uma cópia do PDF
(`ge.pdf`, 11,3 MiB) e oito páginas renderizadas (`ge-cand/*.jpg`). São o
mesmo material de terceiro, fora do repositório e fora do Storage, e
somem num reinício da máquina. **Decisão sua:** apagar agora, mantendo a
coerência com a exclusão; ou reter deliberadamente para a comparação da
Fatia 1, e nesse caso preencher o registro de retenção (§18.2.0) com
finalidade, prazo e responsável. **Não apago nem retenho por conta
própria.**

---

## 19. Riscos técnicos e conflitos — meu parecer

A §19 da diretriz me obriga a dar parecer, não só executar. Segue.

### 19.1 Servir um PDF de 743 páginas é o maior risco do plano

A Fatia 1 depende de coisas que ainda não foram verificadas neste
projeto:

- **Tamanho.** Um manual desse porte tem tipicamente dezenas a centenas
  de MB. Carregamento progressivo exige que o servidor honre
  *requisições de intervalo* (range requests); se a URL assinada do
  Storage não honrar, o navegador baixa o arquivo inteiro antes da
  primeira página — e no mobile isso é inviável.
- **Memória no mobile.** Virtualização é obrigatória, não otimização.
- **Recomendação:** a Fatia 1 começa por uma **sondagem técnica curta** —
  verificar range requests na URL assinada e medir o tempo até a
  primeira página com o PDF real — **antes** de construir o
  visualizador. Se a sondagem falhar, a alternativa (servir por rota
  própria com suporte a intervalo, ou pré-fatiar o PDF) muda o desenho
  da fatia, e é melhor descobrir isso na primeira semana.

### 19.2 Ver o PDF e baixar o PDF — decisões aprovadas, e o limite honesto

**Aprovado (04/09):**

1. **Visualizar e baixar são permissões distintas**, desde o início —
   retrofitar essa distinção depois é caro.
2. **`member` pode visualizar o manual** das marcas a que tem acesso. A
   política de leitura passa a alcançá-lo; é mudança de segurança e
   merece o mesmo cuidado da §14.3.

**A ressalva que o produto precisa respeitar, na engenharia e na
linguagem:**

**Não se promete proteção absoluta contra download.** Se o navegador
consegue mostrar todas as páginas, os dados necessários chegaram ao
dispositivo e podem ser recuperados ou capturados. Qualquer promessa
contrária é falsa, e uma agência técnica percebe isso na primeira
pergunta.

O que a plataforma **pode** fazer, e fará:

- não oferecer botão de download;
- autorizar por usuário, workspace e marca;
- responder por URL curta e expirada, ou por rota controlada;
- usar Range Requests, servindo só o que a leitura precisa;
- registrar auditoria de acesso;
- servir com `Content-Disposition: inline`;
- aplicar marca d'água quando necessário.

**A linguagem do produto é "download não autorizado" ou "download não
oferecido" — nunca "impossível baixar".** Isso vale para a interface,
para a documentação e para a conversa comercial.

**Medido na sondagem (§18.2.2), e muda o entendimento:** a URL assinada
**não traz `content-disposition` nenhum** — o comportamento fica a
critério do cliente. Acrescentar `&download=` faz o Storage responder
`content-disposition: attachment`. Ou seja, **o parâmetro é a alavanca
do download autorizado**, e a ausência dele não é "inline garantido", é
"o navegador decide".

E há uma consequência que simplifica: **com PDF.js, a URL nunca é
navegada** — os bytes são buscados por intervalo e pintados em canvas.
Para o caminho de leitura, `content-disposition` é irrelevante. Ele
importa em um lugar só: o botão de download autorizado, onde `&download=`
é justamente o que se quer.

**A distinção comercial permanece não resolvida pela tecnologia.** A URL
assinada direta continua sendo a candidata por desempenho, e ela **não**
separa "ver" de "baixar" por si: quem vê o documento inteiro recebeu os
bytes inteiros. O que dá para fazer — e é o que o produto fará — é
controlar o botão, autorizar por usuário/conta/marca, encurtar a
validade, auditar acesso e marcar d'água. A escolha final entre URL
direta e rota intermediária fica condicionada às **medições de
navegador**, à **auditoria por acesso** e à **renovação de sessão**.

### 19.3 Acessibilidade não sai de graça do canvas

Uma página renderizada em canvas é opaca para leitor de tela. O PDF.js
oferece uma camada de texto sobreposta que devolve seleção, busca nativa
do navegador e leitura assistiva. **Recomendo habilitá-la desde a Fatia
1** — e, onde o PDF não tiver texto (páginas em curvas), a camada
semântica (§3.2) é a única alternativa acessível, o que dá à Fatia 2 um
papel que não é só de busca.

### 19.4 A citação da IA precisa de endereço no documento

`brand_chunks` guarda trechos para recuperação. Para a §15 cumprir
"citações incluem documento, status e páginas" com destino clicável, o
trecho precisa carregar o **número de página** — que o manifesto (§5)
passa a garantir. Vale confirmar na Fatia 2 que essa ligação existe de
ponta a ponta, em vez de descobrir na Fatia 9.

### 19.5 Custo de Storage muda para melhor

A arquitetura anterior geraria um PNG de alta resolução por página
visual — dezenas a centenas de MB por marca. A nova guarda **o PDF (que
já está lá) mais miniaturas pequenas**. É mais barato, mais rápido de
importar, e some com a maior fonte de falha de upload da §5.

### 19.6 A Fatia 2 é, em parte, trabalho já feito

Texto, índice, títulos, procedência, busca e recuperação já existem. A
Fatia 2 é sobretudo **acrescentar o manifesto, corrigir o descarte de
páginas sem texto e ligar a semântica ao visualizador** — não construir
a camada do zero. Dizer isso agora evita que ela seja orçada como se
fosse.

### 19.7 O tema da marca perdeu seu principal consumidor

Com o manual sendo o PDF, o `theme` deixa de pintar o conteúdo
importado. Ele continua necessário (páginas nativas, versões
gerenciadas, contexto de marca no Guia), mas **a tela de edição de tema
da Fase 1a passa a prometer mais do que entrega** enquanto não existirem
páginas nativas. Recomendo que a Fatia 4 deixe isso explícito na
própria interface, em vez de deixar a agência achar que está pintando o
manual.

---

## 20. Decisões

### 20.1 Aprovadas em 04/09

| # | Decisão | Onde |
|---|---|---|
| 1 | **Manifesto por página em tabela própria** | §5.2 |
| 2 | **Representação publicada como referência explícita** a original, gerenciada ou nativa | §9 |
| 3 | **Visualizar e baixar o documento-fonte são permissões distintas** | §19.2 |
| 4 | **`member` pode visualizar o manual** quando tem acesso à marca | §19.2 |
| 5 | **Material real da GE não entra no Git sem autorização expressa** — fixture automatizada sintética; o PDF real serve só ao teste manual local | §17.1 |
| 6 | **A correção do `comAlvo` pode ser commitada isolada**, com o módulo e o teste, após verificação | §18.1 |
| 7 | **O PDF é documento-fonte durável e versionado** — desenho de `brand_source_documents` apresentado, não implementado | §5.3 |
| 8 | **A Fatia 0 não implementa o manifesto** — contrato, sondagem e linha de base; nenhuma migração | §18.0 |

**Ressalva registrada junto com a decisão 3:** não se promete proteção
absoluta contra download (§19.2). A linguagem do produto é "download não
autorizado" ou "não oferecido" — nunca "impossível baixar".

### 20.2 Ainda em aberto

**Dependem de medição, e por isso não podem ser decididas agora:**

1. Limiares do classificador (§6) — calibrados na Fatia 0/3.
2. Estratégia de entrega do PDF (§19.1) — **é o que a sondagem da Fatia
   0 responde**: URL assinada direta ou rota de servidor com Range.
3. Custo de Storage e tempo de importação reais — Fatia 1.
4. Onde o arquivo do documento-fonte mora fisicamente (§5.3) —
   recomendo promover no lugar, sem cópia; confirmar com o número de
   custo na mão.

**Registrado como fora de escopo desta rodada:**

10. **Assets "autorizados"** (§12.1) — "autorizado para consulta"
    pressupõe autorização por asset, que não existe: `brand_assets` tem
    `status`, não visibilidade. Continua em aberto.
11. Curadoria destrutiva — unir seções publicadas decide o destino de
    dois históricos e das citações emitidas.
12. Reconstrução automática de layout em blocos — o editor visual
    (Fatia 10) é a resposta, e ela é progressiva.

---

## 21. Critérios para uma fatia ser candidata a conclusão

Doze, todos obrigatórios:

1. teste automatizado;
2. **prova de que o teste falha com a regressão** — a regressão injetada
   de propósito, confirmando que o teste certo fica vermelho;
3. teste com dado real;
4. fluxo executado pela interface;
5. números antes e depois;
6. evidência visual;
7. **desktop e mobile**;
8. declaração do que **não** foi testado;
9. CI verde;
10. ausência de regressão de segurança;
11. sujeito de teste preservado;
12. **recomendação técnica honesta do implementador** — o que considero
    correto, o que considero incompleto, riscos, limitações, e se
    recomendo ou não a aceitação.

**"Código implementado", "testes verdes" e "deploy saudável" não são
sinônimos de "produto concluído".** A declaração final de aprovação é
sua, depois de ver as evidências.
