# Marco B — estado em 10/09/2026

**"O sistema propõe a navegação, eu corrijo a estrutura pela interface, e nenhuma
página do original se perde."**

**Estado honesto: Marco B alcançado no ambiente local. Publicação em produção
ainda pendente.** Nenhuma migração da Fatia 2 está aplicada em produção, e o PR
não foi mergeado.

Este documento registra o aceite, o que foi medido e o que continua aberto.
Nenhum PDF, captura de tela ou trecho do material real do cliente está no Git —
só contagens, códigos e consultas.

---

## 1. Decisões de André, 10/09

| # | Decisão | Consequência |
|---|---|---|
| 1 | **Publicação em duas transações, como solução TRANSITÓRIA** | registrada como dívida em `desenho-documento-fonte-e-manifesto.md` §9; a publicação inteira deve migrar para uma transação única no servidor |
| 2 | **A interface não declara sucesso antes de o manifesto estar registrado** | o importador só navega depois de `POST /api/documento-fonte/registrar` responder com `documentoId` |
| 3 | **`source_document_id is null` é publicação incompleta e visível** | faixa de retomada no manual original, que sobrevive a recarregamento |
| 4 | **O ator vem da sessão; `service_role` fica só no servidor** | dois clientes na rota: a sessão resolve sob RLS, a chave de serviço só executa a RPC |
| 5 | **B2 aprovada** | após o aceite local com dado real, descrito abaixo |

## 2. O critério, e como foi atendido

Aceite conduzido pela interface, no stack local, com o manual de identidade do
Bradesco (47 páginas, SHA-256 com prefixo `044392d3`). O PDF foi usado por cópia
de transporte fora do repositório e apagado ao fim.

| Passo | Resultado |
|---|---|
| Importar | prévia: 47 páginas, 43 seções, 1 página sem texto |
| Cinco correções pela interface | renomear, dividir, unir, mover (na prévia) e remover (no painel, depois de publicar) |
| Publicar | sucesso só depois da transação B; B concluída **322 ms** após A |
| Manifesto | 47 linhas, 47 distintas, faixa 1..47, **nenhuma página ausente** |
| Coerência | conta, marca, hash, caminho e contagem idênticos entre importação e documento-fonte; um documento `ativa` |
| Títulos repetidos | 7 títulos repetidos em 29 seções; slugs desempatados; **0** divergências entre o slug do relatório e o da seção |
| Remover seção | a página ficou `sem-secao` com motivo escrito pelo gatilho, e continua desenhada no original |
| Recarregar | estrutura persistiu, **47/47** páginas acessíveis, sem aviso de incompleta, pendência de seção visível |
| Páginas sem seção | 2, ambas com motivo; **0** sem motivo |

### 2.1 Falha repetível da transação B, simulada

A RPC da transação B foi renomeada temporariamente **no banco local**, para a
chamada receber `PGRST202`. Depois o nome foi devolvido, com as permissões
conferidas (`service_role` executa, `authenticated` não).

- a transação A continuou publicada — marca, 43 seções, PDF no Storage;
- `source_document_id` ficou nulo, e a B não gravou nada;
- a interface mostrou "Publicação incompleta", ofereceu nova tentativa e não navegou;
- o navegador recebeu só o código `falha_temporaria`; o detalhe técnico ficou no log do servidor;
- depois de recarregar, o manual original ofereceu a retomada; uma nova tentativa ainda com a falha manteve o vínculo nulo;
- restaurada a RPC, a retomada concluiu: 1 documento-fonte e 47 páginas naquela marca;
- dois reenvios depois do sucesso responderam `jaEstava` com o mesmo documento, e o banco não mudou.

## 3. Números

| Medida | Valor |
|---|---|
| Transação B após A (aceite) | 322 ms |
| `POST /registrar` de sucesso | 260 ms e 330 ms |
| A, do clique à gravação, com a aba visível | 11,5 s |
| B em 1.000 páginas (`scripts/medir-manifesto-de-mil-paginas.sh`) | 40,9 ms |
| Prova SQL (`scripts/prova-manifesto-por-pagina.sh`) | 53 verificações |

## 4. Defeitos encontrados no aceite

| # | Defeito | Classe | Estado |
|---|---|---|---|
| 1 | O atalho `jaEstava` respondia `paginasSemSecao: 0` sem medir; a marca tinha 1 página sem seção | P3, B2 | **corrigido** em `7f6a54a` — ver §6 |
| 2 | A renderização da publicação **congela com a aba oculta**: `requestAnimationFrame` não dispara, e a publicação levou ~23 min em vez de segundos | P2, produto | aberto — antes de demonstração a cliente |
| 3 | A prévia do importador não oferece "remover seção"; remover só existe depois de publicar | P3, curadoria | aberto |
| 4 | A página sem texto recebe o motivo "não entrou em nenhuma seção", embora a extração saiba que ela não tem texto | P3, manifesto | aberto |
| 5 | `enqueue_import_cleanup` declara `on conflict` com duas colunas contra um índice único de três, e falha com `42P10` em toda chamada | **bloqueador operacional** | aberto, em trabalho separado |

Achados que **não** são defeito de produto:

- **Imagem de página quebrada no ambiente local.** O otimizador do Next recusa
  host que resolve para IP privado (`image-optimizer.js:939–942`). Em produção o
  Supabase resolve para IP público. `dangerouslyAllowLocalIP` não foi ligado, por
  risco de SSRF.
- **Dois `HEAD` com `503`** apareceram só na captura da extensão; o servidor
  registrou `200` e não foi possível reproduzir.

## 5. O que não foi exercitado

- produção — a migração não foi aplicada;
- `falha_de_leitura` e `sem_permissao` pela interface (só em teste de unidade);
- retomada a partir de outro aparelho ou por outra pessoa;
- duas abas concluindo o mesmo registro ao mesmo tempo;
- dividir, unir ou mover **depois** de publicar, e atribuir seção a página sem seção — não há tela para isso;
- manual acima de 47 páginas (o de 743 páginas e o limite de 100 MB);
- limites de função da Vercel e dispositivos móveis.

## 6. Correção feita depois do aceite — `7f6a54a`

`paginasSemSecao` passou a ser `number | null`. `null` significa **não medido**,
e nunca vira `0`: zero é uma afirmação, e quem lê um zero esconde o aviso. O
mesmo zero falso existia em mais dois lugares, e os três foram corrigidos juntos:

- o atalho `jaEstava` da rota de registro;
- o parse do navegador, que convertia ausência em `0`;
- o manual original, que mostrava `0` quando a contagem **falhava**.

Dois testes garantem que uma resposta idempotente nunca declara falsamente zero
páginas sem seção — um no servidor, outro no navegador. Cada um reprova quando o
zero é reintroduzido no seu lado.

Verificação: `npm run verify` completo (736 unidade, build, 285 navegador) e as
53 verificações da prova SQL.

**Um incidente na verificação, registrado para não ser confundido com
regressão.** A primeira execução do `verify` teve 151 falhas de navegador. A
primeira foi `ERR_EMPTY_RESPONSE` no meio de uma requisição, e todas as
seguintes foram `CONNECTION_REFUSED` nos três motores: o servidor de teste
morreu no meio da execução. Uma sonda fora da suíte mostrou que Firefox e
Chromium alcançam `localhost` normalmente, então não era permissão do macOS.
A rota que caiu é a de laboratório, que não passa pelos arquivos corrigidos.
Com a porta livre, a suíte passou inteira, duas vezes.

A causa provável — **não provada** — é colisão de porta. Havia outra sessão
trabalhando em paralelo noutro worktree, que pode ter rodado o próprio `verify`
no mesmo intervalo; isso não foi observado, e não sobra histórico de processo
para confirmar. O mecanismo existe: o Playwright usa a porta 3210 com
`reuseExistingServer` fora do CI, então uma suíte pode reaproveitar o servidor
da outra e perdê-lo quando a outra termina. Enquanto houver trabalho paralelo
em worktrees, duas suítes de navegador não devem rodar ao mesmo tempo nesta
máquina.

## 7. Antes da produção, nesta ordem

1. Corrigir `enqueue_import_cleanup` — trabalho e PR separados. É a fila que
   impede um PDF de cliente de ficar no Storage sem dono, e hoje ela não funciona.
2. Corrigir o congelamento da renderização com a aba oculta — antes de qualquer
   demonstração a cliente.
3. Aplicar a migração `documento_fonte_e_manifesto_por_pagina` em produção.
4. Só então o merge do PR, **mediante autorização nominal**.

A migração e o merge acontecem na mesma janela, com a migração primeiro. Se o PR
entrar sem ela, toda publicação em produção passará a mostrar "Publicação
incompleta", porque a RPC não existe lá.
