# Marco A — estado em 09/09/2026

**"Importo o PDF e vejo todas as páginas exatamente como no original."**

Este documento registra o que foi feito, o que foi medido, o que foi decidido
e o que continua aberto. Ele existe porque várias decisões desta rodada foram
tomadas em conversa e não estavam em lugar nenhum.

---

## 1. Decisões de André, 09/09

| # | Decisão | Consequência |
|---|---|---|
| 1 | **O visualizador vem antes do documento-fonte e do manifesto** | inverte a recomendação anterior; o motivo não é cronograma: enquanto o visual depender da extração, uma falha de heurística deforma o que o cliente vê |
| 2 | **A investigação de transporte é encerrada, não continuada** | a medição de §18.2.8 já respondia contra a URL assinada; A.1 e A.2 não reabrem |
| 3 | **Mobile é prioridade 2** | a plataforma é de tela grande; o *layout* mobile já está coberto por teste, o que fica adiado é memória em aparelho físico |
| 4 | **100 MB é requisito de produto; o protótipo usa o que o plano gratuito dá** | dois tetos separados no código, migração para Pro preparada e não improvisada |
| 5 | **Os manuais de demonstração vão para produção** | material público, usado como exemplo em demonstração a agências |
| 6 | **Aceite visual do manual original: aprovado** | "o manual original está ok", sobre o manual do Bradesco renderizado |

---

## 2. O que foi construído

- **Transporte** — rota de mesma origem, `GET|HEAD /api/documento-fonte/[id]`,
  com identificador de documento (nunca caminho de Storage), autorização antes
  do primeiro byte, repasse de `206`/`Content-Range`/`Accept-Ranges`/`ETag`,
  cancelamento no abandono, e `400` de assinatura vencida traduzido em `401`.
- **Visualizador** — PDF.js com virtualização por tabela de deslocamentos,
  camada de texto, zoom, ajuste à largura por página, miniaturas, campo de
  página, tela cheia, busca com destaque, links internos e retomada de posição.
- **Destino de produto** — "Manual original" é o primeiro item da área Manual,
  em `/w/<conta>/b/<marca>/docs/original`.
- **Suíte** — oito casos dirigindo o leitor em Chromium, WebKit e Firefox.

---

## 3. Medições, e não impressões

### 3.1 Fidelidade contra renderizador independente

Manual do Bradesco (47 páginas, 4,06 MiB), comparado contra `pdftoppm`
(poppler), na mesma largura de canvas.

| Página | Diferença média (0–255) | Pixels com diferença forte |
|---|---|---|
| 1 | 0,09 | 0,08% |
| 12 | 3,11 | 3,84% |
| 24 | 1,52 | 1,84% |
| 36 | 2,95 | 3,02% |
| 47 | 0,05 | 0,05% |

**A investigação das três do meio, porque o número sozinho não conclui.**
Reduzir a resolução em 2×, 4× e 8× não dissolveu a diferença — ela ficou em
3–5% em toda escala, o que exclui serrilhado. O mapa 8×8 mostrou diferença
espalhada por toda a página, nunca concentrada num elemento, com o vermelho de
fundo **idêntico ao byte** (204, 9, 47). E `pdffonts` fechou: as fontes estão
**embutidas** — `BradescoSans` em seis pesos, subsetada. Não há substituição.

**Conclusão:** layout, proporção, cor e a tipografia própria da marca estão
preservados; o que difere é rasterização de glifo entre dois motores, onde não
existe "o certo".

### 3.2 Escala

Fixture sintética de 1.000 páginas: **4 a 6 canvases montados**, saltos para
1, 437, 700 e 1000 caindo exatos, zero bytes extras ao revisitar páginas.

---

## 4. Os defeitos que só um manual real revelou

Nenhum foi pego por lint, tipos, 626 testes de unidade ou 252 de navegador.

| # | Defeito | Por que escapou |
|---|---|---|
| 1 | **413 impedia abrir QUALQUER manual acima de 4 MiB** | a primeira requisição do PDF.js vai sem `Range`, e o teto media o tamanho dela. A fixture de 340 KB passava por baixo |
| 2 | `304 Not Modified` virava `502` | só aparece no SEGUNDO carregamento |
| 3 | Uma URL assinada por intervalo, ~400 ms cada | invisível em teste; visível em 11 requisições |
| 4 | Layout em fluxo desloca a rolagem ao montar página | pedir a 700 entregava a 705, sem erro |
| 5 | `offsetTop` comparado com `scrollTop` | sistemas de coordenadas diferentes, separados pela altura do cabeçalho |
| 6 | O botão de **aumentar** zoom diminuía a página | vindo de "ajustar à largura", a escala efetiva era ~1,8 |
| 7 | O campo de página se remontava a cada rolagem | derrubava o foco de quem digita |

**Dois defeitos de processo, encontrados depois:**

- a decisão entre as duas mensagens de recusa por tamanho vivia dentro de
  `lerPdf`, testável apenas com um PDF de 100 MiB — ramo que ninguém testa;
- o `testMatch` do Playwright casava com o **nome do diretório**: como o
  worktree se chama `Brennimark-visualizador`, a palavra no padrão arrastou a
  suíte inteira para WebKit e Firefox. O CI não via, porque o diretório dele
  não contém a palavra — o mesmo commit dava resultados diferentes em máquinas
  diferentes.

**A lição, e ela custou caro:** fixture sintética prova geometria e escala.
Não prova comportamento. Os sete primeiros defeitos exigiam bytes reais.

---

## 5. Limites — produto contra instalação

Confirmado na documentação do Supabase, não presumido: **no plano Free o
limite global de arquivo não pode passar de 50 MB**, e o limite por bucket não
pode ultrapassar o global. A organização deste projeto está em `free`. O
painel confirma: *"Free Plan has a fixed upload file size limit of 50 MB"*.

| | Valor | Natureza |
|---|---|---|
| `TETO_DO_PRODUTO_BYTES` | 100 MiB | requisito, constante |
| `TETO_DO_PLANO_BYTES` | 50 MB | `NEXT_PUBLIC_TETO_DE_IMPORTACAO_MB` |

A recusa distingue os dois casos em texto: *"passa do limite da instalação
atual, **não do produto**"*. Dizer só "grande demais" faria uma agência
concluir que o produto não serve para manuais grandes, sobre um limite de
hospedagem provisório.

**Ao migrar para o Pro, dois passos, nenhum automático:** a variável na Vercel,
e uma migration nova subindo o bucket. O teto do Storage é estado do banco, e
estado do banco muda por migration versionada.

---

## 6. O que continua aberto

| Portão | Estado | De quem depende |
|---|---|---|
| Comparação visual lado a lado | **aprovado por André** | — |
| Chromium, WebKit, Firefox | **coberto por teste** | — |
| iPhone e Android físicos | aberto, **prioridade 2** | aparelhos |
| Manual de ~100 MiB | aberto | plano pago |
| Produção | aberto | merge do PR #14 |
| Bucket alinhado ao plano | migration escrita, **não aplicada** | decisão do proprietário |

**Ressalva de método:** as evidências visuais desta rodada são medições de DOM
e comparação de pixels. A captura de tela do painel de desenvolvimento não
respeitou a viewport emulada, e por isso não foi usada como prova.

---

## 7. 10/09 — o que produção mostrou, e localhost não podia mostrar

O manual do Bradesco abriu em produção e levou **60 segundos sem carregar**. O
campo de página mostrava `1 de —`: o total era desconhecido, ou seja, o
documento nunca abriu. A `main` estava verde, 285 testes de navegador nos três
motores passavam, e o manual abria em 2 segundos em localhost.

### 7.1 As duas causas, em ordem de descoberta

| # | Causa | Como apareceu |
|---|---|---|
| 1 | **Teto de fatia recusava com 413** em vez de aparar | o Bradesco tem 4,07 MiB, 70 KB acima do teto de 4 MiB; o PDF.js pede o documento inteiro num intervalo em algumas situações e recebia recusa |
| 2 | **A primeira requisição do PDF.js vai sem `Range`** | a rota repassava o arquivo INTEIRO por uma função da Vercel, que estoura a duração; corpo truncado, tentativa, repetição |

A segunda é a que explicava os 60 segundos. A primeira era real e foi
corrigida antes, sem resolver o sintoma — **duas causas no mesmo caminho, e
consertar uma deixou a outra intacta.**

### 7.2 A lição que vale além deste caso

**Todos os meus testes mediam a forma da RESPOSTA. Nenhum media a forma da
REQUISIÇÃO.**

Por isso 285 testes verdes conviviam com um produto que não abria em produção.
A requisição sem `Range` é inofensiva quando o servidor está na mesma máquina
e fatal quando há uma função com teto de duração no meio — e a diferença não
está em nada que a resposta contenha.

A invariante que passou a ser trancada não é de desempenho, que varia com a
máquina: é de **forma**. Nenhuma requisição sem `Range` sai do visualizador,
exceto `HEAD`, que não tem corpo.

### 7.3 Três correções que eu havia declarado prontas

- o **teto**: eu havia escrito que aparar "seria pior que recusar". O argumento
  estava invertido — aparar promete menos e cumpre; recusar quebra;
- o **`immutable`**: eu apresentei "zero bytes transferidos" como ganho. Era o
  navegador reaproveitando conteúdo parcial entre intervalos diferentes;
- a **guarda de build** de `SKIP_AUTH`: vigiava o codinome legado e protegia
  nada desde a renomeação.

### 7.4 Um falso positivo que quase entrou no relatório

Reportei quase como defeito do produto que o ajuste à largura caía para escala
1. Rodei o teste de controle — a `main` limpa apresentava o mesmo — e a causa
era o **painel oculto suspendendo `rAF`**, que suspende o `ResizeObserver`.
Artefato da bancada, já registrado na §18.2.8.

Virou correção legítima de robustez: medir a coluna direto antes de observar,
porque aba em segundo plano tem o mesmo comportamento de uma bancada oculta.

### 7.5 Regra de trabalho que fica

**Rodar a suíte inteira antes de empurrar, sempre.** Em 09/09 eu empurrei três
vezes com o CI vermelho em seguida: uma por não rodar o navegador, uma por
mexer no `testMatch` sem prever o efeito, e uma por aumentar a carga do CI e
expor uma corrida latente.

---

## 8. O Marco A fechou — 10/09, medido pelo relógio do André

**Tempo até a primeira página, em produção, com o manual do Bradesco:**

| Rodada | Hipótese | Veredito | Tempo |
|---|---|---|---|
| 1 | região da função | **errada** — Vercel e Supabase já estavam ambos em `gru1`/`sa-east-1` | 60 s |
| 2 | teto de fatia recusando com 413 | certa, e insuficiente | 45 s |
| 3 | requisição sem `Range` puxando 4 MiB pela função | certa, e insuficiente | 45 s |
| 4 | **nenhuma — instrumentei** | autorização a ~350 ms por pedido | **5 s** |

### 8.1 A lição, e ela é a mais transferível do projeto

As três primeiras rodadas foram hipótese. A quarta foi medição, e resolveu em
uma tentativa.

**Quando o sintoma é lentidão, instrumentar vem antes de teorizar.** O
`Server-Timing` custou dez linhas e respondeu na primeira leitura o que três
rodadas de raciocínio não acertaram — inclusive derrubando uma hipótese minha
que estava simplesmente errada.

Ele fica na resposta de propósito: `autorizacao`, `documento`, `sessao`,
`storage`. A próxima vez que alguém disser "está lento", a etapa cara tem
nome.

### 8.2 A causa raiz, dita sem rodeio

A rota de transporte fazia **trabalho de tela para entregar bytes**: usava a
mesma autorização das páginas de interface, que resolve workspaces, marcas,
perfil, documentos e capacidades, e valida o token contra a Auth API pela
rede. Por pedido de intervalo.

A substituta é uma consulta autorizada pela RLS — se a linha vem, o banco
provou. Prova negativa colhida: dono legítimo 1 linha, estranho 0, anônimo
`permission denied`.

### 8.3 O que o Marco A NÃO cobre, e continua registrado

| Portão | Estado |
|---|---|
| Ver o manual fiel, em produção, em 5 s | **fechado** |
| Comparação visual lado a lado | **fechado** (aprovado por André) |
| Chromium, WebKit, Firefox | **fechado** (coberto por teste) |
| iPhone e Android físicos | aberto — **prioridade 2**, decisão de 09/09 |
| Manual de ~100 MiB | aberto — depende de plano pago |
| Bucket alinhado ao plano | migration escrita, não aplicada, sem efeito prático |

**Próximo na ordem de prioridade do plano de 09/09:** Etapa 2 — documento-fonte
durável e manifesto por página. O desenho está em
`desenho-documento-fonte-e-manifesto.md`, e a Etapa 1 deixou uma dívida
explícita para ela: o identificador do documento é `brand_imports.id`, e passa
a ser `brand_source_documents` quando ela existir.
