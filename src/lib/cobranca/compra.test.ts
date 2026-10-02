import assert from "node:assert/strict";
import test from "node:test";
import { lerPedidoDeCompra, parametrosDoCheckout, type PedidoDeCompra } from "./compra";
import { chamadaDaAcaoDeCobranca, lerAcaoDeCobranca } from "../console/cobranca";

const PEDIDO = { plano: "basico", moeda: "BRL", nome: "  Fulana   de Tal ", email: " Fulana@Agencia.COM ", empresa: "Agência Exemplo" };

test("o pedido de compra: campos limpos, e-mail em minúsculas, moeda e plano do vocabulário", () => {
  const lido = lerPedidoDeCompra(PEDIDO);
  assert.deepEqual(lido, { ok: true, valor: { plano: "basico", moeda: "BRL", nome: "Fulana de Tal", email: "fulana@agencia.com", empresa: "Agência Exemplo" } });
  assert.equal(lerPedidoDeCompra({ ...PEDIDO, plano: "Básico" }).ok, false);
  assert.equal(lerPedidoDeCompra({ ...PEDIDO, moeda: "EUR" }).ok, false);
  assert.equal(lerPedidoDeCompra({ ...PEDIDO, email: "sem-arroba" }).ok, false);
  assert.equal(lerPedidoDeCompra({ ...PEDIDO, empresa: "   " }).ok, false);
  assert.equal(lerPedidoDeCompra(null).ok, false);
});

test("o pedido nunca traz preço: o que vier a mais é ignorado", () => {
  const lido = lerPedidoDeCompra({ ...PEDIDO, preco: "price_do_premium", idDoPreco: "price_x" });
  assert.ok(lido.ok);
  if (lido.ok) assert.equal(Object.keys(lido.valor).sort().join(","), "email,empresa,moeda,nome,plano");
});

test("o checkout em reais: Pix Automático mensal no valor do plano, nome da conta no metadata da assinatura", () => {
  const pedido = (lerPedidoDeCompra(PEDIDO) as { ok: true; valor: PedidoDeCompra }).valor;
  const p = parametrosDoCheckout({ pedido, idDoPreco: "price_basico_brl", valorEmCentavos: 49900, origem: "https://exemplo.test" });
  assert.equal(p.mode, "subscription");
  assert.deepEqual(p.line_items, [{ price: "price_basico_brl", quantity: 1 }]);
  assert.equal(p.customer_email, "fulana@agencia.com");
  assert.equal(p.subscription_data.metadata.nome_da_conta, "Agência Exemplo");
  assert.equal(p.locale, "pt-BR");
  // Sem `amount_type`: em modo assinatura o Stripe recusa o campo (sandbox, 02/10/2026).
  assert.deepEqual(p.payment_method_options, { pix: { mandate_options: { amount: 49900, payment_schedule: "monthly" } } });
  assert.equal(p.success_url, "https://exemplo.test/assinar/obrigado?sessao={CHECKOUT_SESSION_ID}");
  assert.equal(p.cancel_url, "https://exemplo.test/assinar?plano=basico");
  assert.deepEqual(p.tax_id_collection, { enabled: true });
  assert.equal("piloto" in p.metadata, false);
});

test("o checkout em dólar: sem Pix, em inglês; o do piloto vem marcado", () => {
  const pedido = (lerPedidoDeCompra({ ...PEDIDO, moeda: "USD" }) as { ok: true; valor: PedidoDeCompra }).valor;
  const p = parametrosDoCheckout({ pedido, idDoPreco: "price_basico_usd", valorEmCentavos: 0, origem: "https://exemplo.test", piloto: true });
  assert.equal("payment_method_options" in p, false);
  assert.equal(p.locale, "en");
  assert.equal(p.subscription_data.metadata.piloto, "sim");
});

test("Console: ajustar plano converte dólares em micros e GB em bytes; vazio é sem limite", () => {
  const lida = lerAcaoDeCobranca({ tipo: "definir_plano", codigo: "medio", nome: "Médio", maximoDeMarcas: "", tetoMensalDoViniDolares: "62.5", armazenamentoGb: "10", aVenda: true, ordem: "2" });
  assert.ok(lida.ok);
  if (!lida.ok || lida.acao.tipo !== "definir_plano") return;
  const { funcao, parametros } = chamadaDaAcaoDeCobranca(lida.acao, "ajuste");
  assert.equal(funcao, "console_definir_plano");
  assert.equal(parametros.p_maximo_de_marcas, null);
  assert.equal(parametros.p_teto_mensal_do_vini_micros, 62_500_000);
  assert.equal(parametros.p_armazenamento_bytes, 10 * 1024 ** 3);
  assert.equal(parametros.p_a_venda, true);
});

test("Console: as recusas vêm com frase", () => {
  assert.match((lerAcaoDeCobranca({ tipo: "definir_plano", codigo: "Médio" }) as { motivo: string }).motivo, /código/);
  assert.match((lerAcaoDeCobranca({ tipo: "definir_plano", codigo: "medio", nome: "M", maximoDeMarcas: 0, tetoMensalDoViniDolares: 1 }) as { motivo: string }).motivo, /marcas/);
  assert.match((lerAcaoDeCobranca({ tipo: "definir_plano", codigo: "medio", nome: "M", maximoDeMarcas: 1, tetoMensalDoViniDolares: -1 }) as { motivo: string }).motivo, /Teto/);
  assert.match((lerAcaoDeCobranca({ tipo: "registrar_preco", plano: "medio", idExterno: "prod_123", moeda: "BRL" }) as { motivo: string }).motivo, /price_/);
  assert.match((lerAcaoDeCobranca({ tipo: "desativar_preco", id: "x" }) as { motivo: string }).motivo, /inválido/);
  assert.match((lerAcaoDeCobranca({ tipo: "link_de_piloto", plano: "piloto", moeda: "BRL", nome: "A", email: "x" }) as { motivo: string }).motivo, /e-mail/);
  assert.equal(lerAcaoDeCobranca({ tipo: "apagar_tudo" }).ok, false);
});

test("Console: o preço registrado é sempre mensal", () => {
  const lida = lerAcaoDeCobranca({ tipo: "registrar_preco", plano: "medio", idExterno: " price_1AbC ", moeda: "USD" });
  assert.ok(lida.ok);
  if (!lida.ok || lida.acao.tipo !== "registrar_preco") return;
  assert.deepEqual(chamadaDaAcaoDeCobranca(lida.acao, "novo preço").parametros,
    { p_plano: "medio", p_id_externo: "price_1AbC", p_moeda: "USD", p_intervalo: "mes", p_motivo: "novo preço" });
});

test("Console: o link de primeiro acesso só aceita uma conta válida, e não passa pelas funções de plano e preço", () => {
  assert.deepEqual(lerAcaoDeCobranca({ tipo: "link_de_acesso", workspaceId: "33333333-3333-4333-8333-333333333333" }),
    { ok: true, acao: { tipo: "link_de_acesso", workspaceId: "33333333-3333-4333-8333-333333333333" } });
  assert.match((lerAcaoDeCobranca({ tipo: "link_de_acesso", workspaceId: "qualquer" }) as { motivo: string }).motivo, /inválida/);
});
