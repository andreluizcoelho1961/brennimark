# Verificação de fechamento do P1 — orçamento de IA

Data: 2026-09-03. Resposta ponto a ponto à exigência de fechamento do P1 do
piloto Qwen. Cada item diz o que foi provado, como, e — para os dois que não
fechavam nesta rodada — por quê.

**Localização**: este documento vive só em
`docs/plan/` do repositório do Brennimark
(`andreluizcoelho1961/brennimark`, commit
[245e07e](https://github.com/andreluizcoelho1961/brennimark/commit/245e07e)),
o mesmo onde todo o resto do P1 foi commitado. Nenhuma cópia existe em
nenhum outro repositório. O caminho `The-BluesMaker-Doctrine` que aparece
nos resultados de ferramenta desta sessão é o nome do diretório de sessão
do Claude Code (um artefato de infraestrutura da conversa) — não um lugar
onde qualquer arquivo deste trabalho foi escrito.

## Status, de relance

| # | Item | Status |
|---|------|--------|
| 1 | Duas reservas concorrentes não ultrapassam o orçamento | ✅ Fechado |
| 2 | Reserva abandonada por timeout pode ser expirada com segurança | ✅ Fechado |
| 3 | Concluir ou liberar duas vezes é idempotente | ✅ Fechado |
| 4 | Custo real nunca deixa saldo negativo | ✅ Fechado |
| 5 | Kill switch entre reserva e chamada impede o provedor | ✅ Fechado (dentro do que existe hoje) |
| 6 | `SECURITY DEFINER` fixa `search_path` e valida workspace/marca/papel | ✅ Fechado |
| 7 | Preço, moeda e versão do catálogo no ledger | ✅ Fechado (ver "Fechamento dos itens 7 e 8", ao final) |
| 8 | Chat/análise não chamam o provedor quando orçamento/perfil/capacidades falham | ✅ Fechado |
| 9 | Ausência de configuração produz mensagem de produto, sem exceção sintética | ✅ Fechado |
| 10 | Nenhum candidato Qwen ativado, nenhum crédito comprado | ✅ Fechado |

10 de 10 fechados. Os itens 7 e 8 (preço/versão do catálogo no ledger, e
orçamento ligado às rotas reais) travavam na MESMA causa raiz — ausência de
preço real citável e de um teto configurado — e foram fechados juntos, na
mesma rodada de trabalho, depois que a mensagem seguinte trouxe a tabela
oficial de preços da Ollama Cloud e os valores de teto. Ver a seção
dedicada ao final.

Migrações desta rodada:
[20260903150000_ai_budget_expiry_and_kill_switch_read.sql](../../supabase/migrations/20260903150000_ai_budget_expiry_and_kill_switch_read.sql)
— duas funções novas, `expirar_reservas_de_ia` e `kill_switch_ativo`, além
da migração já existente de reserva/ledger/kill-switch
([20260903120000](../../supabase/migrations/20260903120000_ai_budget_reservation_and_ledger.sql)).

## 1. Duas reservas concorrentes não ultrapassam o orçamento

**Provado ao vivo, no banco real** (`ijnpigdmlswhkxqbjeru`), não só por
teste sequencial dentro de uma transação — que não prova bloqueio, só prova
aritmética.

Método: um teto de 10.000 micros foi criado e commitado. Duas chamadas de
`reservar_execucao_de_ia` (6.000 micros cada — juntas, 12.000, acima do
teto) foram disparadas em **duas conexões de banco distintas, ao mesmo
tempo** (duas chamadas de ferramenta paralelas nesta sessão). A primeira
travou a linha do teto (`for update`) e segurou a transação aberta por 6
segundos antes de reservar e commitar. A segunda, disparada no mesmo
instante, tentou reservar durante essa janela.

Resultado: só UMA reserva foi gravada (6.000 micros). A segunda não foi
apenas "mais lenta" — ela bloqueou na trava da linha (evidência: só
retornou depois que a primeira já tinha commitado) e, ao desbloquear,
recalculou o gasto já incluindo os 6.000 da primeira, viu que 6.000 + 6.000
> 10.000, e recusou (`orcamento_do_workspace_esgotado`) sem gravar linha
nenhuma. O total reservado nunca passou de 6.000 — o teto nunca foi
violado, mesmo sob concorrência real.

Dados de teste apagados ao final; `ai_budgets`/`ai_ledger` confirmados de
volta a 0 linhas.

## 2. Reserva abandonada por timeout pode ser expirada com segurança

Função nova `expirar_reservas_de_ia(workspace_id, limiar default 15min)`:
libera (`status = 'released'`) toda reserva `'reserved'` mais velha que o
limiar, dentro daquele workspace. 15 minutos por padrão — bem acima do
maior timeout real do produto (`maxDuration = 120s` nas duas rotas de IA) —
para não competir com uma chamada genuinamente lenta.

**Risco aceito, registrado no código**: se a chamada original ainda estiver
viva quando a expiração roda e só consolidar depois, `consolidar_execu-
cao_de_ia` vai encontrar `status <> 'reserved'` e não fazer nada — o custo
real dessa execução específica não seria registrado. Para os valores do
piloto (centavos de dólar), esse risco é menor que o oposto: uma reserva
morta comendo o teto do dia para sempre.

Provado por teste transacional revertido (4 casos): uma reserva
artificialmente envelhecida (20 min) É liberada; uma reserva fresca não é
tocada; uma reserva já `'settled'`, mesmo velha, não é tocada; um `member`
que não é `owner` não pode chamar manualmente (`insufficient_privilege`);
uma chamada sem sessão nenhuma (`auth.uid()` nulo — o formato de uma tarefa
agendada) é aceita. Também em `orcamento.ts` (`expirarReservasAntigas`),
com testes unitários próprios.

## 3. Concluir ou liberar duas vezes é idempotente

Já existia (`if linha.status <> 'reserved' then return; end if;` nas duas
funções) e já estava provado nos testes transacionais do commit anterior.
Reconfirmado nesta rodada sem alteração.

## 4. Custo real nunca deixa saldo negativo

`settled_micros bigint check (settled_micros >= 0)` já existia na tabela.
Provado por injeção direta da regressão: chamar `consolidar_execucao_de_ia`
com `p_settled_micros = -100` numa reserva real e ativa levanta
`check_violation` — a linha permanece `'reserved'`, intocada, e nenhum
valor negativo chega a ser gravado.

## 5. Kill switch acionado entre a reserva e a chamada impede o provedor

Dois pedaços, porque não existe ainda nenhum caminho real de chamada a
provedor no produto (P1, por decisão — nenhuma conexão externa criada):

- **No banco**: `kill_switch_ativo(workspace_id, brand_id)` — leitura
  `security definer`, sem expor o resto de `ai_budgets` a quem não é owner.
  Devolve os dois escopos separados. Provado por teste transacional: sem
  nada ligado, os dois vêm falsos; kill switch de workspace reflete
  corretamente e não vaza para marca; kill switch de marca reflete
  corretamente e não vaza para workspace; quem não é membro do workspace
  não lê nada (recusa, não falso-negativo).
- **Em `decidirExecucao`** ([execucao.ts](../../src/lib/ai/execucao.ts)):
  depois que a reserva sucede, um recheck FINAL chama `kill_switch_ativo`
  antes de devolver `pode: true`. Se acusar pausa (ou falhar ao consultar —
  falha fechada, mesmo princípio de sempre), a reserva recém-feita é
  LIBERADA antes de recusar, para não ficar presa como `'reserved'`. Prova­
  do por 4 testes unitários (workspace, marca, falha de consulta, e o caso
  feliz confirmando que o recheck sempre roda).

**O que isto NÃO fecha**: a janela entre `decidirExecucao` devolver
`pode: true` e uma chamada real ao provedor acontecer. Essa chamada não
existe neste código ainda — não há nada para rechecar imediatamente antes
de. O contrato fica documentado: quem implementar o despacho real (P2/P3)
deve chamar `decidirExecucao` como o ÚLTIMO passo síncrono antes do
despacho, não antes. Fechar essa janela por completo exigiria travar o
provedor de verdade, o que este código não faz.

## 6. `SECURITY DEFINER` fixa `search_path` e valida workspace/marca/papel

Confirmado por introspecção direta no banco (`pg_proc.proconfig`), não só
lido no arquivo: as 5 funções (`reservar_execucao_de_ia`,
`consolidar_execucao_de_ia`, `liberar_reserva_de_ia`,
`expirar_reservas_de_ia`, `kill_switch_ativo`) têm `search_path=""` —
exige nome totalmente qualificado (`public.…`) em toda referência interna,
o que as cinco já faziam.

Validação interna, por função: `reservar`/`kill_switch_ativo` confirmam
participação no workspace (`workspace_members`); `consolidar`/`liberar`
confirmam que quem chama é o dono da EXECUÇÃO (`user_id = auth.uid()`), não
só do workspace; `expirar` exige papel `owner` para chamada manual (aceita
chamada sem sessão como tarefa agendada). Nenhuma delega para RLS — a
checagem está dentro da função, no lugar da RLS que o `security definer`
contorna.

## 7. Preço, moeda e versão do catálogo no ledger — FECHADO

`ai_ledger` ganhou duas colunas novas
([20260903170000](../../supabase/migrations/20260903170000_ai_ledger_price_snapshot.sql)):
`price_snapshot` (preço vigente NO MOMENTO da reserva — provedor, modelo,
`CATALOGO_VERSION`, preço de entrada/cache/saída, moeda, fonte, data — gravado
uma vez e nunca reescrito, nem por consolidar) e `usage_snapshot` (tokens
REALMENTE medidos pelo provedor, gravado na consolidação). As duas funções
(`reservar_execucao_de_ia`, `consolidar_execucao_de_ia`) ganharam um
parâmetro novo NO FIM, com `default null` — quem chama com a assinatura
antiga continua funcionando.

**Armadilha evitada**: `create or replace function` com uma lista de
parâmetros diferente NÃO substitui a função — cria um overload novo ao
lado do antigo. Sem o `drop function` explícito antes do `create or
replace`, a versão de 6/4 parâmetros continuaria existindo, sem snapshot
nenhum, e uma chamada com a contagem antiga de argumentos cairia nela por
engano. Confirmado por introspecção (`pg_proc`) que só existe UM overload
de cada função depois da migração, e por teste transacional que a chamada
de 6 argumentos e a de 7 argumentos caem na MESMA função, e que consolidar
preserva `price_snapshot` intocado enquanto grava `usage_snapshot`.

## 8. Chat/análise não chamam o provedor quando orçamento, perfil ou capacidades falham — FECHADO

Os três, agora:

- **Perfil**: `attempts.length === 0` interrompe as duas rotas antes de
  qualquer streaming, com a mensagem de `semProvedorConfigurado()`.
- **Capacidades**: `getActiveConfig`/`getSettingConfig` revalidam
  `modeloAutorizado` na hora da chamada, não só ao salvar.
- **Orçamento**: `chat/route.ts` e `analyze/route.ts` agora chamam
  `decidirExecucao` depois de resolver o perfil e ANTES de qualquer
  `streamText`. Se recusar, a rota responde 503 com `mensagemDeBloqueio` e
  nenhuma chamada ao provedor acontece — provado pelos próprios testes de
  `execucao.test.ts` (zero chamadas de RPC quando o bloqueio é de catálogo/
  visão/preço, já que essas checagens rodam ANTES da reserva).

**Simplificação deliberada, documentada no código**: as duas rotas agora
usam só o PRIMEIRO perfil resolvido (`attempts[0]`), não a lista inteira —
"não usar fallback automático" enquanto o orçamento estiver ligado, porque
a reserva vale para um preço específico, e deixar `prepareStreamWithFallback`
trocar de perfil por conta própria liquidaria com um preço que ninguém
reservou. Se existir uma política de fallback configurada, ela para de
valer nestas duas rotas até o mecanismo suportar mais de um preço por
execução — uma limitação real, não escondida.

Ao final da execução: sucesso liquida com o uso REAL (extraído de
`streamText(...).usage`, a promise de tokens do AI SDK) via
`consolidarExecucao`; qualquer falha, cancelamento ou ausência de uso
libera via `liberarReserva` — nunca os dois ao mesmo tempo, mas chamar mais
de um por engano é inofensivo (a função do banco ignora silenciosamente
uma segunda chamada para a mesma execução).

## 9. Ausência de configuração produz mensagem de produto, sem exceção sintética

Já fechado no commit anterior. `semProvedorConfigurado()` é chamada
diretamente como resultado, não lançada como erro nomeado para ser pega
depois — `attempts.length === 0` é checado explicitamente nas duas rotas
antes de chegar em `prepareStreamWithFallback` (que lançaria um erro
genérico sem nome se chegasse vazio até lá).

## 10. Nenhum candidato Qwen ativado, nenhum crédito comprado

Confirmado por dois lados: `candidatos-qwen.ts` permanece estruturalmente
fora de `CATALOGO` (testado: `modeloAutorizado` recusa os 5 candidatos); e,
no banco real, `ai_settings` e `ai_budgets` seguem sem nenhuma linha criada
por este trabalho (`ai_budgets`/`ai_ledger` confirmados em 0 antes e depois
de cada teste desta rodada).

---

## Fechamento dos itens 7 e 8

A causa raiz registrada acima (nenhum preço citável para os modelos de
`CATALOGO` até então, e nenhum teto configurado para a GE) foi removida na
mesma rodada de trabalho em que este documento foi corrigido, com resposta
explícita às três perguntas que ficaram em aberto:

- **(a) Preço real, citado** — a
  [tabela oficial de preços da Ollama Cloud](https://ollama.com/pricing)
  (conferida em 2026-09-03) forneceu preço de entrada/cache/saída,
  USD/milhão de tokens, para `gemma4:31b-cloud` (candidato multimodal
  padrão) e `minimax-m3:cloud` (candidato avançado), mais `deepseek-v4-
  flash:cloud` e `nemotron-3-ultra:cloud` (catalogados como texto, não
  como motor do assistente). Provider novo `ollama-cloud` registrado em
  `provider.ts`/`catalogo.ts` — autorizado no catálogo, **nenhuma chave ou
  conexão real criada**.

  **Correção sobre imagem**: a página de preços NÃO publica um valor
  separado para imagem, em nenhum modelo. A página de cada modelo (
  [gemma4](https://ollama.com/library/gemma4)) explica que a imagem vira
  um "orçamento de tokens visuais" (70 a 1120 tokens) cobrado pela MESMA
  taxa de entrada já verificada — não uma taxa à parte. `gemma4:31b-cloud`
  é hoje o ÚNICO modelo do catálogo com esse orçamento documentado
  (`maxImageTokens: 1120`, o teto, não a mediana). `minimax-m3:cloud`
  também aceita imagem tecnicamente, mas a Ollama não publica um orçamento
  de tokens para ele — `podeAnalisarImagem` continua bloqueando análise de
  imagem nesse modelo até esse número existir, mesmo sendo um preço
  "verificado" para texto.

- **(b) Teto real para a GE** — criado no banco, com os valores exatos
  fornecidos: US$ 1,00/dia por workspace, US$ 0,50/dia pela marca GE,
  `kill_switch` desligado (pronto para uso, não pausado). "Nenhum
  recarregamento automático" já é como o mecanismo funciona por
  construção — o teto é por PERÍODO (`date_trunc('day', now())` na soma da
  reserva), não um saldo pré-pago que precise ser reabastecido.

- **(c) Coluna de versão do catálogo** — `price_snapshot` (jsonb) em
  `ai_ledger`, com `catalogVersion` como um dos campos, junto do resto do
  preço — ver item 7 acima.

Nenhum modelo foi fixado como padrão da GE — a escolha entre Gemma 4,
MiniMax M3 e Qwen continua reservada ao benchmark multimodal controlado
(P2), como pedido explicitamente. O que existe agora é o MECANISMO pronto
e ligado: o momento em que um desses perfis for configurado em
`ai_settings`, `decidirExecucao` já reserva, recheca e liquida de verdade —
sem exceção para chamadas antigas, sem chamada paga sem orçamento, sem
fallback automático.
