# P2 — benchmark multimodal antes de ativar o primeiro modelo

Data: 2026-09-03. P1 encerrado (ver
[verificacao-orcamento-p1-fechamento-2026-09-03.md](verificacao-orcamento-p1-fechamento-2026-09-03.md)):
catálogo, orçamento, ledger, kill switch e ausência de fallback estão
integrados e protegidos. Este documento registra o que o P2 precisa provar
**antes** de qualquer modelo ser ativado — para não se perder entre
sessões, e para que "nenhum vencedor antes do benchmark" seja uma regra
escrita, não uma intenção.

**Estado atual, explícito**: infraestrutura pronta; **nenhuma IA ativa**.
Falta chave real, um perfil de execução (`ai_settings`) e a primeira
chamada de verdade. Nada disto acontece sozinho — cada um é uma decisão
que espera autorização explícita, não uma continuação automática deste
documento.

## Os quatro pontos que o P2 precisa provar

Nenhum é sobre ESCOLHER modelo — são sobre o MECANISMO aguentar uma
execução real antes de qualquer escolha.

### 1. A reserva usa o pior caso, com `maxOutputTokens` enviado ao provedor

Hoje `decidirExecucao` reserva pelo teto de `LIMITES_DE_IA` (entrada) e um
teto fixo de tokens de saída (2.000/2.500, ver
[execucao.ts](../../src/lib/ai/execucao.ts)) — mas **não envia esse teto ao
provedor**. Sem `maxOutputTokens` na chamada real, nada impede o modelo de
responder além do que foi reservado, e o custo real pode superar a reserva
e estourar o teto do dia. Precisa: passar `maxOutputTokens` (ou o
equivalente do AI SDK/`streamText`) coerente com o teto já calculado em
`decidirExecucao`, e um teste que prove que a chamada real É limitada por
esse número, não só que o número existe.

### 2. Cancelamento, timeout e interrupção sempre liquidam ou liberam

`chat/route.ts` e `analyze/route.ts` já cobrem os três caminhos conhecidos
(sucesso → liquida; erro/cancelamento → libera) contra o Supabase de
mentira, mas **nunca contra um provedor real**. O P2 precisa de prova
contra uma chamada de verdade (ou, no mínimo, contra um dublê que se
comporta como um provedor real sob rede instável): interrupção no meio do
streaming, timeout do primeiro chunk, e o `AbortSignal` do cliente — os
três têm que terminar em `settled` ou `released`, nunca presos em
`reserved` além do limiar de expiração.

### 3. Kill switch: chamada já enviada é custo, não cancelamento fingido

O recheck de `decidirExecucao` cobre o kill switch ANTES do despacho —
mas se o kill switch for acionado DEPOIS que a chamada já foi enviada ao
provedor, essa chamada não pode ser silenciosamente tratada como
`liberada`: ela vai gerar custo real independente do kill switch, e fingir
que não gerou é o tipo exato de contabilidade falsa que este projeto
rejeita em todo outro lugar. Precisa: o caminho pós-despacho sempre
consolida com o uso real (mesmo que o kill switch tenha sido acionado no
meio), nunca libera uma execução que já saiu para o provedor.

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

## O que falta, para o primeiro teste acontecer

Três coisas que este documento NÃO autoriza sozinho — cada uma precisa de
confirmação explícita quando chegar a vez:

1. Uma chave real da Ollama Cloud (conta, billing, API key).
2. Um perfil de execução (`ai_settings`) para a GE usando `gemma4:31b-cloud`.
3. A primeira chamada real — depois dos pontos 1–3 dos "quatro pontos"
   acima estarem provados, não antes.
