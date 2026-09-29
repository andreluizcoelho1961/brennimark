# ADR-0008 — A IA é da plataforma

- **Status:** **aceito**
- **Data:** decidido em 28/09/2026; registrado e aplicado ao Vini em 29/09/2026
- **Decidido por:** André, na conversa de 28/09/2026 sobre as Configurações do assinante
- **Relaciona-se com:** ADR-0003 (produto hospedado multi-marca), ADR-0004 (o produto age na criação)
- **Corrige o CLAUDE.md:** a "Camada de IA" descrevia chave por conta (BYOK: cada conta traz a sua);
  a correção entra **no mesmo commit**

## 1. Contexto

Até aqui cada conta trazia a sua IA: escolhia provedor e modelo, colava a chave numa tela de
configuração, e o produto guardava a chave cifrada em `ai_settings`, com a ordem das reservas em
`ai_routing_policies`. Isso fazia sentido quando a conta pagava a própria IA.

O produto vendido é outro: uma **assinatura mensal** que inclui IA, armazenamento e manutenção.
Nesse modelo, a pergunta "qual provedor você quer?" é atrito para o cliente e risco para a
Brennimark: quem escolhe o modelo escolhe o custo, e o custo é da Brennimark.

## 2. Decisão

**Nenhum assinante escolhe ou configura IA, nem no Studio nem no Book.** A Brennimark contrata os
modelos, escolhe qual usar pelo preço e pelo mercado, e é dona dos motores do Vini.

### 2.1 Onde mora cada coisa

| O quê | Onde | Quem mexe |
|---|---|---|
| Chave de cada provedor | variável da Vercel, `BRENNIMARK_CHAVE_<PROVEDOR>` | a equipe, no painel da Vercel |
| Modelo, reservas e espera de cada tarefa | `private.rotas_de_ia`, via Console | a equipe, com motivo registrado |
| Limite de gasto por conta (dia e mês) | `ai_budgets`, via Console | a equipe; o cliente só lê |
| Custo em dólar | razão de IA, via Console | só a equipe vê |

A chave **nunca** vai ao banco nem a tela nenhuma. O Console diz se ela existe, e mais nada.

### 2.2 O Vini

A rota de cada pedido vem de `rotas_de_ia_da_plataforma()` — só a chave de serviço executa — com a
chave do provedor lida do ambiente (`src/lib/ai/rotas-da-plataforma.ts`). É a mesma para todas as
contas. O que continua **por conta** é o orçamento: a reserva no razão confere o limite do dia e do
mês daquela conta antes de chamar o provedor.

Rota sem chave ou com modelo fora do catálogo é pulada — o log do servidor diz qual e por quê — e a
próxima reserva assume. Sem nenhuma, o cliente lê "O Vini está indisponível no momento. Se
continuar, fale com o suporte da Brennimark": não há o que ele configurar.

### 2.3 Fase de testes: custo zero

Até a primeira agência pagar, as chaves são de contas **gratuitas** (Google com projeto sem
faturamento, Groq no plano gratuito). Plano gratuito de provedor pode usar o conteúdo enviado para
treinar modelos; por isso **manual de cliente real nunca passa por chave gratuita**. Nesta fase só
entram manuais públicos e a marca de demonstração.

A troca para chaves pagas não pede código: é trocar o valor da variável na Vercel e, se for o caso,
as rotas no Console.

## 3. Consequências

- `ai_settings` e `ai_routing_policies` deixam de ser lidas pelo Vini. **Ficam no banco**, com o que
  têm: nada é apagado. A tela "Provedores de IA" e as rotas que a servem saem na parte 3 da etapa 2.
- As Configurações do assinante ficam com uso sem valor em dinheiro, Plano e Aceites.
- Trocar de modelo ou de provedor é decisão de operação, no Console, com motivo — e vale para todas
  as contas de uma vez.
- Uma chave que falta derruba o provedor para todos. O Console mostra a ausência, e a reserva de
  outro provedor é a proteção.

## 4. Reversibilidade

Barata. As tabelas por conta continuam no banco; voltar a "cada conta traz a sua IA" seria religar a
leitura antiga em `resolveFeatureRouting` e devolver a tela. Nada foi apagado para tornar esta
decisão possível.
