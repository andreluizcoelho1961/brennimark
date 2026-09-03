# Parecer — P0 do piloto Qwen (plano e preço)

Entregável do P0 do briefing `briefing-ia-local-sem-custo-2026-09-03.md`.
**Nenhum código de execução foi alterado.** O que muda nesta entrega é o
catálogo de capacidades (já commitado, item separado do P1) e este documento.

---

## 1. Mapeamento — todo caminho de fallback implícito

### `GROQ_API_KEY`

Uma única leitura, em `src/lib/ai/settings.ts:150`, dentro de `getDemoConfig()`.
Ela lança (`SemProvedorDeIA`) quando a variável não existe — não silencia.

`getDemoConfig()` é chamada em um lugar: `resolveLegacyRouting`
(`settings.ts:229`), quando não há `ai_settings` ativo para o workspace.

**Estado real, hoje:** `GROQ_API_KEY` não está definida nem em `.env.local` nem
na Vercel. `getDemoConfig()` sempre lança. É o que produziu o vazamento que a
correção anterior conteve — o caminho é alcançável e falha, não está morto.

### `AI_CHAT_FALLBACK_PROVIDER` / `_MODEL` / `_API_KEY`

Três variáveis, lidas juntas em `getExplicitChatFallbackConfig()`
(`settings.ts:167`), só para a feature `chat`. Comportamento: as três ausentes
→ `null` (sem fallback); qualquer subconjunto presente sem as outras duas →
lança. **Nenhuma das três está definida** em `.env.local` nem na Vercel.

### `getSameProviderFallback`

Não depende de variável de ambiente. Se o provedor primário é `groq` e o
modelo não é `DEMO_FALLBACK_MODEL` (`openai/gpt-oss-120b`), propõe uma segunda
tentativa no mesmo provedor com esse modelo. Como não há chave Groq
configurada em lugar nenhum, esta função nunca produz uma tentativa que
funcione — mas o *código* que a chama continua ativo.

### A cadeia completa, do pedido à chamada

```
POST /api/ai/chat
  → resolveChatRouting() → resolveFeatureRouting("chat")
    → workspaceId nulo?          → resolveLegacyRouting(feature, null)
    → sem policy em ai_routing_policies?
                                  → resolveLegacyRouting(feature, workspaceId)
    → policy existe, mas as duas configs (primary/fallback) resolvem vazias?
                                  → resolveLegacyRouting(feature, null)  [linha 276]

resolveLegacyRouting(feature, workspaceId)
  → getActiveConfig(workspaceId, feature)   [se workspaceId]
    → null → getDemoConfig()                → lança SemProvedorDeIA hoje
    → não-null → primary = essa config
  → fallback = getExplicitChatFallbackConfig() ?? getSameProviderFallback(primary)
```

**Achado do mapeamento:** existem **três** rotas independentes até
`resolveLegacyRouting`, não uma. A política de roteamento (`ai_routing_policies`)
tem uma saída para o legado embutida na própria função — não é "usa a política
OU usa o legado", é "usa a política, e se ela não resolver nada, cai no
legado mesmo assim". Isso importa para o P1: desligar o fallback global exige
mexer nos três pontos de entrada, não em um.

### `ai_settings` e `ai_routing_policies` — estado das tabelas

Zero linhas nas duas, no banco de produção. RLS desde o G1: as quatro operações
em `ai_settings` exigem `owner`; o mesmo em `ai_routing_policies`. Nenhuma
migração deste parecer é necessária para o P0 — o esquema já suporta perfil
único por `role`.

### Onde a chave é cifrada

`src/lib/ai/crypto.ts`, AES-256-GCM, chave de `AI_SETTINGS_ENCRYPTION_KEY`
(presente em `.env.local` e na Vercel). Não muda.

---

## 2. Catálogo de candidatos Qwen multimodais — **nenhum ativado**

Dois caminhos de acesso avaliados. Nenhuma chave foi criada; nenhuma conexão
existe.

### Caminho A — Alibaba Cloud Model Studio (ex-DashScope), direto

Endpoint internacional (Singapura), que é o único com cota gratuita para quem
não está na China. Modelos com visão: `qwen-vl-plus`, `qwen-vl-max`, e a linha
mais nova `qwen3.x-vl-*`.

**O que não consegui confirmar por fonte oficial**, e registro em vez de
inventar: a conversão de imagem em tokens (resolução → número de tokens) e o
preço isolado da parcela de imagem. A documentação pública de preços que
encontrei não desagrega isso por modelo de visão. Antes de ativar este
caminho, alguém precisa abrir a página de preços dentro do console (exige
conta) ou eu preciso de acesso a uma fonte que hoje não tenho.

### Caminho B — OpenRouter, roteando para Qwen

Um único formato de API para vários modelos, incluindo Qwen. Preços públicos e
por-token, desagregados:

| Modelo | Entrada (US$/1M tok) | Saída (US$/1M tok) | Contexto | Visão |
|---|---:|---:|---:|:---:|
| Qwen3 VL 8B Instruct | 0,117 | 0,455 | — | sim |
| Qwen3 VL 32B Instruct | 0,104 | 0,416 | 131.072 | sim |
| Qwen2.5 VL 72B Instruct | 0,25 | 0,75 | — | sim |
| Qwen VL Plus | 0,1365 | 0,4095 | — | sim |
| Qwen VL Max | 0,80 | 3,20 | — | sim |

Fontes: [Qwen3 VL 32B Instruct — OpenRouter](https://openrouter.ai/qwen/qwen3-vl-32b-instruct),
[Qwen3 VL 8B Instruct](https://openrouter.ai/qwen/qwen3-vl-8b-instruct),
[Qwen2.5 VL 72B Instruct](https://openrouter.ai/qwen/qwen2.5-vl-72b-instruct),
[Qwen-VL-Plus — LLMReference](https://www.llmreference.com/model/qwen-vl-plus/openrouter),
[qwen-vl-max — LangDB](https://langdb.ai/app/models/qwen-vl-max/).

Preços de referência para Alibaba direto, por comparação (não confirmados
oficialmente, ver ressalva acima):
[Qwen API Pricing — BenchLM](https://benchlm.ai/alibaba/api-pricing),
[Qwen API Pricing — deepinfra](https://deepinfra.com/blog/qwen-api-pricing-2026-guide).

**Recomendação para o P1, sujeita a revisão** *(retirada — ver correção
abaixo)*: ~~Caminho B, com Qwen3 VL 32B Instruct~~, por três motivos
concretos — preço mais baixo da tabela junto do Qwen3 VL 8B; contexto de
131k confirmado por fonte primária (a página do próprio modelo); e o
adaptador `openrouter` **já existe** no código (`src/lib/ai/provider.ts`),
então nenhum adaptador novo é necessário — só uma entrada de catálogo, que é
o que o P1 já sabe fazer. O caminho A ficava registrado como alternativa de
custo por-token potencialmente menor, a confirmar antes de trocar.

> **Correção de direção (2026-09-03), depois deste parecer:** esta
> recomendação venceu por reduzir trabalho de código — o adaptador já
> existir —, não pela comparação que o P2 ainda vai fazer. Isso é
> exatamente o critério que a correção rejeitou. O Caminho B segue no
> catálogo de comparação (`src/lib/ai/candidatos-qwen.ts`) como uma das
> alternativas, ao lado do Caminho A direto — nenhum dos dois é o padrão. A
> decisão de modelo/caminho fica para o P2, depois do benchmark GE rodado
> nos dois caminhos, contexto de 131k não é critério decisivo (o Brennimark
> limita a 8 fontes), e nenhuma chave, crédito ou conexão foi criada a
> partir desta recomendação.

---

## 3. Estimativa de custo do benchmark GE

Com Qwen3 VL 32B Instruct via OpenRouter, e as premissas abaixo — **explícitas
porque números sem premissa não são estimativa, são chute**:

- Conversão grosseira de 4 caracteres por token (padrão para texto latino).
- Contexto de pergunta/prompt: teto de `LIMITES_DE_IA` — 8.000 caracteres de
  fontes + até 2.000 de pergunta + ~1.500 de prompt de sistema e regras de
  fundamentação ≈ 11.500 caracteres ≈ **2.900 tokens de entrada**.
- Resposta com citação: ~500 tokens de saída para pergunta/prompt.
- Análise de imagem: mesmo contexto textual (2.900) + uma peça em resolução
  moderada. **Sem a conversão oficial de imagem→token (ver §2), uso 1.500
  tokens como estimativa de posição intermediária**, e a incerteza é grande o
  bastante para eu não apresentar isso como preciso.
- Saída de análise: ~600 tokens (parecer estruturado costuma ser mais longo
  que uma resposta de chat).

| Cenário | Qtd | Entrada (tok) | Saída (tok) | Custo entrada | Custo saída |
|---|---:|---:|---:|---:|---:|
| Perguntas sobre o manual | 20 | 58.000 | 10.000 | US$ 0,0060 | US$ 0,0042 |
| Prompts | 10 | 29.000 | 5.000 | US$ 0,0030 | US$ 0,0021 |
| Análises de imagem | 20 | 88.000 | 12.000 | US$ 0,0092 | US$ 0,0050 |
| **Total (50 execuções)** | | | | **US$ 0,0182** | **US$ 0,0113** |

**Total estimado: ≈ US$ 0,03** (três centavos de dólar).

Mesmo com erro de 5× nas premissas de imagem — o ponto mais incerto — o
benchmark inteiro fica abaixo de **US$ 0,15**. O crédito pré-pago mínimo de
qualquer provedor cobre isso com folga; o teto não é o custo do benchmark, é
o risco de uso indevido depois de publicado, que é o que a Fase 2 do briefing
(orçamento, reserva, ledger) existe para conter.

---

## 4. Plano de arquivos e testes para o P1 — antes de alterar execução

Nomenclatura ajustada ao contrato do briefing
(`AIModelCapabilities`, `AIExecutionRequest`) sobre o que já existe
(`ModelCapabilities` do catálogo, commitado).

### Arquivos novos

| arquivo | responsabilidade |
|---|---|
| `src/lib/ai/execucao.ts` | `AIExecutionRequest` / `AIExecutionResult`: o contrato único que rotas chamam, independente de provedor. |
| `src/lib/ai/perfil-demo.ts` | O perfil Qwen de demonstração: server-only, sem fallback, sem seleção de modelo pelo cliente. |
| `src/lib/ai/orcamento.ts` | Reserva antes da chamada, consolidação depois, liberação em falha. Puro na aritmética; a leitura/escrita do banco entra por parâmetro — mesmo padrão de `podeUsar`. |
| `supabase/migrations/…_orcamento_de_ia.sql` | Tabelas de orçamento e ledger. Migração isolada; preflight de contagem antes. |

### Arquivos que mudam

| arquivo | mudança |
|---|---|
| `src/lib/ai/settings.ts` | `resolveLegacyRouting` para de chamar `getDemoConfig()`; as três entradas do mapeamento (§1) convergem para "sem perfil, mensagem de produto" em vez de silenciosamente cair no demo. `getExplicitChatFallbackConfig` e `getSameProviderFallback` saem — são fallback implícito, e o briefing proíbe. |
| `src/app/api/ai/chat/route.ts`, `analyze/route.ts` | Passam a chamar o contrato de execução, não o roteamento legado direto. |
| `src/lib/ai/provider.ts` | `getDemoConfig` e `DEMO_FALLBACK_MODEL` saem, ou ficam atrás de um guard explícito de `NODE_ENV === "development"` — a decidir no P1 junto da equipe, porque o briefing permite adaptador local só para desenvolvimento. |

### Testes obrigatórios do P1 (do próprio briefing, mapeados a onde nascem)

| teste | arquivo |
|---|---|
| modelo/endpoint fora de catálogo é recusado antes da chamada | `catalogo.test.ts` — **já existe**, commitado |
| configuração Qwen não chega ao cliente | `perfil-demo.test.ts`, novo |
| `GROQ_API_KEY` não volta como fallback | `settings.test.ts` — adicionar caso |
| erro não exibe segredo/endpoint/arquivo | `errors.test.ts` — **já existe**, estender para o caso Qwen |
| orçamento esgotado não chama provedor | `orcamento.test.ts`, novo |
| falha na reserva/ledger impede cobrança | `orcamento.test.ts`, novo |
| versão web nunca seleciona adaptador local | guarda estrutural em `leak-guard.test.ts` |
| marca A não recupera nem envia fonte da B | **já coberto** — A1, `buscar.test.ts` |
| perfil sem visão recusa imagem sem cobrança | `execucao.test.ts`, novo |
| member não configura conexão/modelo/orçamento | RLS + `donoDaRota` — padrão do G1, estender |

---

## 5. O que este parecer NÃO decide

Não escolhe o modelo padrão — isso é o benchmark real (P2), não a tabela de
preços. Não cria a tabela de orçamento nem o perfil — isso é P1, código, com
revisão própria. Não ativa nenhuma conta com nenhum provedor.
