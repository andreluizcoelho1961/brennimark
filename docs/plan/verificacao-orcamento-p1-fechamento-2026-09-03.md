# Verificação de fechamento do P1 — orçamento de IA

Data: 2026-09-03. Resposta ponto a ponto à exigência de fechamento do P1 do
piloto Qwen. Cada item diz o que foi provado, como, e — para os dois que não
fecham nesta rodada — por quê.

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

## 7. Preço, moeda e versão do catálogo no ledger — PARCIAL

`ai_ledger` já grava `reserved_micros`, `settled_micros` e `currency` — o
preço e a moeda de cada execução. O que falta é **versão do catálogo**:
qual entrada de `CATALOGO` (com suas capacidades declaradas naquele
momento) foi usada, para auditar depois se o catálogo mudar.

**Não fechado nesta rodada, de propósito**: é uma coluna nova em
`ai_ledger` — mudança de schema. Pela regra deste projeto, muda o quê e não
decido sozinho: aviso e espero resposta antes de aplicar. Ver seção "O que
falta decidir" abaixo.

## 8. Chat/análise não chamam o provedor quando orçamento, perfil ou capacidades falham — PARCIAL

- **Perfil**: já fechado desde o commit anterior — `attempts.length === 0`
  interrompe as duas rotas antes de qualquer streaming, com a mensagem de
  `semProvedorConfigurado()`.
- **Capacidades**: fechado nesta rodada — `getActiveConfig` e
  `getSettingConfig` ([settings.ts](../../src/lib/ai/settings.ts)) agora
  revalidam `modeloAutorizado` NA HORA da chamada, não só ao salvar. Antes,
  uma configuração válida quando salva continuaria sendo usada mesmo que o
  catálogo mudasse depois (um modelo descatalogado, por exemplo) — o
  catálogo virava decoração de tela de configurações. Não muda nada para a
  GE hoje (o modelo configurado continua no catálogo); é uma trava contra
  deriva futura.
- **Orçamento**: **não fechado**. `decidirExecucao`/`reservarExecucao`
  existem e estão provados de ponta a ponta (este documento, itens 1–6),
  mas nenhuma rota real (`chat`, `analyze`) os chama ainda. Não é uma
  omissão — é um bloqueio real, explicado abaixo.

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

## O que falta decidir antes de fechar o item 8 (orçamento) e o item 7

As duas coisas travam na mesma causa raiz: **não existe hoje nenhum preço
por token, citado e verificável, para nenhum modelo de `CATALOGO`** — só
para os candidatos Qwen (que não são ativáveis) e um modelo do OpenRouter
já documentado em `provider.ts`. Ligar a reserva de orçamento às rotas
reais de chat/análise exigiria decidir `reservedMicros` para cada chamada,
e três caminhos existem:

1. **Inventar um teto conservador** — a política que o próprio briefing do
   piloto permite para imagem, mas que este projeto rejeita em geral: "não
   fabricar preço", e um teto sem preço-fonte é exatamente isso.
2. **Pesquisar e citar preço real de cada modelo de `CATALOGO`** (Groq,
   Anthropic, OpenAI, Google, OpenRouter) — fazível, mas mesmo assim esbarra
   no ponto 3.
3. **O ponto que realmente trava**: hoje **nenhuma linha existe em
   `ai_budgets`** para o workspace real (confirmado nesta verificação — 0
   linhas). Ligar a reserva às rotas reais, com qualquer preço, faria TODA
   chamada da GE cair em `sem_orcamento_configurado` a partir do deploy —
   quebrando o chat que a revisão anterior confirmou funcionando, até
   alguém criar um teto real. Quanto o workspace da GE pode gastar por dia é
   uma decisão financeira de quem administra a conta, não uma escolha de
   engenharia.

Proposta concreta, para resposta explícita:

- **(a)** Autorizo pesquisar e citar preço real (fonte oficial, data,
  região) para os modelos de `CATALOGO` hoje configuráveis, seguindo o
  mesmo padrão de `imagePricingVerified` — e SÓ então ligar `decidirExecucao`
  às rotas de chat/análise?
- **(b)** Que teto diário (valor e moeda) criar para o workspace da GE
  antes dessa ligação — para não interromper o chat que já funciona no
  instante em que a reserva de orçamento entrar em produção?
- **(c)** Autorizo a coluna nova em `ai_ledger` para registrar a versão do
  catálogo usada em cada execução (aditiva, sem quebrar nada existente)?

Sem resposta a estas três, os itens 7 e 8 (cláusula de orçamento) ficam
registrados como abertos — não como concluídos por engano.
