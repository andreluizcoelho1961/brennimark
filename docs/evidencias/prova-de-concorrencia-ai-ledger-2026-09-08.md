# Prova de concorrência do razão de IA — as quatro corridas

**Data:** 08/09/2026 · **Rig:** [`scripts/prova-de-concorrencia-ai-ledger.sh`](../../scripts/prova-de-concorrencia-ai-ledger.sh)
· **Alvo:** stack local (`supabase_db_brennimark`), nunca produção.

Este documento existe porque a versão anterior dele não existia. As quatro
corridas rodaram em 05/09 contra o stack local, com a espera observada em
`pg_stat_activity` — e o ensaio se perdeu no `db reset` seguinte, sem ter
sido registrado. `supabase/RECONCILIACAO.md` classificou isso como o portão
pendente do PR #3. O rig agora é versionado e reexecutável: a prova deixa de
depender de alguém lembrar que rodou.

## O que uma corrida precisa provar

Duas coisas, e a segunda é a que costuma faltar:

1. **O estado final da linha está correto** — é onde o dinheiro fica.
2. **Houve disputa de fato.** A segunda sessão precisa ter *esperado*. Sem
   isso, um resultado correto pode ser acidente de agendamento: as duas
   transações rodaram em fila e nenhuma trava foi exercitada. Por isso cada
   corrida consulta `pg_stat_activity` procurando um backend em
   `wait_event_type = 'Lock'`, e trata a ausência de espera como falha, não
   como sucesso rápido.

## A corrida 1 roda dos dois lados

`prova_antes.consolidar` é a função corrigida com **exatamente duas coisas
removidas**: o `for update` da leitura e o predicado `and status = 'reserved'`
do `update`. Nada mais. Isolar as duas guardas é o que torna o contraste
atribuível a elas.

Sem esse lado, o resto não seria prova: um teste que passa antes e depois da
correção não testa a correção.

## Execução registrada

```
Corrida 1a — consolidar × consolidar, SEM `for update` (defeito esperado)
  OK    a segunda sessão esperou de fato (1 backend em Lock)
  OK    a segunda liquidação sobrescreveu a primeira (o defeito) — 999

Corrida 1b — consolidar × consolidar, COM `for update` (idempotência)
  OK    a segunda sessão esperou de fato (1 backend em Lock)
  OK    a primeira liquidação prevaleceu — 111
  OK    a segunda não deixou rastro — A

Corrida 2 — consolidar × liberar
  OK    a segunda sessão esperou de fato (1 backend em Lock)
  OK    a liquidação sobreviveu à liberação concorrente — settled|111

Corrida 3 — marcar exposição × expirar
  OK    a segunda sessão esperou de fato (1 backend em Lock)
  OK    a reserva exposta foi liquidada pelo teto, não liberada — settled|5000|expirada_apos_exposicao

Corrida 4 — marcar exposição × liberar
  OK    a segunda sessão esperou de fato (1 backend em Lock)
  OK    nada libera uma reserva exposta — settled|5000|exposto_sem_uso_medido

As quatro corridas passaram.
```

Três execuções consecutivas, todas verdes. Onze asserções, quatro esperas
observadas.

## O que cada corrida sustenta

| # | Corrida | Invariante |
|---|---|---|
| 1a | `consolidar` × `consolidar`, pré-correção | **Reprodução do defeito.** As duas liquidações gravam; a última vence. O razão fica com um número que nenhuma execução mediu. |
| 1b | `consolidar` × `consolidar`, corrigida | A primeira liquidação prevalece; a segunda é o no-op que o comentário da função sempre prometeu. |
| 2 | `consolidar` × `liberar` | Liberar afirma que não houve custo. Depois de uma liquidação essa afirmação é falsa, e a função cala em vez de corrigir. |
| 3 | `marcar_exposicao` × `expirar` | A corrida que motivou a coluna. A expiração encontra a linha exposta no último instante e **liquida pelo teto em vez de liberar** — liberar apagaria custo real. |
| 4 | `marcar_exposicao` × `liberar` | A janela estreita do abort entre marcação e despacho. **Nada libera uma reserva exposta**; liquida-se pelo teto, o erro barato. |

A corrida 3 merece uma nota de mecanismo: sob `read committed`, o `update`
que procura `charge_exposed_at is null` desbloqueia, **reavalia o predicado
sobre a versão nova da linha** e não a encontra mais — então a linha cai fora
do destino "liberar" e é apanhada pelo `update` seguinte, o que liquida pelo
teto. A distinção não depende de ordem de chegada; depende de a expiração ter
dois destinos em vez de um.

## Limites desta prova

- **É o stack local, não produção.** Prova o comportamento das funções sob
  concorrência; não prova nada sobre carga, latência ou pool de conexões.
- **Duas sessões, não N.** As travas serializam por linha, e o que está em
  jogo é sempre a mesma linha do razão — mas o ensaio não caracteriza
  contenção sob concorrência alta.
- **A migração `20260905160000` foi aplicada ao stack local para o ensaio, e
  segue não aplicada em produção.** Ela continua sendo a única migração local
  pendente, conforme `supabase/RECONCILIACAO.md`. Aplicar em banco é decisão
  do proprietário, e este documento não a antecipa.
