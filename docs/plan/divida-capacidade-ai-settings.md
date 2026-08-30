# Dívida: `ai-settings` cai na capacidade padrão

**Registrada em:** 30/08/2026 · **Bloqueia:** convidar o primeiro membro
**Não bloqueia:** o importador, que é operado por quem administra

## O que é

`shellSections` concede cada destino a `d.requires ?? "consultar"`. O destino
`/docs/configuracoes/ia` não declara `requires`, então ele cai no padrão: um
**member** vê o link e alcança a tela.

## Por que importa

Configurações de IA são **compartilhadas pela conta**: chave do fornecedor,
modelo principal, rota de reserva, autorização de gasto. Um member trocar o
modelo muda o comportamento do assistente para todo mundo — e a chave é
credencial paga da conta.

Isto não é vazamento entre marcas nem falha de RLS. É uma capacidade escolhida
errado: o destino nasceu quando só existia owner.

## Por que não bloqueia hoje

O banco tem um papel além de owner — `member` — mas nenhum usuário. Enquanto a
conta tiver só quem administra, `consultar` e `administrar` coincidem na
prática.

## A correção, quando vier

Duas metades, e as duas são obrigatórias:

1. **Navegação:** `{ href: "/docs/configuracoes/ia", requires: "administrar" }`.
2. **Servidor:** as rotas de `/api/ai/*` que leem ou gravam `ai_settings` e
   `ai_routing_policies` precisam exigir `administrar`, não só sessão.

A segunda é a que vale. Esconder o destino tira o link, não a rota — e o ADR-0002
já diz que capacidade decide o que APARECE, enquanto o que é PERMITIDO se decide
no servidor.

## Como saber que foi feito

Um teste com papel `member` que recebe 403 nas rotas de IA, e outro que confirma
a ausência do destino na navegação.
