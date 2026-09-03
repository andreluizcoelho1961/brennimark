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
  **Concluído nesta rodada.**
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
