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
| 2 | A renderização da publicação **congela com a aba oculta**: `requestAnimationFrame` não dispara, e a publicação levou ~23 min em vez de segundos | P2, produto | **corrigido em 11/09** — ver §8. Provado com a aba oculta simulada; não conferido ainda numa aba oculta de verdade |
| 3 | A prévia do importador não oferece "remover seção"; remover só existe depois de publicar | P3, curadoria | aberto |
| 4 | A página sem texto recebe o motivo "não entrou em nenhuma seção", embora a extração saiba que ela não tem texto | P3, manifesto | aberto |
| 5 | `enqueue_import_cleanup` declara `on conflict` com duas colunas contra um índice único de três, e falha com `42P10` em toda chamada | **bloqueador operacional** | **corrigido em 10/09** — PR #21, aplicado em produção |

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

1. ~~Corrigir `enqueue_import_cleanup`~~ — **feito em 10–11/09**: PRs #21 (a
   função enfileira de fato, aplicada em produção) e #22 e #24 (a recusa da fila
   deixa rastro no log do servidor).
2. ~~Corrigir o congelamento da renderização com a aba oculta~~ — **feito em
   11/09**, ver §8. Falta conferir uma vez com a aba oculta de verdade.
3. Aplicar a migração `documento_fonte_e_manifesto_por_pagina` em produção.
4. **Alinhar o nome do arquivo ao ledger, no PR** — ver abaixo.
5. Só então o merge do PR, **mediante autorização nominal**.

A migração e o merge acontecem na mesma janela, com a migração primeiro. Se o PR
entrar sem ela, toda publicação em produção passará a mostrar "Publicação
incompleta", porque a RPC não existe lá.

### 7.1 O passo 4 existe porque o timestamp do arquivo é mais velho que o ledger

*Acrescentado em 11/09/2026.*

O arquivo é `20260910140000_documento_fonte_e_manifesto_por_pagina.sql`, mas
produção já registra duas migrações posteriores: `20260910213339` e
`20260910215914`. Aplicada pela ferramenta do Supabase, a migração entra no
ledger com o **horário da aplicação**, não com o do nome do arquivo — foi o que
aconteceu com o kill switch, arquivo `20260909160000`, ledger `20260910215914`,
e o que o PR #23 teve de consertar depois.

Sem o passo 4, `historico-de-migracoes.test.ts` encontra no repositório uma
migração cujo timestamp não está no ledger, e **reprova o CI do PR**. O merge
trava com produção já migrada e o código fora dela — a janela que a ordem acima
existe para evitar.

Na janela, então:

1. aplicar a migração e **ler no ledger** o timestamp que ela recebeu
   (`list_migrations`), em vez de presumir;
2. no PR, renomear o arquivo para esse timestamp (`git mv`, conteúdo
   intocado), acrescentar a linha em `supabase/historico-remoto.txt` e tirar o
   nome de `PENDENTES_ESPERADAS`;
3. CI verde;
4. merge;
5. importar um manual em produção e conferir manifesto, recarga e preservação
   das páginas.

`bucket_alinhado_ao_plano_gratuito` (`20260909213000`) está na mesma situação e
vai precisar do mesmo ajuste quando for aplicada.

## 8. Correção do congelamento com a aba oculta — 11/09

**Causa, dois freios do navegador:**

1. o pdf.js desenha cada página em fatias de ~15 ms e agenda a próxima com
   `requestAnimationFrame`. Aba oculta não tem quadro, e a página para no meio;
2. entre páginas, o importador cedia com `setTimeout(0)`, que o Chrome limita a
   um por segundo em aba oculta e, depois de cinco minutos, a um por minuto —
   o que explica os ~23 minutos.

**Correção, em `src/lib/import/pdf.ts`:** o desenho de página da publicação não
espera quadro (o canvas vira PNG e sobe; a tela não mostra o desenho), e a
pausa entre páginas usa `MessageChannel`, que não sofre a limitação de timers.
Não se usou `intent: "print"`, que desligaria o quadro pela API pública: ele
muda o que é desenhado — anotações "não imprimir", camadas opcionais — e a
imagem precisa ser a da tela. O campo desligado é interno do pdf.js; se uma
atualização o renomear, o teste abaixo reprova.

**Prova:** `e2e/importador-aba-oculta.spec.ts`, nos três motores. A página se
declara oculta e `requestAnimationFrame` nunca executa; a publicação de
`manual-visual.pdf` precisa desenhar e enviar as páginas visuais e chegar à RPC
em até 20 s. Contraprova: com a correção desligada, o teste reprova nos três
motores, sem nenhum pedido depois do clique — o congelamento reproduzido.

**Verificação da versão integrada** (Fatia 2 + `main` até o #24):
`npm run verify` completo (758 unidade, build, 288 navegador); prova do
manifesto, 53 verificações; prova da fila de limpeza (#21), 18 verificações —
todas verdes no banco local.

**O que a simulação não cobre:** a limitação de timers em si (o teste não
reduz a frequência dos timers) e uma aba oculta de verdade. Falta uma
publicação com o manual real e a aba em segundo plano, medindo o tempo.

## 9. Banco local recriado do zero — 11/09

Autorizado por André, com escopo explícito: só o stack Supabase **local**,
nenhuma ação em produção, marcas não restauradas por SQL, nada do material do
cliente versionado, sem merge do PR nesta etapa.

**Antes:** este relatório conferido no Git, sem imagem ou PDF embutido; o PDF
original do aceite conferido fora do Git, com o mesmo SHA-256 (`044392d3…`),
para uma reimportação futura. O stack local é único (`project_id =
"brennimark"`), compartilhado pelos worktrees; o reset rodou a partir deste,
com as migrations desta branch integrada à `main` até o #24.

**Replay:** `npx supabase db reset`, sem `--linked`.

| Verificação | Resultado |
|---|---|
| Migrations aplicadas × arquivos da branch | **53 × 53**, nenhuma diferença |
| Erros no log do reset | 0 |
| Avisos | 1 `NOTICE` preexistente: `brand_assets_brand_idx` já existe, `if not exists` pula |
| Diferença com o ledger local anterior | só o kill switch, agora `20260910215914` — o mesmo carimbo de produção |
| Dados depois do reset | 0 marcas, 0 usuários, 0 documentos-fonte |
| Prova do manifesto | **53/53** verdes |
| Prova da fila de limpeza (#21) | **18/18** verdes |
| Resíduo depois das provas | 0 marcas, 0 usuários |
| `supabase db lint --level warning` | nenhum problema |
| `npm run verify` em `2008ae1` | 758 unidade, build, 288 navegador |
| CI do PR #19 em `2008ae1`, contra a `main` em `22cbf4a` (até o #24) | verde, 13 min 55 s — [run 34608240561](https://github.com/andreluizcoelho1961/brennimark/actions/runs/34608240561) |

**Consequência:** as duas marcas locais, incluindo a do aceite com o manual do
Bradesco, e a conta local deixaram de existir. O registro do aceite (§2–§3)
continua válido como evidência daquela rodada; uma nova reimportação fica para
o smoke test da versão integrada ou para a janela de produção.

**Não coberto:** os advisors do Supabase só existem no projeto hospedado e não
foram consultados — nenhuma ação em produção nesta etapa.
