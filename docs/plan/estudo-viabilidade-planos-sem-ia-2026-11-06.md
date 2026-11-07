# Viabilidade dos planos sem IA (estudo de 06/11/2026)

Continuação de `estudo-plano-sem-ia-2026-11-06.md`. Parte da leitura do André sobre a Happy House: os
R$ 150 por mês eram para **5 marcas**, sem IA. Este documento testa se uma escada assim fecha a
conta para a Brennimark. **São números para discutir, não proposta de preço.** Nada vai ao site ou
ao Stripe antes de o André decidir, e nenhum valor nosso é dito a cliente antes de ouvir o dele.

## 1. A escada proposta pelo André

| Plano sem IA | Marcas | Mensal (hipótese) | Por marca | Observação |
|---|---|---|---|---|
| **A** | até 5 | **R$ 150** | R$ 30,00 | o que a Happy aceitaria; contrato de 1 ano como teste |
| **B** | até 15 | **R$ 400** | R$ 26,67 | menos que o triplo (R$ 450) |
| **C** | até 30 | **R$ 690** | R$ 23,00 | só uma hipótese de desconto progressivo |
| **Sob consulta** | mais de 30 | contrato | — | plano custom |

O preço marginal de subir (o que se paga por cada marca nova ao trocar de plano): A→B R$ 25 por
marca, B→C R$ 19,33 por marca. Cada degrau barateia a marca, que é o que faz valer a pena subir.

### Marca extra avulsa

Quem não quer pular de plano compra marcas soltas. Hipótese: **R$ 35 por marca extra**, acima do
preço médio por marca de qualquer plano (para o plano maior continuar atraente), com uma regra
simples: **a cobrança nunca passa do preço do plano seguinte**.

| Plano A + extras | Marcas | Mensal |
|---|---|---|
| A | 5 | R$ 150 |
| +1 extra | 6 | R$ 185 |
| +2 | 7 | R$ 220 |
| +3 | 8 | R$ 255 |
| +5 | 10 | R$ 325 |
| +7 | 12 | R$ 395 |
| passou disso | 13 ou mais | R$ 400 (já é o plano B) |

Assim ninguém paga mais por ter ficado no plano pequeno, e não há "armadilha" na tela de preços.

## 2. Custos reais, medidos e pesquisados

### Armazenamento (medido em produção, 06/11/2026, só leitura)

| Item | Valor |
|---|---|
| Marcas hoje | 5 (testes e demonstração) |
| Arquivos no Storage | 361 arquivos, ~121 MiB no total |
| Maior arquivo | 6,9 MiB |
| Banco de dados | 31 MB |

Média de ~24 MiB por marca. É de marcas de teste e subestima um cliente real: um manual de 100 MiB
(o teto do produto) mais imagens de leitura e materiais pode passar de 300 MiB por marca. Mesmo com
0,5 GB por marca, **30 marcas dão ~15 GB**.

### Preços da infraestrutura (fontes de terceiros; conferir nas páginas oficiais)

- **Supabase Pro:** US$ 25 por mês, com 100 GB de arquivos, 250 GB de saída de dados e 8 GB de
  banco incluídos. Excedente: arquivos cerca de US$ 0,021 por GB, saída US$ 0,09 por GB. Há ainda o
  custo de computação da instância, que as fontes tratam de formas diferentes.
- **Vercel Pro:** cerca de US$ 20 por pessoa por mês.
- **Stripe Brasil, cartão nacional:** 3,99% + R$ 0,39 por cobrança (calculadoras de terceiros;
  conferir na conta). Boleto: R$ 3,45 por boleto pago.

Fontes consultadas: [guia de preços do Supabase](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/),
[Supabase, Pro e saída de dados](https://www.cloudzero.com/blog/supabase-pricing/),
[taxa do Stripe no Brasil](https://sellfy.com/pt/ferramentas/calculadora-de-taxas-do-stripe/).

### Leitura

O custo **por marca** de hospedar é pequeno. 30 marcas caberiam dentro da cota incluída de 100 GB,
então o custo marginal por marca é, na prática, quase zero. Para ser prudente, o cálculo abaixo usa
**R$ 3 por marca por mês** de custo variável.

O custo que pesa é o **fixo**: a assinatura da infraestrutura. Adotei **R$ 540 por mês** (US$ 100 ×
R$ 5,40, a faixa alta do que já está nas notas de preço). Falta levantar os outros fixos:
contabilidade, e-mail transacional, domínio e conta de desenvolvedor da Apple para o Fonts.

## 3. A conta por plano

Hipóteses: Stripe 3,99% + R$ 0,39 por cobrança mensal; imposto em duas pontas, **6%** (início do
Simples Nacional) e **15,5%** (pior caso); custo variável R$ 3 por marca. **O enquadramento
tributário precisa ser confirmado com o contador.** O MEI não comporta isso (teto de R$ 81 mil por
ano, ver `precificacao-planos-2026-10-30.md` §3).

| Plano | Preço | Taxa Stripe | Imposto 6% / 15,5% | Variável | **Sobra** (6% / 15,5%) |
|---|---|---|---|---|---|
| A, 5 marcas | R$ 150 | R$ 6,37 | R$ 9,00 / R$ 23,25 | R$ 15 | **R$ 119,62 / R$ 105,38** |
| B, 15 marcas | R$ 400 | R$ 16,35 | R$ 24 / R$ 62 | R$ 45 | **R$ 314,65 / R$ 276,65** |
| C, 30 marcas | R$ 690 | R$ 27,92 | R$ 41,40 / R$ 106,95 | R$ 90 | **R$ 530,68 / R$ 465,13** |

### Quantos clientes pagam só a infraestrutura fixa (R$ 540)

| Só clientes do plano | Clientes para empatar |
|---|---|
| A | 5 a 6 |
| B | 2 |
| C | 1 a 2 |

## 4. O que isso significa

1. **O plano A fecha a conta de hospedagem, mas não paga o seu tempo.** Com cinco ou seis agências
   no plano A o custo fixo está coberto e sobra quase nada. É um **plano de entrada e de prova**,
   não a fonte de receita do negócio.
2. **O dinheiro vem dos planos B e C e do plano com IA.** Dois clientes no plano B já pagam a
   infraestrutura. Por isso o desconto progressivo é saudável: o maior consome pouco mais por marca
   e dá uma sobra bem maior por contrato.
3. **O risco real não é hospedagem, é suporte.** Plano barato costuma atrair o cliente que mais
   pede atendimento. O custo de tempo não está na conta. Proposta: suporte do plano A por e-mail e
   central de ajuda, sem atendimento dedicado.
4. **Esta escada só vale sem IA.** A IA da plataforma custa de verdade e não cabe em R$ 150. Os
   planos com IA (e a tabela de 30/10) precisam ser refeitos em separado, com custo de IA medido.
5. **O número de marcas que a Happy tem importa.** Eles falaram em 30 marcas em 12 meses e 5 no
   primeiro mês. O plano A cobre o piloto; no caso de crescerem, o B sai a R$ 400, e a marca extra
   fica no meio.

## 5. A proposta de contrato com a Happy (para o André decidir)

- **Piloto de 12 meses**, plano A, 5 marcas, R$ 150 por mês. O contrato é de teste e o preço fica
  travado por 12 meses.
- **Contrapartida:** 30 minutos por mês de conversa, autorização para citar a agência como cliente
  com o texto aprovado por eles, e o direito de pedir funções novas. Já disseram sim aos dois
  primeiros itens.
- **Marcas extras** no valor de lista, com a regra de nunca passar do plano seguinte.
- **Desconto anual:** eles pediram 20% por pagar à vista. Seria R$ 1.440 por ano. Com um valor
  tão baixo, eu **não daria** esse desconto além do preço já reduzido.
- **O que a Happy pede e precisa existir:** contrato, nota fiscal, termo de LGPD, local dos dados
  no Brasil (o banco já está em `sa-east-1`) e relatório de auditoria. Este último ainda não
  existe e é a lacuna maior.
- **Cuidado:** o plano sem IA só se entrega de fato quando a conexão de IA da conta (ADR-0009)
  estiver construída. Até lá, o piloto sem IA precisaria do Vini desligado.

## 6. O que falta antes de fechar números

1. Confirmar com o contador o enquadramento (Simples Nacional, anexo, imposto sobre serviço) e se
   emitir nota de assinatura de software muda os 6% e 15,5%.
2. Conferir nas páginas oficiais o preço do Supabase Pro, a computação da instância, o Vercel Pro e
   a taxa do Stripe da conta.
3. Levantar os custos fixos que faltam (contabilidade, e-mail, domínio, Apple).
4. Medir o armazenamento e a saída de dados de uma marca real, com manual grande, em vez de marca
   de teste.
5. Estimar o custo de IA por conta para os planos com IA (opções pagas pesquisadas: Gemini 3.6
   Flash, gpt-5-mini, Claude Sonnet 5), a partir dos tokens do razão.
6. Entrevistar mais agências com a mesma escada, para ver se 5 marcas por R$ 150 é a âncora ou só
   a Happy.

## 7. Decisões para o André

1. A escada 5 / 15 / 30 faz sentido como base da conversa com as outras agências?
2. A marca extra a R$ 35 (hipótese) com a regra "nunca passa do plano seguinte"?
3. O piloto da Happy: 12 meses, plano A, preço travado, sem o desconto anual?
4. O que fazer enquanto a conexão de IA não existe: oferecer o piloto com o Vini desligado, ou
   esperar a fatia?
