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
