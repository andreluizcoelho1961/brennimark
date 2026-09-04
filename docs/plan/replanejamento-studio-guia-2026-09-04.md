# Replanejamento — Fase 1g, Studio e Guia

**Documento para revisão. Nada aqui foi construído.** A implementação da
Fase 3 (divisão de rotas) está **pausada como WIP não commitado** —
`git status` mostra **14 arquivos: 10 modificados e 4 novos**, `HEAD` em
`6986fdb`. Destes, **13 são o WIP da Fase 3**; o décimo quarto é este
documento, que é commitado sozinho, sem nenhum arquivo do WIP junto.
Depois desse commit, o WIP volta a ser 13 (10 modificados + 3 novos).
Nada foi descartado.

Este documento existe porque a entrega anterior foi apresentada como mais
pronta do que estava. O que segue começa reconhecendo isso em números, e
só depois replaneja.

---

## 0. O que foi afirmado, e o que era verdade

| Afirmei | Era |
|---|---|
| "Fase 1g ✅ concluída" | O código roda; a imagem que ele produz aparece **recortada** numa caixa 4:5, dentro de uma coluna de 5/12 da tela. Nunca foi vista numa importação real. |
| "Deploy verificado ao vivo" | Verifiquei que a **tela de login carrega sem erro de console**. Isso não é verificação de funcionalidade nenhuma. |
| "250/250 e2e passando" | Verdade, e irrelevante para o mérito: nenhum desses testes importa um PDF real nem olha uma imagem renderizada. |
| "Limite reconhecido: falta teste com PDF real" | Reconhecido no plano, e mesmo assim marquei a fase como concluída. Reconhecer um limite não é o mesmo que respeitá-lo. |
| Apaguei a GE | Apaguei **o único sujeito de teste existente** antes de haver qualquer medição depois/antes. A remoção foi pedida e está correta; a ordem foi minha e estava errada. |

**Regra que sai daqui, e que a §9 formaliza:** uma fase não é concluída
por código verde. É concluída por evidência observada sobre dado real, e
quem declara isso não sou eu.

### Os doze bloqueadores, mapeados

| # | Bloqueador | Onde está | Seção |
|---|---|---|---|
| 1 | Imagem recortada, não fiel | `DocPage.tsx:78-79` | §1.1 |
| 2 | Classificação não mede dominância visual | `secoes.ts` `ehVisualDominante` | §1.2 |
| 3 | Só a primeira página da seção | `BrandImporter.tsx` `publicar()` | §1.3 |
| 4 | Classificação invisível e incorrigível na prévia | `ListaDeSecoes.tsx` | §1.4 |
| 5 | Falha de upload aceita em silêncio | `BrandImporter.tsx` | §1.5 |
| 6 | Página sem texto desaparece | `secoes.ts:271,289` | §1.6 |
| 7 | Tema cinza genérico; editor manual ≠ identidade | `BrandImporter.tsx` `TEMA_INICIAL` | §1.7 |
| 8 | GE removida antes da evidência | — | §2 |
| 9 | Gestão de assets não pode viver no Guia | `AssetLibrary`/`biblioteca` | §3 |
| 10 | Papel `editor` precisa existir antes | `workspace_members.role` | §4 |
| 11 | Sem assistente/curadoria/identidade não é "Studio/Guia" | escopo | §7, §8 |
| 12 | Studio não é o mesmo shell com outro menu | `AppShellV2` | §3, §5, §6 |

**Segunda rodada de revisão (04/09), incorporada:** contagem do worktree
corrigida (§0); etapa obrigatória de direção visual criada (§6);
manifesto por página criado como prova de preservação (§1.8);
classificador revisto para medir o raster renderizado, com
`operatorList` só como auxílio (§1.2); extração de fonte separada de
detecção de fonte, por licença (§1.7); assistente corrigido de "quatro
modos" para três intenções com um compositor (§7); `editor` × `aprovar`
transformado em decisão consciente (§4.1.1); prognóstico honesto do WIP
em vez de presunção de aproveitamento (§8.1); e a medição da linha de
base amarrada a uma referência separada em `6986fdb` (§2.2).

---

## 1. Correção da Fase 1g

A Fase 1g partiu de uma premissa boa (páginas art-direcionadas viram
imagem fiel) e errou em seis pontos independentes. Os seis se corrigem
juntos ou nenhum vale — uma imagem fiel de uma página que foi descartada
antes de chegar ao classificador não existe.

### 1.1 A imagem tem de ser a página inteira, sem recorte

Hoje: `aspect-[4/5]` + `object-cover` + coluna `md:col-span-5`. Uma
página A4 retrato (~1:1,41) dentro de uma janela 4:5 com `object-cover`
perde as bordas superior e inferior — exatamente onde vive a marca
d'água, o número de página, a assinatura e boa parte da arte de uma
página de abertura. E ainda que não recortasse, 5/12 da largura numa
página cujo conteúdo É a imagem é a hierarquia invertida.

**Correção, em três partes:**

1. **Distinguir dois tipos de imagem.** Hoje `DocPageEntry.images` serve
   a dois propósitos que não têm o mesmo tratamento visual: *referência*
   (mockup, foto de aplicação, ilustração ao lado do texto — a caixa 4:5
   é adequada) e *fac-símile de página de origem* (a página do PDF
   inteira — recorte é sempre erro). Os dois passam a ser distinguíveis
   no dado, com um tipo explícito por item, não por convenção implícita.
2. **Guardar as dimensões naturais** (largura e altura em pixels) no
   momento da renderização. Sem elas, o navegador não sabe reservar a
   proporção certa e a página salta enquanto carrega; com elas, a imagem
   é exibida na proporção que tem, sem caixa que a force a outra.
3. **Layout próprio para página fac-símile:** largura total da coluna de
   leitura, proporção natural, `object-contain`, uma abaixo da outra em
   ordem de página. O texto que a página tiver (mesmo pouco) fica
   **acima ou abaixo** da imagem, não ao lado espremendo-a.

### 1.2 O classificador precisa medir dominância visual, não contar letras

Hoje: `< 300 caracteres` e `≤ 2 páginas`. Isso não mede nada visual —
mede brevidade. Uma página de citação com uma frase curta e fundo branco
passa; uma página de diagrama denso com 40 rótulos de medida reprova.

**A verdade é o que a página RENDERIZA, não o que ela declara.** Esta é a
correção central: a lista de operações do PDF (`operatorList`) parece a
fonte óbvia — "tem um operador de imagem, logo é página de imagem" — e
mente com frequência. Um operador de imagem pode estar sob uma máscara
que o esconde quase todo, recortado por um *clipping path* a um canto da
página, transformado a 2% do tamanho, ou desenhado com transparência
total sobre outro conteúdo. Um preenchimento "de página inteira" pode
estar coberto por um retângulo branco na operação seguinte. Contar
operações é contar intenções declaradas; nenhuma delas prova o que
aparece.

O raster já é produzido de qualquer forma (é ele que vira o fac-símile
da §1.1). Medir **uma miniatura em baixa resolução da própria página
renderizada** custa quase nada a mais e mede exatamente o artefato que
será exibido — depois de transformações, máscaras, recortes e
transparências, porque o rasterizador já as aplicou.

| Sinal | De onde vem | Peso | O que indica |
|---|---|---|---|
| Cobertura geométrica de texto | soma das caixas dos itens de texto ÷ área da página | **primário** | quanto da página é texto, com posição real |
| Tinta não-branca na miniatura | proporção de pixels que não são o fundo | **primário** | quanto da página é *alguma coisa* |
| Variedade cromática na miniatura | número de cores distintas relevantes / entropia | **primário** | fundo sólido de marca, fotografia, arte |
| Densidade de bordas na miniatura | transições de contraste por área | **primário** | diagrama, grade técnica, ilustração vetorial |
| Operadores de imagem / preenchimento | `operatorList` | **auxiliar** | pista de intenção; nunca decide sozinho |

A decisão passa a ser **por PÁGINA**, não por seção, e combina os sinais
primários: pouca cobertura de texto **e** muita tinta/cor/borda na
miniatura ⇒ visual-dominante. O `operatorList` entra como desempate e
como explicação para quem revisa ("esta página tem uma imagem grande"),
nunca como o voto único.

Os limiares são calibrados contra a GE reimportada (§2), não escolhidos
no escuro — e ficam registrados com o número que os justificou. A
confiança do classificador vai para o manifesto (§1.8), então uma
decisão de limiar passa a ser auditável página a página, em vez de ficar
só no julgamento de quem escreveu a regra.

**O classificador continua sendo heurística.** A diferença é que ele
passa a ser (a) medido contra um caso real antes de ser aceito, (b)
visível e corrigível por quem importa (§1.4). Heurística revisável é
ferramenta; heurística invisível é adivinhação.

### 1.3 Todas as páginas visuais da seção, não a primeira

Uma seção de abertura tem tipicamente duas páginas (espelho esquerda/
direita); um capítulo de aplicação tem seis a dez páginas de exemplo.
Renderizar só `inicioDe(secao)` entrega a primeira e some com o resto.

Com a classificação por página (§1.2), a regra fica direta: **toda página
classificada como visual dentro da seção vira imagem**, em ordem de
página. Uma seção mista (duas páginas de abertura + seis de texto)
produz duas imagens e o texto das outras seis — que é o comportamento
correto e hoje é impossível de expressar.

**Teto explícito:** um manual de 743 páginas majoritariamente visual
geraria centenas de imagens grandes. O teto (quantas páginas por seção,
quantas por importação, e o que acontece ao estourar) é decisão de custo
de Storage e de tempo de importação, e precisa ser **decidida com o
número real da GE na mão** (§2), não estimada agora.

### 1.4 A classificação aparece e se corrige na prévia

Hoje a prévia mostra título, faixa de páginas e método de detecção. A
classificação visual não aparece — a pessoa descobre o que virou imagem
**depois de publicar**.

A prévia passa a mostrar, por seção: quais páginas viram imagem, com
miniatura, e um controle para **incluir ou excluir cada página**. Mesma
disciplina que título e agrupamento já têm hoje: a máquina propõe, a
pessoa confirma antes de gravar. Sem isso, os limiares da §1.2 viram
uma decisão que ninguém consegue contestar.

Isso torna a prévia de importação uma tela de produto de verdade — não
uma confirmação. É a quarta wireframe (§5.4).

### 1.5 Falha de upload é dito, nunca engolido

Hoje: `if (envioDeImagem.error) continue;` — a seção publica sem a
imagem, e nada em lugar nenhum registra que ela deveria ter uma. O
manual fica silenciosamente incompleto, e a única forma de descobrir é
comparar com o PDF página a página.

Regra nova: **falha de imagem é visível e acionável.** A importação
lista as páginas que não subiram, com o motivo, e oferece repetir. Se a
pessoa optar por publicar mesmo assim, isso fica registrado no relatório
da importação — não vira ausência silenciosa. Nenhum caminho de código
transforma erro em omissão.

### 1.6 Página sem texto não desaparece — é a candidata mais forte

**Este é o defeito mais grave dos seis, e é estrutural.**

Em `secoes.ts:271`, toda página sem linha de texto útil entra em
`ignoradas` com motivo `sem-texto`. Em `secoes.ts:289`, as páginas de
cada seção saem de `comTexto` — ou seja, **uma página sem texto é
excluída do intervalo da própria seção que a contém**. E a prévia diz,
com todas as letras: *"Provavelmente são imagens. Elas não viram seção"*.

O produto identifica corretamente que aquilo é uma imagem — e usa essa
conclusão para descartá-la. Uma página de abertura em vermelho sólido
com tipografia script vetorizada, uma fotografia de página inteira, um
diagrama sem rótulo de texto extraível: são precisamente as páginas em
que a identidade visual da marca mais aparece, e são as únicas que o
importador garante jogar fora.

Isso também torna a procedência mentirosa: `sourcePageRanges` diz
"páginas 40–47" quando a seção na verdade cobre 40–49 e as duas sem
texto sumiram.

**Correção:** páginas sem texto passam a pertencer à seção cujo
intervalo as contém, contribuindo com zero linhas e sendo candidatas
naturais a imagem (§1.2 as classificará como visuais quase sempre —
pelo próprio critério, uma página sem texto tem cobertura de texto
zero). `ignoradas` deixa de significar "descartada" e passa a
significar apenas **página em branco de verdade** (sem texto E sem arte),
que é a única que não perde nada ao não ser preservada. O texto da
prévia muda junto: hoje ele descreve o defeito como se fosse critério.

### 1.7 Identidade visual não se resolve com um editor de cores

A Fase 1a entregou uma tela onde alguém digita hexadecimais. Isso é
necessário e não é suficiente: o `TEMA_INICIAL` continua sendo cinza
genérico, e toda marca importada nasce com a identidade da plataforma
até que alguém faça um trabalho manual que nada obriga a fazer. Uma
marca pode ser publicada, consultada e apresentada a um cliente inteira
em cinza.

**Duas mudanças, e as duas são necessárias:**

1. **Extração proposta pela importação — cor.** Com as páginas já sendo
   rasterizadas (§1.1), as cores dominantes são mensuráveis a partir dos
   próprios pixels — agrupando as cores mais frequentes e descartando
   os quase-neutros de fundo. Isso produz **candidatos**, apresentados na
   prévia como sugestão explícita ("estas cores aparecem em N páginas"),
   nunca como fato consumado — e sempre confirmáveis, editáveis ou
   recusáveis por quem importa. Cor de marca é decisão da marca; o que a
   máquina pode fazer é parar de exigir que alguém a descubra do zero.

   **Tipografia é outro caso, e a diferença é jurídica, não técnica.**
   Ler o NOME da família tipográfica embutida no PDF é legítimo e útil —
   é informação sobre a marca. **Extrair, hospedar ou reaplicar o arquivo
   de fonte embutido no PDF não é**, e o Brennimark não faz isso em
   nenhuma hipótese: a fonte embutida está ali sob uma licença de
   incorporação em documento, que não autoriza redistribuição nem uso
   como webfont de uma plataforma. Tecnicamente é possível; por isso
   precisa estar escrito que não se faz.

   O que o produto faz: **sugere a família detectada** ("este manual usa
   Helvetica Neue LT Pro") e a registra como informação da marca. Para
   que essa tipografia seja de fato aplicada no Guia, a agência **envia o
   arquivo licenciado** que ela tem direito de usar — o mesmo caminho de
   upload de asset que já existe. Sem arquivo licenciado, a marca usa a
   pilha de fontes que a agência declarar (webfont licenciada, fonte de
   sistema, ou uma substituta próxima), com o nome detectado visível ao
   lado como referência do que o manual original usava. A diferença entre
   "detectamos" e "aplicamos" fica explícita na tela, não implícita.
2. **Portão objetivo.** Uma marca com o tema padrão não pode ser
   apresentada como pronta. Enquanto a identidade não for confirmada por
   uma pessoa, a marca fica visivelmente em estado de preparo no Studio,
   e isso conta como pendência no portfólio (§5.1). O produto para de
   fingir que cinza é uma escolha.

**Fora de escopo, de propósito, e anotado:** reconstruir os layouts das
páginas (fundo sólido full-bleed, duas colunas imagem+texto, diagrama
com grade de medida) como blocos estruturados. A imagem fiel de página
resolve a fidelidade; a reconstrução em blocos é um sistema de layout
inteiro e merece seu próprio ciclo.

### 1.8 Manifesto por página — a única prova de preservação

`sourcePageRanges` **não prova preservação**, e a §1.6 mostra por quê:
ele lista as páginas que a seção conseguiu absorver, não as que existiam
no PDF. Uma página descartada não aparece em lugar nenhum como
descartada — ela simplesmente não é mencionada, e ausência silenciosa é
exatamente o que não se consegue auditar. Contar intervalos declarados é
contar o que sobreviveu segundo quem sobreviveu.

**Toda importação passa a produzir um manifesto com uma entrada para
CADA página do PDF de origem, de 1 a N, sem exceção.** Essa é a
propriedade que importa: se o PDF tem 743 páginas, o manifesto tem 743
entradas. Uma página não pode sumir sem que sua ausência tenha nome,
tratamento e motivo.

Cada entrada registra:

| Campo | O que é | Por que |
|---|---|---|
| `pagina` | número no PDF de origem, 1..N | a chave; sem ela não há cobertura verificável |
| `secao` | a seção a que a página pertence (ou nenhuma, explicitamente) | liga a página ao conteúdo publicado |
| `tratamento` | `text` · `facsimile` · `mixed` · `blank` · `excluded` | o que o produto FEZ com esta página |
| `confianca` | 0–1, do classificador (§1.2) | permite auditar limiares página a página |
| `dimensoes` | largura e altura naturais do render | sem elas o fac-símile é exibido na proporção errada (§1.1) |
| `upload` | `ok` · `falhou` · `nao-aplicavel`, com o erro quando falhou | torna impossível a falha silenciosa da §1.5 |
| `motivo` | por que foi `excluded` ou `blank` | uma exclusão sem motivo é uma exclusão sem responsável |

Os cinco tratamentos são exaustivos e mutuamente exclusivos:

- **`text`** — virou texto estruturado, sem imagem.
- **`facsimile`** — virou imagem fiel da página inteira (§1.1).
- **`mixed`** — tem texto extraído E imagem de página (o caso comum de
  uma abertura com uma frase).
- **`blank`** — sem texto e sem arte: nada a preservar. É o único
  descarte legítimo, e mesmo ele fica registrado.
- **`excluded`** — havia conteúdo e ele não entrou. Sempre com motivo
  (teto de imagens atingido, falha de upload não recuperada, decisão de
  quem curou na prévia). **Toda `excluded` é uma dívida visível**, não um
  detalhe de implementação.

**A cobertura passa a ser derivada do manifesto**, não de
`sourcePageRanges`: páginas preservadas = entradas cujo tratamento não é
`excluded` (e `blank` contabilizada à parte, porque preservar o nada não
é mérito). Isso torna a métrica mais importante da §2.3 — quanto do
manual sumiu — uma contagem direta, não uma inferência.

O manifesto também alimenta o painel da marca no Studio (§5.2): "741 de
743 páginas preservadas" deixa de ser um número calculado para uma
apresentação e passa a ser a leitura de um registro que existe.

**Isto é decisão de esquema, e precisa da sua confirmação.** A
recomendação é **uma tabela** com uma linha por página da importação, e
não um campo JSON dentro do relatório: a métrica de cobertura precisa
ser consultável e agregável por consulta (é a disciplina da §9 — número
apurado, não estimado), e um JSON de 743 entradas dentro de uma coluna
obriga a ler o documento inteiro na aplicação para responder "quantas
páginas ficaram de fora". Uma tabela responde isso com uma contagem, e
permite indexar por tratamento. O custo é uma migração aditiva a mais.

---

## 2. Protocolo de reimportação e comparação com a GE

Sem isto, nada na §1 pode ser declarado pronto. Este protocolo vem
**antes** de qualquer correção, porque é ele que produz a linha de base.

### 2.1 O sujeito de teste volta, e não some mais

A GE foi apagada corretamente (foi pedido), mas cedo demais. O PDF de
origem não está mais no Storage — a marca foi removida com a fila de
limpeza. **O arquivo precisa ser reimportado a partir da cópia local de
quem o tem**; a plataforma não o guarda mais.

A partir de agora, o sujeito de teste vive em dois lugares e nenhum
deles é o banco de produção:

- **Fixture versionada**: um recorte pequeno e representativo do manual
  (10–15 páginas cobrindo os quatro casos: abertura em cor sólida,
  fotografia de aplicação, diagrama técnico, página de texto corrido),
  no repositório, para os testes automatizados rodarem sempre.
  *Restrição de licença:* material de marca de terceiro **não entra no
  git**. Se o recorte da GE não puder ser versionado, a fixture é
  construída — um PDF sintético que reproduz os quatro casos com arte
  própria — e o manual real serve só ao teste manual da §2.2.
- **Importação real, manual**: o PDF completo, importado por uma pessoa,
  numa conta de laboratório, para as medições de §2.3.

### 2.2 A sequência da medição

1. **Antes:** importar o manual completo com o código **como está
   publicado**, a partir de uma **referência de git separada, criada em
   `6986fdb`** — não do worktree atual. O worktree tem 13 arquivos de WIP
   da Fase 3 (`caminhoDaMarca` já repontado para `/g/...`, entre outros);
   medir a partir dele mediria um estado que nunca existiu em produção e
   que ninguém aprovou. A linha de base tem de ser exatamente o que foi
   entregue. Publicar e registrar as métricas da §2.3 — inclusive com os
   defeitos, que é o que torna a comparação honesta.
2. Registrar **capturas de tela** de quatro páginas escolhidas antes de
   olhar o resultado: uma abertura de seção, uma de aplicação, um
   diagrama, uma de texto. Escolhidas pelo PDF, não pelo que ficou bom.
3. **Depois:** aplicar as correções da §1, reimportar o **mesmo
   arquivo**, e repetir exatamente as mesmas medições e as mesmas quatro
   capturas.
4. Publicar a comparação lado a lado. Se um número piorar, ele aparece
   junto — a tabela não é vitrine.

### 2.3 As métricas, todas verificáveis por consulta ou contagem

| Métrica | Como se apura | O que ela responde |
|---|---|---|
| **Cobertura de páginas** | manifesto (§1.8): entradas com tratamento ≠ `excluded` ÷ N | **quanto do manual sumiu** |
| Distribuição de tratamento | manifesto, contagem por `tratamento` | quanto virou texto, fac-símile, misto, branco, excluído |
| Exclusões com motivo | manifesto, agrupado por `motivo` | por que sumiu, e de quem é a dívida |
| Seções com título real vs. genérico | consulta em `brand_documents` (`title_method`, `title_confidence`) | a detecção de título melhorou? |
| Documentos com pelo menos uma imagem | consulta em `brand_documents` | a fidelidade visual existe? |
| Falhas de upload | manifesto, campo `upload` | §1.5 está mostrando? |
| Distribuição de confiança do classificador | manifesto, campo `confianca` | os limiares da §1.2 estão no lugar certo? |
| Tema: padrão ou confirmado | `brands.theme` vs. `TEMA_INICIAL` | §1.7 |

**A métrica que mais importa é a primeira**, e ela nunca foi medida:
quantas páginas do PDF original simplesmente não existem no manual
importado. Suspeita fundamentada, pelo defeito da §1.6: não é zero.

**Ressalva sobre a linha de base:** o código de `6986fdb` **não produz
manifesto** — ele nem sabe que a ideia existe. As três primeiras
métricas, na medição "antes", são reconstruídas a partir do que aquele
código deixa: `sourcePageRanges` publicado, `ignoradas` no relatório da
importação, e o total de páginas do PDF. Isso é suficiente para a
comparação (é justamente a diferença entre páginas do PDF e páginas
mencionadas que denuncia o descarte), e **a reconstrução tem de ser
apresentada como reconstrução** — não como se o "antes" e o "depois"
tivessem sido medidos pelo mesmo instrumento. A partir da fatia 1, os
dois lados passam a sair do manifesto.

### 2.4 Regra de retenção

O sujeito de teste **não é apagado enquanto a evidência do "depois" não
estiver registrada e aceita**. Apagar antes é o que aconteceu, e é o que
tornou impossível provar qualquer coisa sobre a 1g.

---

## 3. Arquitetura de informação — Studio e Guia

O ponto 12 está certo e é o mais fácil de errar: um menu diferente na
mesma moldura não é um produto diferente. Guia e Studio respondem a
perguntas distintas, e a hierarquia de cada um vem da pergunta.

- **Guia — "o que a marca manda fazer?"** Hierarquia de LEITURA. A
  unidade é a página do manual. Tudo que não ajuda a ler ou a citar sai
  da frente. Uma pessoa entra sabendo o que procura, ou perguntando.
- **Studio — "em que estado está o trabalho?"** Hierarquia OPERACIONAL. A
  unidade é a marca, e dentro dela a fila de trabalho. Uma pessoa entra
  para saber o que falta e agir sobre lotes de coisas, não sobre uma
  página por vez.

### 3.1 Mapa do Guia

```
/g/<conta>/<marca>              o manual: entrada
/g/<conta>/<marca>/<pagina>     uma página
/g/<conta>/<marca>/assets       acervo — consultar e baixar, nunca gerenciar
                                busca: ⌘K, em qualquer lugar
                                assistente: painel, em qualquer lugar
```

Quatro destinos. Nenhum instrumento de Studio aparece — nem
desabilitado, nem escondido por permissão: **ausente**, inclusive para
quem é dono da conta. Um dono que quer gerenciar assets vai ao Studio; o
Guia não muda de forma por causa de quem olha. Isso é o ponto 9, e ele
também simplifica: o acervo do Guia deixa de ter modo de gestão.

### 3.2 Mapa do Studio

```
/studio                              portfólio — todas as marcas da conta
/studio/<conta>/importar             importar manual
/studio/<conta>/<marca>              a marca: painel de estado
/studio/<conta>/<marca>/curadoria    fila de trabalho editorial
/studio/<conta>/<marca>/identidade   cor, tipografia, logo
/studio/<conta>/<marca>/assets       gestão do acervo
/studio/<conta>/equipe               pessoas e papéis
/studio/<conta>/ia                   provedores, uso e limites
```

A diferença de hierarquia em relação ao Guia é o que o ponto 12 pede: o
Studio tem um **nível de marca com painel próprio** (`/studio/<conta>/<marca>`),
que não existe no Guia — no Guia, entrar numa marca é abrir o manual. No
Studio, entrar numa marca é abrir um estado de trabalho, do qual
curadoria, identidade e assets são frentes.

### 3.3 O manual é um só

O Studio **não renderiza uma segunda cópia do manual**. Ao precisar ver
uma página como ela é, o Studio manda para o Guia. Duas telas que
precisam concordar para sempre divergem no terceiro mês.

O que o Studio tem, e o Guia não, é a *fila*: a lista de páginas com
estado editorial, filtros de qualidade e ações em lote. Isso não é o
manual — é o trabalho sobre o manual.

### 3.4 O que o Studio compartilha com o Guia, e o que não

Compartilham: tokens de design, componentes de base, a moldura da
plataforma (barra, foco, modal, atalhos), o renderizador de página, a
camada de recuperação. **Não compartilham** a navegação nem a estrutura
de níveis — Studio tem portfólio → marca → frente de trabalho; Guia tem
marca → página. Tratar isso como "mesmo shell, outro menu" foi o erro do
plano anterior.

---

## 4. Papel `editor` e matriz de permissões

Adiar isto foi recomendação minha, e estava errada pelo motivo que o
ponto 10 aponta: uma agência tem mais de uma pessoa, e a única forma de
alguém trabalhar num manual hoje é sendo dono da conta — com acesso a
faturamento, chaves de IA e exclusão de marca. Não existe "meio-termo"
possível, então na prática ou se dá tudo, ou não se dá trabalho.

O vocabulário de capacidades do produto (`consultar`, `editar`,
`aprovar`, `administrar`) **já foi desenhado para três níveis** — existe
até um teste afirmando que "editar não implica aprovar". Só o papel no
banco tem dois valores.

### 4.1 Os três papéis

| Papel | Quem é | Capacidades |
|---|---|---|
| `owner` | dono da conta na agência | consultar, editar, aprovar, administrar |
| `editor` | quem trabalha nos manuais | consultar, editar — **`aprovar` em aberto, ver §4.1.1** |
| `member` | cliente, equipe do cliente | consultar |

#### 4.1.1 `editor` pode aprovar? — decisão consciente, não herdada

A versão anterior deste documento deu `aprovar` ao `editor` de passagem,
numa linha de tabela. Isso é exatamente o tipo de concessão que não pode
ser feita por omissão: o vocabulário do produto separa `editar` de
`aprovar` de propósito — existe até um teste afirmando que "editar não
implica aprovar — é a separação que sustenta agência e dono da marca".
Usar a separação e depois conceder as duas juntas sem dizer nada anula a
razão de ela existir.

O que está em jogo, concretamente: `aprovar` é o ato de tirar uma página
do rascunho e publicá-la no Guia — o momento em que um texto passa a ser
**regra oficial da marca aos olhos do cliente**. Editar é trabalho
interno; aprovar é consequência externa.

| | `editor` **sem** `aprovar` (recomendado) | `editor` **com** `aprovar` |
|---|---|---|
| Fluxo | qualquer um da equipe trabalha; publicar exige um `owner` | qualquer um da equipe publica sozinho |
| Risco | gargalo: em agência pequena, o dono vira revisor obrigatório | uma pessoa júnior publica uma diretriz errada no guia oficial do cliente, sem segunda leitura |
| Reversibilidade | **conceder depois é trivial** (ampliar) | **retirar depois é regressão** para quem já usava |
| Encaixe no modelo | usa a separação como ela foi desenhada | torna `aprovar` decorativo até existir um quarto papel |

**Recomendação: `editor` NÃO recebe `aprovar` nesta fase.** O argumento
decisivo é o terceiro: ampliar permissão depois é indolor, restringir
depois quebra o trabalho de quem já contava com ela. Começar estreito
mantém a decisão reversível, que é a regra do projeto para tudo que
ainda não foi observado em uso real.

**O que dispara a revisão:** a primeira agência real relatando o gargalo
— ou seja, evidência de uso, não hipótese. Nesse momento a concessão é
uma linha no mapeamento de capacidades, sem migração.

**Esta é a única decisão em aberto da §4, e ela muda a matriz da §4.2.**
A matriz abaixo está escrita na recomendação; se você decidir o
contrário, duas linhas mudam (promover página e recuperar página
excluída).

### 4.2 Matriz de permissões

| Ação | owner | editor | member |
|---|---|---|---|
| Ler o manual no Guia | sim | sim | sim |
| Baixar asset no Guia | sim | sim | sim |
| Usar o assistente | sim | sim | sim (se a marca contratou) |
| Entrar no Studio | sim | sim | **404** |
| Importar manual | sim | sim | não |
| Curadoria: editar, unir, excluir página | sim | sim | não |
| **Promover página a publicada (`aprovar`)** | sim | **não** (§4.1.1) | não |
| Recuperar página excluída | sim | sim | não |
| Identidade: cor, tipografia, logo | sim | sim | não |
| Assets: enviar, substituir, remover | sim | sim | não |
| Provedores de IA: chave, roteamento, limites | sim | **não** | não |
| Equipe: convidar, mudar papel, remover | sim | **não** | não |
| Excluir uma marca | sim | **não** | não |
| Excluir a conta | sim | não | não |

A linha divisória do `editor` é deliberada: ele faz **todo o trabalho
editorial** e nenhum ato que gaste dinheiro, mude quem tem acesso,
destrua trabalho de forma irreversível — ou publique regra oficial ao
cliente sem segunda leitura (§4.1.1, decisão em aberto).

### 4.3 O que isso exige, e o que precisa ser decidido antes

Mudança de esquema, aditiva: acrescentar `editor` ao vocabulário de
`workspace_members.role`. Sinalizado conforme a regra do projeto —
aditiva e de baixo risco, mas é esquema.

O trabalho real não é esse: são as **políticas de RLS existentes**. Toda
política escrita hoje como `role = 'owner'` precisa de uma decisão
explícita, uma a uma — passa a aceitar `editor`, ou continua só `owner`?
A matriz da §4.2 é a resposta, mas cada política tem de ser lida,
mapeada e testada individualmente. As funções de escrita privilegiada
(publicação de importação, exclusão de marca, exclusão de asset,
configurações de IA) checam papel por dentro, além da RLS — e cada uma
tem de ser revista com a mesma matriz na mão.

**Sem teste automatizado por papel, isto não pode ser considerado
pronto**: um `editor` que consegue rodar a exclusão de marca, ou um
`member` que alcança qualquer rota de Studio, é uma falha de segurança,
não um defeito de navegação.

---

## 5. Quatro wireframes

Baixa fidelidade de propósito: o que está sendo decidido é hierarquia e
o que cada tela afirma, não estética.

### 5.1 Studio — portfólio

```
┌────────────────────────────────────────────────────────────────────┐
│ Brennimark · Studio          Agência Norte ▾      Importar   ◍ ana │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────────────────┐  ┌──────────────────────────┐        │
│  │ GE                       │  │ Padaria do Bairro        │        │
│  │ 743 págs · 122 seções    │  │ 24 págs · 18 seções      │        │
│  │                          │  │                          │        │
│  │ ████████░░░░░░░  46%     │  │ ███████████████ 100%     │        │
│  │ pronto para o cliente    │  │ pronto para o cliente    │        │
│  │                          │  │                          │        │
│  │ ⚠ identidade não definida│  │ ✓ identidade definida    │        │
│  │ ⚠ 68 títulos genéricos   │  │                          │        │
│  │ ⚠ 14 páginas sem imagem  │  │ Guia: ativo · 3 pessoas  │        │
│  └──────────────────────────┘  └──────────────────────────┘        │
│                                                                    │
│  ┌──────────────────────────┐                                      │
│  │  +  Importar um manual   │                                      │
│  └──────────────────────────┘                                      │
└────────────────────────────────────────────────────────────────────┘
```

O card afirma **estado de trabalho**, não nome. As três pendências são
as da §1.7 e da §2.3 — a mesma informação que a medição produz, no
lugar onde alguém decide o que fazer hoje. Um card que só mostra o nome
da marca não paga a tela que ocupa.

### 5.2 Studio — a marca (painel de estado)

```
┌────────────────────────────────────────────────────────────────────┐
│ Studio › GE                                    Ver no Guia ↗   ◍   │
├──────────────┬─────────────────────────────────────────────────────┤
│ GE           │  ESTADO                                             │
│  Painel      │  ████████░░░░░░░ 46% pronto · 66 de 122 seções      │
│  Curadoria   │                                                     │
│  Identidade  │  PRECISA DE DECISÃO                                 │
│  Assets      │  ┌───────────────────────────────────────────────┐  │
│              │  │ 68 seções com título genérico    → Curadoria  │  │
│ ───────────  │  │ Identidade não definida          → Identidade │  │
│ Portfólio    │  │ 14 páginas visuais sem imagem    → Curadoria  │  │
│ Equipe       │  │ 3 imagens falharam ao enviar     → Reenviar   │  │
│ Provedores   │  └───────────────────────────────────────────────┘  │
│              │                                                     │
│              │  ORIGEM                                             │
│              │  GE_ID000.pdf · 743 páginas · importado 04/09       │
│              │  741 de 743 páginas preservadas (2 em branco)       │
└──────────────┴─────────────────────────────────────────────────────┘
```

Esta tela é o ponto 12 em concreto: ela **não existe no Guia** e não é
uma versão editável do manual. É o estado do trabalho, com cada
pendência ligada à frente que a resolve. "741 de 743 páginas
preservadas" é a métrica da §2.3 virando produto — a agência vê o que o
importador fez com o material do cliente.

### 5.3 Guia — leitura, com o assistente

```
┌────────────────────────────────────────────────────────────────────┐
│ GE ▾                                        ⌘K Buscar        ◍     │
├──────────────────┬─────────────────────────────────────────────────┤
│ MANUAL           │                                                 │
│  Fundamentos     │   ┌───────────────────────────────────────┐     │
│   Princípio      │   │                                       │     │
│   Missão         │   │   página do manual, na tipografia     │     │
│  A marca         │   │   e na cor da GE                      │     │
│   Símbolo        │   │                                       │     │
│   Assinatura  ●  │   │   (página visual: fac-símile da       │     │
│  Cor             │   │    página do PDF, inteira, sem        │     │
│  Tipografia      │   │    recorte, na proporção original)    │     │
│  ...             │   │                                       │     │
│                  │   └───────────────────────────────────────┘     │
│ ──────────────   │                                                 │
│ Acervo           │                          ┌──────────────────┐   │
│                  │                          │ ✦ Perguntar      │   │
└──────────────────┴──────────────────────────┴──────────────────┴───┘
```

A coluna é **só o manual**, mais o acervo abaixo de um filete. Sumiram:
importar, curadoria, identidade, provedores, equipe. Some para todo
mundo, inclusive para o dono da conta.

### 5.4 Prévia da importação — onde a classificação se decide

```
┌────────────────────────────────────────────────────────────────────┐
│ Importar · GE_ID000.pdf · 743 páginas                              │
├────────────────────────────────────────────────────────────────────┤
│ 122 seções · 741 páginas preservadas · 2 em branco (descartadas)   │
│ Identidade sugerida:  ■ #E1251B  ■ #000000  ■ #FFFFFF   [revisar]  │
├────────────────────────────────────────────────────────────────────┤
│ ▾ Basic Standards                          págs 9–16   índice ✓    │
│   ┌────┐┌────┐                                                     │
│   │ 9  ││ 10 │  2 páginas viram imagem          [alterar seleção]  │
│   │IMG ││IMG │  6 páginas viram texto                              │
│   └────┘└────┘                                                     │
│                                                                    │
│ ▾ Páginas 17–24                            págs 17–24  intervalo ⚠ │
│   sem título no índice do PDF — revisar depois, na curadoria       │
│   ┌────┐                                                           │
│   │ 17 │  1 página vira imagem               [alterar seleção]     │
│   └────┘                                                           │
├────────────────────────────────────────────────────────────────────┤
│                          [ Criar a marca com estes rascunhos ]     │
└────────────────────────────────────────────────────────────────────┘
```

Esta tela é o §1.4 e boa parte do §1.7. Ela afirma três coisas que hoje
ficam invisíveis: quantas páginas do PDF sobrevivem, quais viram imagem
(com miniatura, corrigível), e qual identidade foi detectada. É a única
oportunidade de corrigir antes de gravar — e hoje ela passa em branco.

---

## 6. Direção visual — etapa obrigatória antes das interfaces

**As wireframes da §5 resolvem arquitetura de informação. Elas não
resolvem, e não tentam resolver, a identidade visual do Brennimark.** Um
retângulo ASCII decide o que fica onde e o que a tela afirma; não decide
tipografia, densidade, cor, ritmo, peso, movimento — nem o que faz o
produto parecer uma ferramenta profissional em vez de um formulário
administrativo. Ir das wireframes direto para o código foi o erro do
plano anterior em outra escala: lá se moveram rotas antes de existir
produto; aqui se desenharia produto antes de existir direção.

**Nenhuma fatia de interface (fatias 4 a 7, §8) começa antes desta etapa
ser aprovada.**

### 6.1 A tensão que esta etapa precisa resolver

O Brennimark hospeda marcas alheias. A regra já estabelecida é que a
moldura da plataforma é **neutra para não conflitar com a marca
hospedada** — cem por cento da preferência visual é da marca do cliente.

O erro fácil, e que o produto hoje comete, é ler "neutro" como "sem
desenho": cinzas, caixas, tipografia de sistema. **Neutro não é
genérico.** Ferramentas profissionais são reconhecidamente neutras em
relação ao conteúdo que hospedam e ainda assim têm carácter próprio,
inconfundível, que aparece no espaçamento, na tipografia da interface,
na densidade da informação e na precisão dos estados — nunca competindo
por cor com o conteúdo.

Essa é a pergunta central da etapa: **o que é a personalidade do
Brennimark, expressa em tudo que não é cor da marca hospedada?** Uma
agência não compra uma ferramenta que parece um painel administrativo.

### 6.2 Os cinco entregáveis, em ordem

**1. Semantic board.** As palavras antes das imagens: cinco a sete
atributos que o produto deve transmitir, cada um com o seu oposto
declarado (o que ele NÃO é), e a consequência de projeto que cada
atributo implica. Sem isso, o moodboard vira coleção de referências
bonitas sem critério para escolher entre elas, e a discussão de design
vira preferência pessoal.

**2. Moodboard.** Referências visuais reais — ferramentas profissionais,
editorial, sistemas de documentação — ancoradas nos atributos do
semantic board, com a razão de cada uma anotada. Referência sem
justificativa não sobrevive à primeira divergência de gosto.

**3. Dois conceitos concorrentes.** Não um. Duas direções visuais
genuinamente distintas — não variações de espaçamento da mesma ideia —
aplicadas à mesma tela real, para poderem ser comparadas. Um conceito
único apresentado sozinho sempre parece a única saída possível; dois
tornam a escolha uma decisão, com um perdedor explícito e o motivo dele
ter perdido registrado.

**4. Protótipos de alta fidelidade, desktop e mobile.** Do conceito
escolhido, sobre as quatro telas da §5 — portfólio, painel da marca,
leitura no Guia, prévia da importação — nas duas larguras. Mobile não é
o desktop estreito: a curadoria em lote e a prévia de importação são as
duas telas em que isso quebra, e é melhor descobrir no protótipo.

**5. Teste com quatro marcas visualmente opostas.** O produto renderiza
o conceito com quatro identidades hospedadas deliberadamente conflitantes
entre si (por exemplo: vermelho saturado sobre preto; pastel claro;
monocromático de alto contraste; uma paleta terrosa de baixo contraste).
**O critério é objetivo: a moldura tem de permanecer reconhecivelmente a
mesma, e nenhuma das quatro pode parecer quebrada, apagada ou em
conflito com a interface.** O projeto já tem a infraestrutura para isso
— existem fixtures de marcas opostas e um teste de moldura universal em
uso; a etapa os reaproveita em vez de inventar um método.

### 6.3 O que esta etapa produz para a implementação

Tokens de design revisados (cor da plataforma, tipografia da interface,
escala de espaçamento, densidade, estados), a especificação dos
componentes que Studio e Guia compartilham, e a definição de onde os
dois **deliberadamente divergem** — porque o §5 já estabeleceu que
Studio tem hierarquia operacional própria, e isso tem consequência
visual, não só de menu.

**Não é escopo desta etapa** redesenhar o renderizador de página do
manual: ele já é governado pela identidade da marca hospedada, e é o
único lugar onde a plataforma deve desaparecer por completo.

---

## 7. Escopo do assistente unificado

O ponto 11 está certo: chat, análise e histórico como três rotas
separadas é o mapa de funcionalidades da plataforma, não a experiência
de quem pergunta. Adiá-lo e ainda chamar a entrega de "Guia" seria
renomear rotas.

**Um botão, um painel, um compositor — e TRÊS intenções, não quatro
modos.** A versão anterior dizia "quatro modos" contando o histórico
como um deles. Histórico não é uma intenção: é **a própria conversa**,
rolando para cima. Contá-lo como modo é o mesmo erro de arquitetura que
transformou chat, análise e histórico em três rotas — confundir onde a
coisa fica registrada com o que a pessoa quer fazer.

As três intenções, todas atendidas pelo mesmo compositor:

| Intenção | Como a pessoa expressa | O que o assistente faz |
|---|---|---|
| **Consulta** | escreve uma pergunta | responde citando o manual, com procedência |
| **Análise de peça** | anexa uma imagem | avalia a peça contra as diretrizes da marca |
| **Geração de prompt** | pede um prompt (é uma frase, não um botão) | devolve um prompt fiel às diretrizes |

- **Um compositor só, sem abas.** Anexar uma peça muda o que o
  assistente faz; pedir um prompt é uma frase. Abas obrigariam a
  escolher a ferramenta antes de saber o que se quer — e são exatamente
  o que estamos removendo ao unificar três rotas.
- **Contextual à marca aberta.** Fecha ao trocar de marca e não carrega
  conversa da anterior.
- **O histórico é a conversa.** O registro completo e persistente, com
  calibração e avaliação de qualidade, continua existindo no Studio —
  que é onde se governa qualidade de resposta, não onde se pergunta.
- **Toda citação carrega procedência**: documento, estado editorial
  (inclusive rascunho), e faixa de páginas de origem.
- **Recusa honesta** quando não há evidência no manual, e mensagem de
  produto quando a IA não está configurada — nunca resposta inventada,
  nunca erro técnico na cara de quem pergunta.
- **Disponível no Guia** para quem consulta (é atividade de leitura), e
  no Studio pelas mesmas regras — a diferença é que o Studio também
  mostra o que ele respondeu para os outros.

O que **não** entra agora: geração de conteúdo de marca pelo assistente.
Ele responde sobre o manual e avalia peças contra ele. Escrever
diretriz nova é curadoria, e curadoria tem dono humano.

---

## 8. Fatias verticais de implementação

Cada fatia entrega algo demonstrável sobre dado real e termina com
evidência registrada. Nenhuma fatia é "infraestrutura para depois".

| # | Fatia | Entrega observável | Fecha |
|---|---|---|---|
| **0** | **Protocolo e medição do estado atual** | referência separada em `6986fdb` + medição "antes" da GE reimportada, publicada | §2 |
| **1** | **Fidelidade visual real** | mesma GE reimportada: manifesto por página, páginas sem texto preservadas, páginas visuais inteiras e sem recorte, classificação revisável na prévia, falhas visíveis | §1.1–1.6, §1.8, bloq. 1–6 |
| **2** | **Identidade da marca** | GE deixa de ser cinza: cor sugerida e família tipográfica detectada na importação, confirmadas por pessoa, portão que impede "pronto" com tema padrão | §1.7, bloq. 7 |
| **3** | **Papéis e permissões** | `editor` existe, matriz aplicada em RLS e nas funções, testado por papel | §4, bloq. 10 |
| **G** | **⛔ PORTÃO — direção visual** | semantic board, moodboard, dois conceitos, protótipos desktop/mobile, teste com quatro marcas opostas | §6 |
| **4** | **Studio: a marca** | painel de estado + curadoria com filtros de qualidade e ações em lote sobre seleção explícita | §5.1, §5.2, bloq. 11, 12 |
| **5** | **Guia como experiência** | rotas e navegação separadas, acervo só consulta/baixa | §3.1, §5.3, bloq. 9 |
| **6** | **Assistente unificado** | um painel, um compositor, três intenções, citação com procedência | §7, bloq. 11 |
| **7** | **Assets e equipe no Studio** | gestão de acervo e convite/papel de pessoas | §3.2, §4 |

**A ordem importa e não é a anterior.** O plano pausado começava pela
fatia 5 (mover rotas) — mexer no endereço de telas cujo conteúdo ainda
está errado. Fidelidade e identidade vêm antes porque são o que o
produto promete; a divisão de interfaces vem depois porque ela organiza
o que já precisa estar certo.

**As fatias 0 a 3 não dependem do portão visual** — elas são importação,
dado e permissão, sem tela nova de produto (a prévia de importação da
fatia 1 é uma tela existente ganhando informação, não uma interface
nova). **As fatias 4 a 7 são as interfaces, e nenhuma começa antes do
portão G ser aprovado.**

### 8.1 O que acontece com o WIP pausado

**Ele não é descartado, e também não é presumido aproveitável.** A
afirmação anterior — "é a maior parte da fatia 5" — era otimismo, não
avaliação. A separação honesta:

| Parte do WIP | Prognóstico |
|---|---|
| `rotas-antigas.ts` + teste (mapeamento velho→novo) | **provavelmente sobrevive** — é lógica pura de endereço, independente de desenho |
| `caminhoDaMarca` / `caminhoDoStudio` + testes | **provavelmente sobrevive** — depende da IA da §3, que está aprovada |
| Correção do `comAlvo` + teste | **sobrevive** — é correção de defeito real, independente de tudo isto |
| `resolverWorkspaceAtivo` com filtro de donos | **provavelmente sobrevive** |
| `shellSections` sem a seção "Conta" | **a reavaliar** — depende da navegação que o portão G definir |
| `studioSections` | **a reavaliar** — a navegação do Studio é justamente o que o portão G decide |
| Remoção do `foraDaMarca` | **a reavaliar** — consequência da navegação anterior |
| Atualizações de teste de navegação | **a reavaliar** junto com o que elas testam |

Ou seja: os *helpers* de rota e as correções de defeito tendem a
sobreviver; **moldura e navegação voltam à mesa depois da aprovação
visual**, porque decidir menu antes de decidir direção visual é
exatamente a inversão que este replanejamento corrige. O WIP fica
parado, sem commit, até a fatia 5 — e o que dele for aproveitado será
decidido lá, item a item, não agora.

---

## 9. Critérios objetivos para uma fase ser chamada de concluída

Aplicáveis a toda fatia da §8. **Uma fase que não atenda a todos não é
concluída — é "em revisão", e é assim que deve ser relatada.**

1. **Teste sobre dado real, não sobre fixture apenas.** Um manual de
   verdade, importado de ponta a ponta pela interface, num navegador. O
   teste automatizado é condição necessária e nunca suficiente.
2. **Números antes e depois**, pelas métricas da §2.3, apurados por
   consulta ou contagem — nunca por estimativa, nunca por amostra
   escolhida depois de ver o resultado.
3. **Evidência visual** das quatro páginas escolhidas *antes* da medição
   (§2.2), lado a lado.
4. **O que piorou aparece junto com o que melhorou.** Se uma métrica
   regrediu, ela está na mesma tabela.
5. **O que NÃO foi verificado é declarado explicitamente**, com o
   motivo. "Não testei X porque não tenho Y" é um resultado legítimo;
   omitir é o que não é.
6. **Teste automatizado que falha se a regressão voltar**, e a prova de
   que ele falha — a regressão injetada de propósito, confirmando que o
   teste certo fica vermelho.
7. **O sujeito de teste sobrevive** até a evidência estar registrada e
   aceita (§2.4).
8. **Quem declara concluído é quem pediu, vendo a evidência.** Eu
   apresento o resultado e o que ficou de fora; a palavra "concluída" não
   é minha.

### 9.1 O que está autorizado a executar agora

**Somente a Fatia 0**, e nada além dela:

- criar uma **referência de git separada em `6986fdb`** (o WIP do
  worktree não é tocado, não é commitado e não entra na medição);
- reimportar o manual da GE por ali, pela interface, como uma pessoa
  faria — **isto depende de você fornecer o PDF**, que a plataforma não
  guarda mais;
- apurar e publicar as métricas da §2.3, com a ressalva de reconstrução
  já registrada lá;
- registrar as quatro capturas de tela escolhidas antes de medir (§2.2).

**Não autorizado nesta rodada:** refatoração de rotas, criação das
árvores `/g/**` e `/studio/**`, mudança de esquema, alteração do
classificador, ou qualquer retomada do WIP. Isso inclui não continuar a
migração de testes que ficou pela metade.

Este documento é commitado **sozinho**, sem nenhum arquivo do WIP junto
— sem `git add -A`, arquivo por arquivo.

---

## 10. O que este documento não decide

Registrado para não virar decisão por omissão:

**Decisões que precisam da sua palavra antes da fatia correspondente:**

1. **`editor` pode aprovar?** (§4.1.1) — recomendação: não, nesta fase.
   Muda duas linhas da matriz. Necessária antes da fatia 3.
2. **Forma de armazenamento do manifesto por página** (§1.8) —
   recomendação: tabela própria, uma linha por página, por ser a única
   forma de a cobertura ser apurada por consulta. É esquema. Necessária
   antes da fatia 1.
3. **Se a fixture pode conter material da GE** (§2.1) — decisão de
   licença, não técnica. Sem ela, a fixture é sintética. Necessária na
   fatia 0.

**Decisões que dependem de medição, e por isso não podem ser tomadas
agora:**

4. **O teto de imagens por importação** (§1.3) — depende do número real
   da GE, e o número não existe até a fatia 0.
5. **Os limiares do classificador** (§1.2) — calibrados contra a
   medição, não escolhidos agora.
6. **Custo de Storage e de tempo de importação** com centenas de imagens
   de página inteira por marca — mensurável na fatia 1, não antes.

**Registrado como fora de escopo, não esquecido:**

7. **Curadoria destrutiva** — unir duas seções já publicadas decide o
   destino de dois históricos e das citações já emitidas. Continua em
   aberto, como já estava.
8. **Reconstrução de layout em blocos** (fundo sólido, duas colunas,
   diagrama com grade) — anotado, fora de escopo, com ciclo próprio.
9. **Aplicação real de tipografia licenciada** (§1.7) — depende do
   arquivo que a agência tem direito de enviar; o produto sugere a
   família detectada e nunca extrai a fonte embutida no PDF.
