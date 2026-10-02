import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { lerAvisoAssinado } from "./aviso-assinado";
import { assinaturaDoStripe, traduzirSituacaoDoStripe, type AssinaturaDoStripe } from "./stripe-traducao";
import { assinaturaDoAviso, processarAviso, type AssinaturaNoProvedor, type Aviso, type Portas, type Recebimento } from "./webhook";

const SEGREDO = "whsec_prova_local_nao_e_chave_real";

function assinar(corpo: string, segredo = SEGREDO, timestamp?: number) {
  return Stripe.webhooks.generateTestHeaderString({ payload: corpo, secret: segredo, timestamp });
}

const SUB: AssinaturaDoStripe = {
  id: "sub_1", status: "active", currency: "brl", cancel_at_period_end: false,
  metadata: { nome_da_conta: " Agência Exemplo ", comprador: " Fulana de Tal " },
  customer: { id: "cus_1", email: " Dona@Agencia.COM ", name: "Fulana" },
  items: { data: [{ price: { id: "price_basico_brl" }, current_period_end: 1_790_000_000 }] },
};

const PAGA: AssinaturaNoProvedor = assinaturaDoStripe(SUB);

/** Portas falsas que anotam cada chamada, na ordem. */
function portasFalsas(opcoes: { recebimento?: Recebimento; assinatura?: AssinaturaNoProvedor; falharEm?: string } = {}) {
  const chamadas: string[] = [];
  const logins: { nome: string | null; idAssinatura: string }[] = [];
  const portas: Portas = {
    async receber(_p, id) { chamadas.push(`receber ${id}`); return opcoes.recebimento ?? "novo"; },
    async concluir(_p, id, resultado, detalhe) { chamadas.push(`concluir ${id} ${resultado}${detalhe ? ` (${detalhe})` : ""}`); },
    async buscarAssinatura(id) {
      chamadas.push(`buscar ${id}`);
      if (opcoes.falharEm === "buscar") throw new Error("Stripe fora do ar");
      return opcoes.assinatura ?? PAGA;
    },
    async garantirLogin(email, nome, idAssinatura) { chamadas.push(`login ${email}`); logins.push({ nome, idAssinatura }); },
    async sincronizar(a) {
      chamadas.push(`sincronizar ${a.idAssinatura} ${a.situacao}`);
      if (opcoes.falharEm === "sincronizar") throw new Error("sincronizar: 22023 cobranca_preco_desconhecido");
      return a.situacao === "ativa" ? "conta-1" : null;
    },
  };
  return { portas, chamadas, logins };
}

const aviso = (type: string, object: unknown, id = "evt_1"): Aviso => ({ id, type, data: { object } });

test("a assinatura do aviso: só o segredo certo, o corpo exato e dentro do prazo", async () => {
  const corpo = JSON.stringify({ id: "evt_1", type: "invoice.paid", data: { object: {} } });
  assert.equal((await lerAvisoAssinado(corpo, assinar(corpo), SEGREDO))?.id, "evt_1");
  assert.equal(await lerAvisoAssinado(corpo, assinar(corpo, "whsec_outro_segredo"), SEGREDO), null);
  // Um byte a mais no corpo e a assinatura não confere: ninguém troca o conteúdo no caminho.
  assert.equal(await lerAvisoAssinado(corpo + " ", assinar(corpo), SEGREDO), null);
  assert.equal(await lerAvisoAssinado(corpo, "t=1,v1=falsa", SEGREDO), null);
  // Aviso capturado e reenviado depois de 5 minutos não vale.
  const antigo = Math.floor(Date.now() / 1000) - 10 * 60;
  assert.equal(await lerAvisoAssinado(corpo, assinar(corpo, SEGREDO, antigo), SEGREDO), null);
});

test("o estado do Stripe em palavras do produto; o desconhecido não vira nada", () => {
  assert.equal(traduzirSituacaoDoStripe("active"), "ativa");
  assert.equal(traduzirSituacaoDoStripe("trialing"), "ativa");
  assert.equal(traduzirSituacaoDoStripe("past_due"), "em_atraso");
  assert.equal(traduzirSituacaoDoStripe("unpaid"), "em_atraso");
  assert.equal(traduzirSituacaoDoStripe("paused"), "em_atraso");
  assert.equal(traduzirSituacaoDoStripe("canceled"), "cancelada");
  assert.equal(traduzirSituacaoDoStripe("incomplete_expired"), "cancelada");
  assert.equal(traduzirSituacaoDoStripe("incomplete"), "incompleta");
  assert.equal(traduzirSituacaoDoStripe("algo_novo"), null);
});

test("a assinatura do Stripe vira a do produto: e-mail normalizado, nome do checkout, fim do período em data", () => {
  assert.deepEqual(PAGA, {
    idCliente: "cus_1", idAssinatura: "sub_1", idPreco: "price_basico_brl", situacao: "ativa",
    periodoPagoAte: new Date(1_790_000_000 * 1000).toISOString(), cancelarNoFim: false, moeda: "BRL",
    emailDoTitular: "dona@agencia.com", nomeDaConta: "Agência Exemplo", nomeDoComprador: "Fulana de Tal",
  });
  assert.equal(assinaturaDoStripe({ ...SUB, metadata: {} }).nomeDoComprador, null);
  assert.equal(assinaturaDoStripe({ ...SUB, metadata: {} }).nomeDaConta, "Fulana");
  assert.equal(assinaturaDoStripe({ ...SUB, customer: "cus_1" }).emailDoTitular, null);
  assert.throws(() => assinaturaDoStripe({ ...SUB, items: { data: [...SUB.items.data, ...SUB.items.data] } }), /2 itens/);
  assert.throws(() => assinaturaDoStripe({ ...SUB, customer: { id: "cus_1", deleted: true } }), /apagado/);
});

test("de que assinatura o aviso fala, em cada tipo", () => {
  assert.equal(assinaturaDoAviso(aviso("checkout.session.completed", { mode: "subscription", subscription: "sub_1" })), "sub_1");
  assert.equal(assinaturaDoAviso(aviso("checkout.session.completed", { mode: "payment", subscription: null })), null);
  assert.equal(assinaturaDoAviso(aviso("customer.subscription.updated", { id: "sub_2" })), "sub_2");
  assert.equal(assinaturaDoAviso(aviso("invoice.paid", { parent: { subscription_details: { subscription: "sub_3" } } })), "sub_3");
  assert.equal(assinaturaDoAviso(aviso("invoice.paid", { parent: { subscription_details: { subscription: { id: "sub_4" } } } })), "sub_4");
  assert.equal(assinaturaDoAviso(aviso("invoice.paid", { parent: null })), null);
});

test("pagamento confirmado: garante o login, sincroniza e conclui — nessa ordem", async () => {
  const { portas, chamadas, logins } = portasFalsas();
  const d = await processarAviso("stripe", aviso("invoice.paid", { parent: { subscription_details: { subscription: "sub_1" } } }), portas);
  assert.deepEqual(d, { resultado: "processado", detalhe: null, conta: "conta-1" });
  assert.deepEqual(chamadas, ["receber evt_1", "buscar sub_1", "login dona@agencia.com", "sincronizar sub_1 ativa", "concluir evt_1 processado"]);
  // O login leva o nome de QUEM COMPROU (não o da empresa) e a assinatura que o criou.
  assert.deepEqual(logins, [{ nome: "Fulana de Tal", idAssinatura: "sub_1" }]);
});

test("o estado vem do Stripe AGORA, não do retrato do aviso", async () => {
  // O aviso diz "updated", mas quem decide é a assinatura relida: em atraso.
  const { portas, chamadas } = portasFalsas({ assinatura: { ...PAGA, situacao: "em_atraso" } });
  await processarAviso("stripe", aviso("customer.subscription.updated", { id: "sub_1", status: "active" }), portas);
  // Sem pagamento em dia, nenhum login novo.
  assert.deepEqual(chamadas, ["receber evt_1", "buscar sub_1", "sincronizar sub_1 em_atraso", "concluir evt_1 processado (nada a fazer: assinatura sem pagamento)"]);
});

test("aviso já concluído não faz nada — o Stripe repete avisos", async () => {
  const { portas, chamadas } = portasFalsas({ recebimento: "concluido" });
  const d = await processarAviso("stripe", aviso("invoice.paid", { parent: { subscription_details: { subscription: "sub_1" } } }), portas);
  assert.equal(d.resultado, "repetido");
  assert.deepEqual(chamadas, ["receber evt_1"]);
});

test("tipo que não interessa, aviso sem assinatura e estado desconhecido ficam registrados como ignorados", async () => {
  let r = portasFalsas();
  await processarAviso("stripe", aviso("customer.created", {}), r.portas);
  assert.deepEqual(r.chamadas, ["receber evt_1", "concluir evt_1 ignorado (tipo não tratado)"]);

  r = portasFalsas();
  await processarAviso("stripe", aviso("checkout.session.completed", { mode: "payment" }), r.portas);
  assert.deepEqual(r.chamadas, ["receber evt_1", "concluir evt_1 ignorado (aviso sem assinatura)"]);

  r = portasFalsas({ assinatura: { ...PAGA, situacao: null } });
  await processarAviso("stripe", aviso("customer.subscription.updated", { id: "sub_1" }), r.portas);
  assert.deepEqual(r.chamadas, ["receber evt_1", "buscar sub_1", "concluir evt_1 ignorado (estado desconhecido do provedor)"]);
});

test("falha no meio marca o aviso como falhou e SOBE — para o Stripe tentar de novo", async () => {
  let r = portasFalsas({ falharEm: "buscar" });
  await assert.rejects(processarAviso("stripe", aviso("customer.subscription.updated", { id: "sub_1" }), r.portas), /fora do ar/);
  assert.deepEqual(r.chamadas, ["receber evt_1", "buscar sub_1", "concluir evt_1 falhou (Stripe fora do ar)"]);

  r = portasFalsas({ falharEm: "sincronizar" });
  await assert.rejects(processarAviso("stripe", aviso("customer.subscription.updated", { id: "sub_1" }), r.portas), /preco_desconhecido/);
  assert.equal(r.chamadas.at(-1), "concluir evt_1 falhou (sincronizar: 22023 cobranca_preco_desconhecido)");

  // Pagou mas o Stripe não tem e-mail: não dá para abrir conta, e isso precisa aparecer.
  r = portasFalsas({ assinatura: { ...PAGA, emailDoTitular: null } });
  await assert.rejects(processarAviso("stripe", aviso("customer.subscription.updated", { id: "sub_1" }), r.portas), /sem e-mail/);
  assert.ok(!r.chamadas.some((c) => c.startsWith("login") || c.startsWith("sincronizar")));
});
