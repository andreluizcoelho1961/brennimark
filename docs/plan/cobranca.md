# Cobrança — assinatura paga com Stripe

Decisões do André em 01/10/2026. Este documento é o mapa da cobrança. Os detalhes de cada regra
estão nos comentários da migration `cobranca` e de `src/lib/cobranca/`.

## Decisões

| | Decisão | Por quê |
|---|---|---|
| Provedor | **Stripe** | vender no mundo inteiro desde o início; trocar de provedor com assinantes ativos é caro. O Paddle foi descartado porque a agência brasileira precisa de nota fiscal do CNPJ brasileiro, e o Asaas porque é limitado fora do Brasil |
| Entrada | **pagou, entrou**, sem período de teste | coerente com "a conta só nasce de assinatura paga" (especificação do site) |
| Pagamento | cartão e Pix (o Pix Automático do Stripe faz a cobrança recorrente) | |
| Empresa | o MEI do André no piloto; ME no Simples depois | o sistema não depende do tipo de empresa: a chave do Stripe fica na Vercel |
| Atraso | **7 dias** com tudo funcionando e aviso ao dono; depois **só leitura** (consulta e download sim; Vini, edição e marca nova não); **nada é apagado** | |
| Cancelado de vez | **em aberto.** A ideia do André: a pessoa pode baixar os dados; guardar uns 6 meses caso volte; depois liberar o espaço | |
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
   está aberta". **O botão do site continua "Conversar sobre a implantação"**: trocar para "Assinar"
   é decisão do André, quando a venda abrir.
   **Antes de abrir a venda, decisão do André:** como o comprador recebe o acesso. O login nasce sem
   senha; o produto não manda e-mail, e o e-mail padrão do Supabase só envia para a equipe do
   projeto. A página de volta já promete "instruções de acesso no e-mail".
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
5. No painel do Stripe, ligar os meios de pagamento: cartão e **Pix**. O Pix entra como Pix
   Automático (o comprador autoriza no banco uma cobrança mensal de até o valor do plano).
6. No Supabase (Authentication → URL Configuration), conferir que **Redirect URLs** inclui
   `https://brennimark.vercel.app/auth/callback` (e o domínio definitivo, quando houver). Sem isso,
   o link de primeiro acesso cai no endereço padrão e não abre a tela de criar senha.
7. Testar com o cartão de teste `4242 4242 4242 4242` e o Pix de teste; a conta aparece no Console
   → Cobrança → Assinaturas.

## Pontas conhecidas (revisão de 01/10/2026)

Corrigido na revisão (migration `cobranca_primeiro_acesso`, #77):

- o login criado pela compra colhia concessões de qualquer conta; agora fica preso à conta que
  pagou, como os logins criados por uma conta desde 18/09;
- quem já tinha login criado por outra agência pagava e não virava dono da conta; agora vira;
- `planos` entregava ao público o teto de custo do Vini em dólares; agora o público lê só o que o
  site mostra.

A conferir no primeiro teste real, em modo de teste do Stripe:

- **Pix no checkout:** a página manda o mandato do Pix Automático quando a moeda é real. **Achado no
  primeiro teste (02/10):** em modo assinatura o Stripe recusa `amount_type` no mandato; só
  `amount` e `payment_schedule`. Corrigido. Ligar o Pix no painel antes de testar em reais.
- **Teto do mandato Pix = valor do plano.** Se o preço subir (reajuste, troca de plano para cima,
  imposto somado pelo Stripe Tax), a cobrança por Pix acima do teto falha e a pessoa precisa
  autorizar de novo no banco.
- **Troca de plano pelo Portal:** o Portal só pode oferecer preços que estejam ligados no Console.
  Um preço que não está lá faz o aviso falhar (e o Stripe repetir) até ele ser ligado.

Dependem de decisão do André:

- **Quem volta depois de cancelar** compra de novo e ganha conta nova; a antiga fica cancelada e só
  para leitura, com tudo dentro. Juntar as duas faz parte da decisão sobre os dados de quem
  cancelou.
- Serviço de e-mail, botão "Assinar" do site e emissor de nota fiscal.
