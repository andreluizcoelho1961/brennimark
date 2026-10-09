# Cobrança — assinatura paga com Stripe

Decisões do André em 01/10/2026. Este documento é o mapa da cobrança. Os detalhes de cada regra
estão nos comentários da migration `cobranca` e de `src/lib/cobranca/`.

## Decisões

| | Decisão | Por quê |
|---|---|---|
| Provedor | **Stripe** | vender no mundo inteiro desde o início; trocar de provedor com assinantes ativos é caro. O Paddle foi descartado porque a agência brasileira precisa de nota fiscal do CNPJ brasileiro, e o Asaas porque é limitado fora do Brasil |
| Entrada | **pagou, entrou**, sem período de teste | coerente com "a conta só nasce de assinatura paga" (especificação do site) |
| Pagamento | **só cartão** (decisão de 02/10/2026; rever mais adiante) | agências assinam com cartão, e o Pix serve mais à compra à vista. E o Stripe não faz Pix em assinatura para conta brasileira: "O Pix Automático não está disponível no Brasil", e o checkout descarta o Pix sem erro. Caminhos guardados: Pix pela fatura do mês, plano anual por Pix (teto de R$ 3.000 por Pix) ou um segundo provedor |
| Empresa | o MEI do André no piloto; ME no Simples depois | o sistema não depende do tipo de empresa: a chave do Stripe fica na Vercel |
| Atraso | **7 dias** com tudo funcionando e aviso ao dono; depois **só leitura** (consulta e download sim; Vini, edição e marca nova não); **nada é apagado** | |
| Cancelado de vez | **12 meses só para leitura, depois exclusão** (decisão de 07/10/2026, substitui a de 03/10): aviso 30 dias antes; o assinante pode exportar ou pedir a exclusão antes; dados fiscais e registros de acesso ficam pelo prazo legal | guardar sem prazo não se justifica (LGPD: necessidade) e custa armazenamento. **Construído em 08/10/2026 (B1):** rotina diária `/api/manutencao/contas-canceladas` que avisa aos 11 meses e exclui aos 12, com três travas no banco (12 meses, aviso há 30 dias ou mais, conta cancelada). Sai a área inteira (marcas, arquivos dos 3 buckets, membros e os logins criados por ela que não estão em outra conta); ficam o registro da assinatura, os avisos do Stripe e os registros de acesso. **Construído em 08/10/2026 (B2):** o pedido de exportação — quem administra pede em Configurações › Plano (um pedido aberto por conta), a equipe recebe e-mail no contato@, entrega à mão em até 15 dias e marca no Console › Cobrança, com motivo no registro. **Mudou no mesmo dia (decisão do André):** a via principal é a **exportação pelo navegador** — a dona clica em Exportar tudo, o servidor registra (`exportacoes_da_conta`) e devolve o manifesto por chave, o navegador pede endereços assinados em lotes de 20 e salva um ZIP por marca (manuais, materiais inclusive descontinuados, imagens de análise, complementos, `indice.csv`, links sem endereço; o que não veio vai em `FALTARAM.txt`). Limite de 5 por conta a cada 24 h (saída de dados do Storage é cota). Exportar não encerra a conta. O pedido manual fica como reserva, num link pequeno (`scripts/prova-exportar.sh`) |
| Cancelamento e arrependimento | **e-mail na hora; estorno automático em até 7 dias** (decisões de 08/10/2026): o arrependimento devolve o valor pago por inteiro e **encerra o acesso na hora** (a conta fica só para leitura, guardada como qualquer cancelada); vale só na **primeira assinatura de um e-mail**; cancelamento por falta de pagamento não é arrependimento | a promessa dos Termos (seção 13) era feita à mão. O prazo de 7 dias conta do pedido (`canceled_at` do Stripe), não da chegada do aviso. Quem já assinou e volta não estorna sozinho: caso especial, o André estorna no Stripe |
| Limites dos planos | **provisórios**, ajustáveis no Console | os valores do site ainda estão "a definir" |

## Desenho

- **A conta nasce do aviso assinado do Stripe**, nunca da página de volta do checkout: essa página é
  um endereço que qualquer um abre sem pagar.
- **4 tabelas** (desenho aprovado em 01/10): `planos`, `precos_do_plano` (por provedor e moeda),
  `assinaturas` (uma por conta; só o servidor escreve) e `eventos_de_cobranca` (um aviso, uma linha;
  nunca apagado). O valor cobrado mora no Stripe; aqui fica a correspondência "este preço é o plano X".
- **O provedor fica separado.** Só `stripe.ts`, `stripe-traducao.ts` e `aviso-assinado.ts` sabem de
  Stripe. Um segundo provedor entra escrevendo o par dele e acrescentando o nome ao `check` das
  tabelas.
- **O estado vem do Stripe na hora**: a cada aviso, a assinatura é relida, porque os avisos não
  chegam em ordem.

## Fatias

1. **Base** (#74, no ar): tabelas, webhook e abertura de conta.
2. **Compra** (#75): `/assinar` (planos à venda, moeda, quem assina → página do Stripe), a volta
   `/assinar/obrigado`, e a aba **Cobrança** do Console (assinaturas, planos editáveis, preços do
   Stripe, link de pagamento do piloto). Sem chaves ou sem preço ligado, a compra diz que "ainda não
   está aberta". **O site leva ao `/assinar`** pelo botão "Assinar" de cada plano (decisão de
   03/10/2026); o Corporativo continua "Falar com a equipe".
   **Como o comprador entra (decisão de 02/10/2026): cria a senha na própria volta do pagamento** —
   ver 2b.
2b. **Senha na volta do pagamento** (02/10/2026): pagou pelo site, a volta espera o webhook abrir a
   conta (segundos, no cartão), pede a senha duas vezes e entra. A trava é a **prova do navegador**, e só a compra que CRIOU o login cria a senha dele (corrigido em 02/10: a 1ª versão aceitava qualquer compra com o mesmo e-mail):
   o checkout deixa um segredo num cookie que só o servidor lê (e que só viaja para
   `/api/cobranca/senha`), e o Stripe guarda só o resumo dele nos metadados da sessão. Sem o cookie,
   a rota responde sempre "sem-prova" e não diz nada da compra — um link da volta copiado não serve.
   Além disso: 24 horas de prazo, uma vez só, e **só para login que nasceu da compra e nunca
   entrou**; e-mail que já tinha login é mandado ao login, nunca tem a senha trocada. Regras em
   `src/lib/cobranca/senha-na-volta.ts`. Quem fecha a aba antes, quem compra pelo link de piloto (o
   checkout abre no navegador da equipe) e quem esquece a senha ainda dependem do link do Console
   (3b) até haver serviço de e-mail e "Esqueci a senha".
3. **Vida da assinatura** (#76):
   - **regra de atraso no banco** (`private.acesso_pela_cobranca`): até 7 dias em atraso, tudo
     funciona; depois, ou se cancelada, só leitura. O Vini recusa (`conta_so_leitura`); a edição
     para por um gatilho nas 9 tabelas de conteúdo; marca nova para. Download, revogar link e
     administrar pessoas seguem. Nada é apagado. Conta sem assinatura (as abertas à mão) não muda;
   - **limite de marcas do plano**, imposto pelo banco na criação da marca;
   - **Configurações → Plano** (quem administra): plano, marcas do limite, pago até, o aviso de
     atraso e o botão **Gerenciar assinatura** → Portal do Stripe (cartão, plano, cancelamento,
     faturas);
   - **aviso na moldura** para todos da conta, em tolerância ou só leitura.
   Para o Portal funcionar, configurá-lo no painel do Stripe (Settings → Billing → Customer portal):
   o que o cliente pode fazer lá (trocar plano, cancelar) é escolhido ali.
3b. **Link de primeiro acesso** (#77): enquanto o acesso não chega sozinho por e-mail, a equipe
   gera no Console → Cobrança → Assinaturas um link que abre a sessão do titular e leva à tela de
   criar a senha. Só para titular que nasceu da compra e nunca entrou (o banco decide), com motivo
   no registro da equipe. O link vale ~1 hora (`otp_expiry`). É o mesmo mecanismo que o e-mail vai
   usar: quando houver serviço de e-mail, o link segue por ele.
4. **Nota fiscal automática**: um serviço emissor ligado ao webhook. No piloto, o MEI emite à mão.
5. **Imposto internacional** (Stripe Tax), quando houver venda fora do Brasil.

## Para ligar (o André faz; nenhuma chave passa pelo chat)

1. Abrir a conta no Stripe com o CNPJ.
2. Em **modo de teste**, criar o endpoint do webhook:
   - URL: `https://<domínio>/api/cobranca/stripe`;
   - versão da API: a mais recente que o painel oferecer (em 02/10/2026, `2026-08-26.dahlia`; a
     `2026-09-30.endive` do SDK ainda não aparecia). Serve qualquer uma a partir de 2025-03-31: o
     código só lê do aviso o identificador da assinatura e relê a assinatura no Stripe com a versão
     do SDK — que o Stripe aceita (conferido no registro de requisições);
   - eventos: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.paid` e `invoice.payment_failed`.
3. Colar na Vercel `BRENNIMARK_CHAVE_STRIPE` (`sk_test_…`) e `BRENNIMARK_SEGREDO_WEBHOOK_STRIPE`
   (`whsec_…`).
4. Criar no Stripe um produto por plano, com preço **mensal** em BRL (e em USD, para vender fora),
   e colar cada `price_…` no Console → Cobrança → Preços no Stripe.
5. No painel do Stripe, deixar o **cartão** ligado (Settings → Payment methods). O Pix pode ficar
   ligado ou não: em assinatura o Stripe o descarta para conta brasileira.
6. No Supabase (Authentication → URL Configuration), conferir que **Redirect URLs** inclui
   `https://brennimark.vercel.app/auth/callback` (e o domínio definitivo, quando houver). Sem isso,
   o link de primeiro acesso cai no endereço padrão e não abre a tela de criar senha.
7. Testar com o cartão de teste `4242 4242 4242 4242`; a conta aparece no Console
   → Cobrança → Assinaturas.

## E-mail (03/10/2026): "Esqueci a senha" e a confirmação da assinatura

Pronto no código, desligado até o André escolher o serviço. A porta única é `src/lib/email/enviar.ts`
(Resend; trocar de serviço é reescrever só esse arquivo). Para ligar:

1. Ter um **domínio próprio** e verificá-lo no serviço. O `brennimark.vercel.app` não serve, porque
   o domínio é da Vercel.
2. Colar na Vercel `BRENNIMARK_CHAVE_EMAIL` e `BRENNIMARK_EMAIL_REMETENTE` (por exemplo,
   `Brennimark <acesso@dominio>`) e fazer o redeploy.
3. No Supabase, em Redirect URLs, incluir `https://<domínio>/**`: o link do e-mail volta com
   `?next=/nova-senha?r=…`.

O que passa a acontecer: a compra manda "sua assinatura está ativa" ao e-mail do comprador, e quem
não criou a senha na volta do pagamento usa "Esqueci a senha". O clique no e-mail prova que o e-mail
é da pessoa. Regras em `src/lib/acesso/recuperacao.ts`.

## O que os Termos revisados (versão 2026-10-08) prometem e o produto ainda não faz

A revisão de conformidade dos Termos e da Privacidade (CDC, LGPD, Marco Civil, Decreto 7.962) entrou
com compromissos que precisam virar produto. **Antes do primeiro cliente real:**

- **IA paga:** as rotas usam Gemini e Groq em chave gratuita; o Gemini gratuito treina com os dados. A
  Política diz que só usamos planos que não treinam. Ligar a cobrança no Google AI Studio (e conferir o
  Groq) antes do primeiro piloto real. Demonstração (Brennimark, ACME) pode seguir gratuita.
- ~~Registros de acesso por 6 meses~~ e ~~aceite registrado~~: construídos em 07/10/2026
  (migration `acessos_e_aceites`, `scripts/prova-acessos-e-aceites.sh`). O `proxy` grava uma linha por
  pessoa, por hora e por IP; a rotina diária apaga o que passa de 6 meses; o aceite é gravado na senha
  da compra (versão do Stripe) e no primeiro acesso de quem é convidado.
- **Endereço físico** no rodapé e nos textos (colchetes até o André decidir).

**Antes do primeiro cancelamento completar 12 meses:** exclusão com aviso e exportação.

~~Confirmação de cancelamento por e-mail~~ e ~~reembolso dos 7 dias~~: construídos em 08/10/2026
(migration `cancelamento_e_arrependimento`, `scripts/prova-cancelamento.sh`). O webhook registra o
pedido uma vez, estorna o arrependimento (sem estornar de novo o que o André já estornou à mão) e manda
um e-mail só, com o texto do caso: no fim do período, arrependimento, falta de pagamento ou imediato.

**Operação (manual, por enquanto):** cláusulas-padrão da ANPD nos contratos dos fornecedores. A
`privacidade@brennimark.com` existe desde 07/10.

## Pontas conhecidas (revisão de 01/10/2026)

Corrigido na revisão (migration `cobranca_primeiro_acesso`, #77):

- o login criado pela compra colhia concessões de qualquer conta; agora fica preso à conta que
  pagou, como os logins criados por uma conta desde 18/09;
- quem já tinha login criado por outra agência pagava e não virava dono da conta; agora vira;
- `planos` entregava ao público o teto de custo do Vini em dólares; agora o público lê só o que o
  site mostra.

A conferir no primeiro teste real, em modo de teste do Stripe:

- **Pix no checkout:** saiu em 02/10. O mandato do Pix Automático era descartado pelo Stripe para
  conta brasileira (e antes, com `amount_type`, recusado). Assinatura é só cartão.
- **Troca de plano pelo Portal:** o Portal só pode oferecer preços que estejam ligados no Console.
  Um preço que não está lá faz o aviso falhar (e o Stripe repetir) até ele ser ligado.

Dependem de decisão do André:

- **Quem volta depois de cancelar** compra de novo e ganha conta nova; a antiga fica cancelada e só
  para leitura, com tudo dentro. Juntar as duas faz parte da decisão sobre os dados de quem
  cancelou.
- Serviço de e-mail, botão "Assinar" do site e emissor de nota fiscal.
