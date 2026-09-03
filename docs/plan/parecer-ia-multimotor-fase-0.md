# Parecer — Fase 0 do briefing de IA multimotor

Inventário do que existe hoje, antes de alterar código. Curto de propósito.

---

## O que existe

**`ai_settings`** — por workspace. Guarda `provider`, `model`, `role`
(`chat | analysis | both`), a chave cifrada em AES-256-GCM (`ciphertext` + `iv`
+ `last4`) e `is_active`. Desde o G1, as quatro operações exigem `owner`.

**`ai_routing_policies`** — por workspace e `feature`. Aponta um
`primary_setting_id`, um `fallback_setting_id`, `first_chunk_timeout_ms` e
`allow_cross_provider`.

**Adaptadores** — groq, anthropic, openai, google, openrouter, com modelos
sugeridos por provedor e um conjunto `VISION_MODELS`.

**Recuperação** — já é por `brand_id`, `security invoker`, com citação, status
e faixa de páginas. **É independente de provedor** e não precisa mudar.

**Limites** — `LIMITES_DE_IA`: 8 fontes, 1.200 caracteres por trecho, 8.000 de
contexto, 2.000 de pergunta, 12 mensagens, 4.000 por mensagem.

**Telemetria** — `analysis_runs` registra provider, model, `elapsed_ms`,
`attempts` e `fallback_used`. Só para análise.

**Contenção de erro** — `message` para a tela, `detalheTecnico` para o log,
separados no tipo. Recém-feito, e atende o requisito do briefing.

---

## O que dá para reaproveitar sem mexer

A cifra da chave, os adaptadores por provedor, a camada de recuperação
inteira, a RLS de owner e a contenção de erro. Esses cinco atendem o briefing
como estão.

---

## O que precisa migrar, e por quê

**`ai_settings` confunde três coisas.** Hoje uma linha é, ao mesmo tempo,
credencial, escolha de modelo e destinação (`role`). O briefing separa conexão,
perfil e política de marca — e a separação importa: trocar o modelo de um perfil
não deveria exigir recadastrar a chave, e duas marcas usando a mesma conexão com
perfis diferentes é o caso normal de uma agência.

**`ai_routing_policies` é quase o perfil, mas por feature.** Ele já expressa
primário, reserva e timeout — falta ser um objeto NOMEADO e reutilizável, com
limites e orçamento, referenciado por marca.

**A marca não referencia nada.** Não existe coluna ligando marca a perfil. Ela é
o elo que falta para a tabela do briefing (marca → perfil de consulta, perfil
visual).

**Capacidades são um conjunto de nomes.** `supportsVision` consulta uma lista de
modelos. Não há `maxContextTokens`, `maxImageBytes` nem `supportsStructuredOutput`
declarados — a interface adivinha, que é o que o briefing proíbe.

---

## Riscos, em ordem de gravidade

**1. O modelo não é validado contra catálogo.** A rota de criação valida o
`provider` contra `PROVIDERS` e aceita **qualquer string** em `model`. É
exatamente o "não aceitar qualquer string de modelo enviada pelo cliente" do
briefing, e é a correção mais barata desta lista.

**2. Não existe orçamento.** Nenhum. No instante em que um provedor real for
conectado, o gasto passa a ser ilimitado por construção: não há teto por
workspace, por marca, por pessoa ou por período, e nada bloqueia antes da
chamada. Isto precisa existir **antes** de uso amplo, não depois.

**3. O fallback de demonstração contorna tudo.** `getDemoConfig` usa
`GROQ_API_KEY` do ambiente quando não há provedor configurado. Ele não pertence
a workspace nenhum, não passa por perfil e não seria contabilizado por orçamento
algum. Numa arquitetura de perfis ele é uma porta lateral, e recomendo removê-lo
ou torná-lo explícito como perfil do próprio produto.

**4. Não há papel de editor.** `workspace_members.role` aceita `owner` e
`member`. A tabela de papéis do briefing tem três linhas; o banco tem duas. O
"editor pode usar, e configurar somente se a política permitir" não é
expressável hoje.

**5. Telemetria não cobre chat nem custo.** `analysis_runs` registra a análise;
o chat não registra nada. E nenhum dos dois registra tokens ou custo — que é o
que torna o orçamento auditável.

**6. Histórico é denormalizado, e isso é bom.** `analysis_runs` guarda o
provider e o model usados. Trocar o perfil de uma marca **não pode** reescrever
esse histórico: a análise foi feita com aquele modelo, e essa é a verdade.
Registro aqui porque a tentação de normalizar por `profile_id` aparece.

---

## Recomendação de sequência

Divergindo levemente do briefing em uma coisa, e digo qual: ele coloca
orçamento na Fase 2. Eu faria o **teto por workspace junto da Fase 1**, mesmo
que grosseiro, porque a Fase 1 é o que torna possível conectar um provedor de
verdade — e conectar sem teto é o momento exato em que o gasto vira ilimitado.

O resto da sequência do briefing me parece certa. A validação de modelo contra
catálogo (risco 1) cabe na Fase 1 e é meia hora.
