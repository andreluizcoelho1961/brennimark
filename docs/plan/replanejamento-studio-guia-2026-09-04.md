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

**Achado ao verificar o `comAlvo` em worktree limpo, e ele resolve a
tensão de licença:** as fixtures de PDF **não são versionadas** — são
geradas pelo script, e um checkout novo não as tem (quatro testes de
escala falharam por `mil-paginas.pdf` ausente até rodar o gerador). Ou
seja, **o padrão da casa já é "script versionado, binário gerado"**, que
é exatamente o que a decisão 5 pede: a fixture sintética entra como
código que a produz, não como PDF no repositório. Nenhum binário de
terceiro precisa ser versionado para o CI funcionar — e o CI precisa
gerar as fixtures antes de rodar e2e, como já faz.

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
