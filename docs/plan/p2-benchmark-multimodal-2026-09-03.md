# P2 — benchmark multimodal antes de ativar o primeiro modelo

Data: 2026-09-03. P1 encerrado (ver
[verificacao-orcamento-p1-fechamento-2026-09-03.md](verificacao-orcamento-p1-fechamento-2026-09-03.md)):
catálogo, orçamento, ledger, kill switch e ausência de fallback estão
integrados e protegidos. Este documento registra o que o P2 precisa provar
**antes** de qualquer modelo ser ativado — para não se perder entre
sessões, e para que "nenhum vencedor antes do benchmark" seja uma regra
escrita, não uma intenção.

**Sequenciamento em duas fases** — a ativação depende de uma conta real da
Ollama, mas boa parte do P2 não depende:

- **P2A — implementação hermética, sem custo.** Os três primeiros pontos
  abaixo. Roda contra provedor falso, nenhuma chave, nenhuma conexão real.
  **Concluído.**
- **P2A.1 — correção contábil, antes da chave real.** Uma revisão sobre o
  P2A: liberar a reserva depois que o despacho já aconteceu podia
  subestimar custo — o provedor pode cobrar mesmo sem devolver um
  relatório final de uso. **Concluído** — ver seção dedicada abaixo.
- **P2A.2 — teto validado de chatRole/analysisRole.** A lacuna que o
  P2A.1 descobriu e não fechou sozinho: 1.000 caracteres, validado no
  banco, na RPC de importação e na leitura — e a reserva passou a usar o
  conteúdo real do papel, não uma suposição. **Concluído** — ver seção
  dedicada abaixo.
- **P2A.3 — fechamento da fronteira financeira, achado por revisão
  externa.** Quatro pontos: reuso de `execution_id` como autorização de
  despacho, RPCs financeiras expostas à Data API para qualquer membro,
  constraint de orçamento global que não impedia duplicata, e conteúdo
  estruturado de mensagem escapando o limite de tamanho. **Concluído —
  os quatro fechados.** `SUPABASE_SECRET_KEY` criada (chave moderna
  `sb_secret_...`, nomeada `brennimark_billing`) e configurada na Vercel
  (Production) e em `.env.local`; reserva, liquidação, cancelamento e a
  recusa da chave pública testados de verdade pela Data API; as três
  funções antigas revogadas e removidas do banco real; confirmado pelos
  advisors que nenhuma mutação financeira segue exposta a `authenticated`.
  Com isto, **o P2A está encerrado por completo**. Ver seção dedicada
  abaixo.
- **P2B — benchmark real, autorizado.** O ponto 4 e a ativação em si.
  Aqui sim: conta e chave da Ollama Cloud, crédito pré-pago pequeno, chave
  cadastrada pelo Studio (cifrada, nunca pelo chat nem commitada), perfil
  da GE com `gemma4:31b-cloud`, matriz fixa de perguntas/imagens, e o
  modelo permanece desativado se qualquer limite falhar. **Ainda não
  autorizado.** O ponto correto para pedir autorização de novo é
  imediatamente antes do P2B — quando existir a primeira chamada externa
  faturável.

## P2A — os três pontos que a implementação hermética precisa provar

Nenhum é sobre ESCOLHER modelo — são sobre o MECANISMO aguentar uma
execução real antes de qualquer escolha.

### 1. A reserva usa o pior caso, com `maxOutputTokens` enviado ao provedor — ✅ Fechado

`decidirExecucao` devolve `maxOutputTokens` como parte da decisão — o
MESMO número usado para calcular `reservedMicros` (uma variável só, lida
nos dois lugares: não duas contas que deveriam bater, uma conta só). As
duas rotas passam esse valor direto para `streamText({ maxOutputTokens
})`. Provado por teste comparando o `reservedMicros` realmente enviado à
reserva contra o custo recalculado a partir do `maxOutputTokens`
devolvido — se algum dia divergirem, o teste quebra.

### 2. Cancelamento, timeout e interrupção sempre liquidam ou liberam — ✅ Fechado

Extraído para `executarComOrcamento` ([execucao.ts](../../src/lib/ai/execucao.ts)) —
um wrapper sobre `prepareStreamWithFallback` cujo `iterator` liquida
sozinho quando o stream termina e libera sozinho se lançar ou for
cancelado. A garantia não depende de quem chama lembrar de fazer isso: as
duas rotas só drenam o iterator do jeito que já drenavam. Provado com
despacho falso (não é a mesma coisa que um provedor real, mas é o dublê
que os testes deste projeto já usam para essa camada — ver
`stream-fallback.test.ts`) nos seis caminhos: sucesso, erro imediato,
timeout do primeiro chunk, cancelamento no meio, queda de streaming depois
do primeiro chunk, e ausência de uso mensurável ao terminar.

### 3. Kill switch: chamada já enviada é custo, não cancelamento fingido — ✅ Fechado

`executarComOrcamento` nunca consulta o kill switch — só `decidirExecucao`
faz isso, e só ANTES do despacho. Uma vez despachada, a execução sempre
liquida com o que o provedor devolveu, mesmo que o kill switch tenha sido
acionado no meio — não existe caminho de código para "fingir cancelada".
Provado por teste estrutural: a lista de chamadas de RPC durante um
despacho bem-sucedido nunca inclui `kill_switch_ativo`.

**O que isto NÃO prova**: as três garantias acima são contra um despacho
FALSO. Um provedor real tem falhas que um dublê não reproduz sozinho —
antes da primeira chamada real (P2B), vale reconfirmar contra ela, não só
assumir que o dublê generalizou.

## P2A.1 — correção contábil pós-despacho

A regra original do item 2 tratava "erro depois do despacho" e "erro antes
do despacho" do mesmo jeito — as duas liberavam a reserva. Isso subestima
custo: uma vez que o pedido saiu para o provedor, cancelamento, queda de
streaming ou ausência de relatório de uso NÃO provam que nada foi cobrado
— a Ollama pode processar entrada e produzir tokens de saída antes de o
cliente cancelar, e cobrar por isso mesmo sem devolver um `usage` final.

A regra corrigida, implementada em `executarComOrcamento`:

- **Falha ANTES do despacho** (nenhuma tentativa chegou a ser chamada — na
  prática, só quando o `AbortSignal` já chega abortado): libera
  integralmente. É o ÚNICO caminho que ainda libera.
- **Falha DEPOIS do despacho, com uso CONHECIDO** (a promise de uso
  resolve com números, mesmo que o stream de texto tenha quebrado):
  liquida o uso real.
- **Cancelamento, timeout, queda de streaming ou uso DESCONHECIDO depois
  do despacho**: liquida pelo TETO reservado (o mesmo valor que já era o
  pior caso assumido) e marca `usage_unknown: true` no `usage_snapshot` do
  ledger — nunca vira custo zero, nunca fica sem registro.
- Uma promise de uso que nunca resolve (plausível depois de um
  cancelamento) tem um teto de espera (`usageTimeoutMs`, 5s por padrão) —
  sem isso, encerrar a execução ficaria pendurado para sempre.

Provado por 10 testes em `execucao.test.ts`, incluindo o caso central: uma
pessoa cancela depois de já ter recebido o primeiro token — o teste
verifica explicitamente que `settledMicros` nunca é zero.

**A segunda parte da exigência — a reserva de entrada cobre tudo que é
faturável.** `BOILERPLATE_DO_PROMPT_DE_SISTEMA` (o texto FIXO do prompt de
sistema — regras de fundamentação, formato, regras de cor só na análise)
deixou de ser um chute de 1.500 caracteres e passou a ser MEDIDO chamando
os construtores reais (`buildChatSystemPrompt`/`buildAnalysisSystemPrompt`)
com trechos no teto e papel VAZIO, isolando o que não depende do papel — a
análise mede quase o dobro do chat. O papel em si entra à parte, com o
conteúdo REAL (ver P2A.2, abaixo — fechado na mesma rodada). Uma margem de
20% (`MARGEM_DE_PROTOCOLO`) cobre o que a contagem de caracteres não
modela: overhead de protocolo (papéis/estrutura de mensagem) e a variância
do tokenizador real — permanece como margem sobre o texto medido, nunca
como substituto de medi-lo. Um teste roda a MESMA medição do boilerplate
fixo e quebra se ele crescer além do assumido. O teto visual
(`maxImageTokens`) já entrava na conta desde o P1 — agora há um teste
provando que a DIFERENÇA de reserva com/sem imagem é exatamente esse
número, nem mais nem menos.

## P2A.2 — teto validado de chatRole/analysisRole, e reserva com o conteúdo real

Decisão: **1.000 caracteres**, com validação formal em três camadas —
`MAX_CARACTERES_DO_PAPEL_DA_MARCA`, a mesma constante nos três lugares (o
banco, a leitura em `brand-row.ts`, e a reserva em `execucao.ts`), para não
haver dois números que deveriam bater e não batem:

- **Banco** — migração
  [20260903180000](../../supabase/migrations/20260903180000_brand_ai_role_length_limit.sql):
  `check (char_length(ai->>'chatRole') <= 1000)` (e o mesmo para
  `analysisRole`) na tabela `brands`. Impede bypass pela Data API — mesmo
  uma escrita direta, fora de qualquer rota do produto, é recusada. Preflight
  confirmou que a única marca real (GE) tem os dois campos vazios: a
  constraint não rejeita nada existente.
- **RPC de importação** (`publish_brand_import`, mesma migração) — valida
  ANTES do insert, com uma exceção nomeada
  (`chatRole must be at most 1000 characters`, código `22001`) em vez de
  deixar a mensagem crua da constraint chegar a quem importa.
- **Leitura** (`brand-row.ts`) — `papelDaMarca()` trata um valor além do
  teto como malformado: cai para `""`, nunca é truncado em silêncio (mesma
  disciplina do resto do arquivo — "dado malformado nunca vira conteúdo
  aprovado").

**Achado ao implementar**: `.length` do JavaScript conta unidades UTF-16,
não pontos de código — `"😀".repeat(1000).length` dá 2000, não 1000,
porque esse emoji ocupa duas unidades. O `char_length` do Postgres conta
pontos de código. Sem corrigir isso, o teto do TypeScript teria sido mais
restritivo que o do banco para qualquer texto com esse tipo de caractere —
duas camadas contando coisas diferentes com o mesmo nome. `contarCaracteres()`
(via `Array.from`, que itera por ponto de código) corrige isso nos dois
lugares — validação e reserva.

**A reserva agora usa o CONTEÚDO REAL do papel**, não uma suposição
genérica: `AIExecutionRequest` ganhou o campo `role`, e
`tetoDeTokensDeEntrada` soma `contarCaracteres(role)` — capado no teto
validado como uma segunda camada de defesa, independente da primeira (o
banco já deveria ter recusado um valor maior, mas a reserva não confia
cegamente nisso). `BOILERPLATE_DO_PROMPT_DE_SISTEMA` foi remedido com
papel VAZIO, isolando só o texto que não depende do papel — os dois
componentes (fixo + papel real) agora entram separados, em vez de um único
número que misturava os dois.

Provado por: teste de banco (1.000 aceito, 1.001 recusado, para ASCII e
para emoji — confirmando contagem por caractere, não por byte, e que a
linha original não muda depois de cada tentativa recusada); testes em
`brand-row.test.ts` (mesmos casos, na leitura); testes em
`execucao.test.ts` (um papel de 500 caracteres reserva mais que um vazio;
um papel muito além do teto — simulando um defeito ou uma linha anterior à
constraint — reserva exatamente o mesmo que um papel exatamente no teto,
nunca mais).

**O que fica de fora, de propósito**: não existe hoje nenhuma tela onde um
administrador edite `chatRole`/`analysisRole` — o único caminho de escrita
(`BrandImporter.tsx`) sempre grava `""`. "Validação na interface e
contador de caracteres" está pronta para ser usada (a constante é
exportada, o padrão está estabelecido), mas não há interface para aplicá-la
ainda. Construir essa tela é decisão de produto separada — não fiz isso
aqui sem pedir, para não repetir o que a orientação deste projeto já
rejeitou antes (nenhuma tela nova ad hoc).

## P2A.3 — fechamento da fronteira financeira, achado por revisão externa

Origem: revisão de segurança/correção de terceiro sobre o P2A.2 fechado,
recebida em 2026-09-03, com quatro achados — três P0 (bloqueantes antes de
qualquer chave real) e um P1. Nenhum arquivo foi alterado durante a
revisão; cada achado foi reconferido contra o código real antes de
qualquer correção.

### 1. `execution_id` reutilizado autorizava despacho, seja qual for o status — ✅ Fechado

`reservar_execucao_de_ia` devolvia `ok:true` para QUALQUER linha já
existente — `reserved`, `settled` ou `released` — e `decidirExecucao`
nunca checava esse status. Um id repetido em voo (duas abas, duplo
clique, retry de rede que chegou duas vezes ao servidor) ou já finalizado
passava como se fosse reserva nova, autorizando um segundo despacho pago.

Correção: `orcamento.ts` para de descartar o `status` que o banco já
devolvia; `decidirExecucao` bloqueia como `execucao_em_andamento`
(`reserved`) ou `execucao_ja_finalizada` (`settled`/`released`) sempre que
a reserva não é genuinamente nova. Repetir uma resposta finalizada
exigiria armazenar e reproduzir o resultado — não existe hoje, e não foi
construído aqui.

Provado por 4 testes novos em `execucao.test.ts`: os três status
reutilizados bloqueiam com o motivo certo, sem chegar ao recheck de kill
switch; uma reserva genuinamente nova continua autorizando o despacho.

### 2. RPCs financeiras aceitas por qualquer membro autenticado, direto pela Data API — ✅ Fechado

`reservar_execucao_de_ia`, `consolidar_execucao_de_ia` e
`liberar_reserva_de_ia` são `security definer` com
`grant execute ... to authenticated` — qualquer membro do workspace pode
chamá-las diretamente por `/rest/v1/rpc/...`, escolhendo
`reserved_micros`, moeda, preço, snapshot e tarefa por conta própria.
Nada valida esses números contra o catálogo antes de aceitar. Um membro
poderia esgotar o teto diário inteiro numa chamada direta, sem nunca
chamar um provedor, ou fechar uma reserva própria com custo liquidado
inventado.

**Correção com chave secreta moderna, sem janela de indisponibilidade** —
ajustada após revisão do usuário sobre a proposta inicial: nem a chave
legacy `service_role` (JWT, sem rotação por serviço), nem uma migração
única que apaga as funções antigas antes do backend novo estar publicado.
Rollout em duas migrações:

- **Etapa 1 — aplicada ao projeto real**:
  [20260903210000_ai_ledger_server_only_functions.sql](../../supabase/migrations/20260903210000_ai_ledger_server_only_functions.sql)
  cria três funções NOVAS (`reservar_execucao_de_ia_server`,
  `consolidar_execucao_de_ia_server`, `liberar_reserva_de_ia_server`) —
  `p_user_id` explícito em vez de `auth.uid()`, `grant execute` só para
  `service_role`, SEM tocar nas três antigas. Puramente aditiva: nada
  quebra entre esta migração e o deploy do backend novo. Provado por SQL
  isolado (`p_user_id` nulo recusado, não-membro recusado, reserva nova,
  reserva repetida idempotente, consolidação, no-op na segunda
  consolidação, dono errado recusado, liberação — 8 casos, todos numa
  transação revertida) e por `has_function_privilege`: as três `_server`
  não aparecem para `authenticated`/`anon`, só para `service_role`; as três
  antigas continuam acessíveis a `authenticated` (esperado — é a
  etapa 2 que fecha isso).
  Camada TypeScript publicada no mesmo commit: `src/lib/supabase/service.ts`
  (`createServiceClient()`, `import "server-only"`, lê
  `SUPABASE_SECRET_KEY` — nunca `service_role`; falha fechada e explícita
  se a chave não existir) chamado SÓ pelas duas rotas (`chat/route.ts`,
  `analyze/route.ts`), nunca por `orcamento.ts`/`execucao.ts` diretamente
  — o pacote `server-only` lança em qualquer import fora do bundler do
  Next.js, o que quebraria o runner de teste (`node --test`) se um módulo
  testado importasse `service.ts` no topo do arquivo. `orcamento.ts` e
  `execucao.ts` recebem o cliente por parâmetro (`serviceClient`), o mesmo
  padrão de injeção de dependência do resto do arquivo — só quem chama
  (a rota) decide qual cliente é qual. `userId` é resolvido pela rota a
  partir de `supabase.auth.getUser()` (sessão já validada), nunca do
  corpo da requisição.
- **Etapa 2 — aplicada ao projeto real**:
  [20260903220000_ai_ledger_drop_legacy_authenticated_functions.sql](../../supabase/migrations/20260903220000_ai_ledger_drop_legacy_authenticated_functions.sql)
  revogou e removeu as três funções antigas. Aplicada só depois de
  confirmar as três precondições: (a) `SUPABASE_SECRET_KEY` — chave
  moderna `sb_secret_...`, nomeada `brennimark_billing` — criada no
  Supabase e configurada em `.env.local` e na Vercel (Production); (b) as
  quatro operações testadas de verdade pela Data API com essa chave, num
  script descartável contra o projeto real: reserva, liquidação,
  cancelamento (liberação) e — o caso que fechava a lacuna original — a
  chave PÚBLICA (anon) tentando chamar `reservar_execucao_de_ia_server`
  e sendo recusada com `permission denied` (`42501`); linhas de teste
  limpas do `ai_ledger` depois. Esse teste também respondeu a única
  dúvida que a prova por SQL isolado não cobria: se a chave `sb_secret_...`
  realmente mapeia para o papel `service_role` na camada da Data API —
  respondeu que sim.
  (c) confirmado via advisors (`get_advisors`, tipo `security`) que
  nenhuma das três mutações financeiras antigas aparece mais para
  `authenticated` — elas somem da lista inteiramente, porque foram
  removidas, não só com o grant revogado.

Nenhum valor da chave passou pelo chat em nenhum momento — criada e
copiada pelo usuário diretamente na tela do Supabase, colada por ele em
`.env.local` e no formulário da Vercel.

### 3. Orçamento global não impedia duplicata — ✅ Fechado

`unique (workspace_id, brand_id, period)` com `brand_id` anulável — o SQL
padrão trata cada `NULL` como distinto de qualquer outro `NULL`, então a
constraint nunca disparava para duas linhas de orçamento GLOBAL
(`brand_id` nulo) do mesmo workspace.

Correção:
[20260903190000_ai_budgets_unique_nulls_not_distinct.sql](../../supabase/migrations/20260903190000_ai_budgets_unique_nulls_not_distinct.sql)
— `unique nulls not distinct`. Aplicada e provada ao vivo: inserida uma
segunda linha global real para o workspace GE dentro de uma transação,
confirmado `unique_violation`, revertida — contagens voltaram ao ponto de
partida. Nenhuma duplicata existe hoje; a constraint nova não rejeita
nada existente.

### 4. Conteúdo estruturado de mensagem escapava o limite e a reserva — ✅ Fechado

`limitarMensagens` só cortava `content` do tipo string. A forma de partes
de `ModelMessage.content` (`[{type:"text",...}, {type:"image",...}]`)
atravessava inteira, sem limite, direto para `streamText` — e, por
extensão, sem entrar na conta do teto de tokens da reserva.

Correção: `limitarConteudoDaMensagem` soma o total de texto através de
TODAS as partes (não por parte isolada) contra o mesmo teto da forma
string, e descarta partes que não são texto — o histórico de chat não é
multimodal; análise de imagem é rota separada com seu próprio limite. O
teste que antes esperava uma parte de imagem "atravessar intacta" estava,
sem perceber, afirmando a própria lacuna como comportamento esperado —
reescrito para afirmar o descarte.

A ressalva da revisão sobre "4 caracteres ≈ 1 token" ser uma média, não
um teto seguro, também foi corrigida — ver a mudança de
`CARACTERES_POR_TOKEN` (divisor) para `BYTES_POR_CARACTERE_PIOR_CASO`
(multiplicador) no item 1 do P2A original, revisado nesta rodada.

### O que fica registrado, não bloqueante

Dois índices compostos ausentes nas chaves estrangeiras de `ai_budgets` e
`ai_ledger`, sinalizados pelo advisor do Supabase — não impedem nada hoje,
mas devem entrar na correção de schema junto com o item 2 quando ele for
aplicado.

## P2B — o quarto ponto, autorizado separadamente

### 4. O benchmark compara Gemma 4, Qwen multimodal e MiniMax M3 nas MESMAS condições

Mesmas perguntas, mesmas imagens, mesmos trechos recuperados, mesmos
limites (`LIMITES_DE_IA`) — para os três. Comparar sob condições
diferentes não é comparação, é coincidência.

## Por que Gemma 4 primeiro

`minimax-m3:cloud` continua bloqueado para imagem
(`podeAnalisarImagem` recusa — ver
[verificacao-orcamento-p1-fechamento-2026-09-03.md](verificacao-orcamento-p1-fechamento-2026-09-03.md#8-chatanálise-não-chamam-o-provedor-quando-orçamento-perfil-ou-capacidades-falham--fechado),
a Ollama não publica orçamento de tokens de imagem para ele). Só
`gemma4:31b-cloud` tem imagem computável hoje. O primeiro teste web
completo — o que exercita o produto de ponta a ponta, não só uma chamada
isolada de comparação — precisa ser com um modelo que o próprio portão de
orçamento aceita para imagem.

## O que o resultado do primeiro teste precisa medir

- Qualidade e fidelidade às diretrizes da GE.
- Reconhecimento de imagem.
- Citações e páginas de origem.
- Latência até o primeiro token, e duração total.
- Tokens e custo: **reservado versus liquidado** — não só o custo final,
  a DIFERENÇA entre os dois, que é o que valida (ou não) o item 1 acima.
- Comportamento com evidência insuficiente.
- Consumo acumulado no orçamento da GE (US$ 0,50/dia da marca, US$ 1,00/dia
  do workspace).

## Regra explícita

Nenhum vencedor definido antes do benchmark rodar com os três modelos, sob
as mesmas condições. Um resultado forte de `gemma4:31b-cloud` no primeiro
teste web não decide a comparação sozinho — ele prova que o MECANISMO
funciona ponta a ponta; a escolha entre os três continua em aberto até o
benchmark comparativo (item 4) rodar.

## A sequência do P2B, quando autorizada

Nenhum passo abaixo está autorizado por este documento — cada um espera
confirmação explícita quando chegar a vez:

1. Você cria a conta e a chave da Ollama Cloud.
2. Adiciona um crédito pré-pago pequeno.
3. A chave é cadastrada pelo Studio e armazenada cifrada — nunca enviada
   pelo chat ou commitada.
4. Cria-se o perfil da GE com `gemma4:31b-cloud`.
5. Executa-se a matriz fixa de perguntas e imagens.
6. Comparam-se reserva, uso, custo, qualidade e latência.
7. O modelo permanece desativado caso qualquer limite falhe.
