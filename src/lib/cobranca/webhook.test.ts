import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import { lerAvisoAssinado } from "./aviso-assinado";
import { assinaturaDoStripe, traduzirSituacaoDoStripe, type AssinaturaDoStripe } from "./stripe-traducao";
import {
  assinaturaDoAviso, processarAviso, tipoDoCancelamento,
  type AssinaturaNoProvedor, type AvisoDeCancelamento, type Aviso, type EstadoDoCancelamento, type Portas, type Recebimento,
} from "./webhook";

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
function portasFalsas(opcoes: {
  recebimento?: Recebimento; assinatura?: AssinaturaNoProvedor; falharEm?: string;
  /** O que o banco devolve ao pedido de cancelamento (sem isto: o banco decide como o de verdade, sem arrependimento). */
  estado?: Partial<EstadoDoCancelamento>;
  /** Outro aviso já reservou o e-mail. */
  reservaPerdida?: boolean;
} = {}) {
  const chamadas: string[] = [];
  const logins: { nome: string | null; idAssinatura: string }[] = [];
  const emails: AvisoDeCancelamento[] = [];
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
      return a.situacao === "ativa" || a.situacao === "cancelada" ? "conta-1" : null;
    },
    async pedidoDeCancelamento(p) {
      chamadas.push(`pedido ${p.idAssinatura} ${p.pedido ? "sim" : "não"}${p.porFaltaDePagamento ? " (falta de pagamento)" : ""}`);
      if (!p.pedido) return null;
      return {
        nomeDaConta: "Agência Exemplo", titularEmail: "dona@agencia.com", situacao: "ativa",
        periodoPagoAte: "2026-11-08T13:37:12.000Z", arrependimento: false, estornada: false, avisado: false,
        ...opcoes.estado,
      };
    },
    async estornar(id) {
      chamadas.push(`estornar ${id}`);
      if (opcoes.falharEm === "estornar") throw new Error("Stripe recusou o estorno");
      return "re_1";
    },
    async registrarEstorno(id, idEstorno) { chamadas.push(`registrar estorno ${id} ${idEstorno}`); },
    async reservarAviso(id, reservar) {
      chamadas.push(`${reservar ? "reservar" : "devolver"} aviso ${id}`);
      return reservar ? !opcoes.reservaPerdida : true;
    },
    async avisarCancelamento(a) {
      chamadas.push(`e-mail ${a.tipo}`);
      if (opcoes.falharEm === "e-mail") throw new Error("e-mail de cancelamento: recusado");
      emails.push(a);
    },
  };
  return { portas, chamadas, logins, emails };
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
    periodoPagoAte: new Date(1_790_000_000 * 1000).toISOString(), cancelarNoFim: false,
    pedidoDeCancelamentoEm: null, porFaltaDePagamento: false, moeda: "BRL",
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
  assert.deepEqual(chamadas, [
    "receber evt_1", "buscar sub_1", "login dona@agencia.com", "sincronizar sub_1 ativa",
    // Sem cancelamento: o banco é informado de que não há pedido, e nada mais.
    "pedido sub_1 não", "concluir evt_1 processado",
  ]);
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

const PEDIU = { ...PAGA, cancelarNoFim: true, pedidoDeCancelamentoEm: "2026-10-09T10:00:00.000Z" };
const pediuCancelar = aviso("customer.subscription.updated", { id: "sub_1" });

test("o pedido de cancelamento e o motivo vêm do Stripe", () => {
  const pedido = assinaturaDoStripe({ ...SUB, cancel_at_period_end: true, canceled_at: 1_790_000_000 });
  assert.equal(pedido.cancelarNoFim, true);
  assert.equal(pedido.pedidoDeCancelamentoEm, new Date(1_790_000_000 * 1000).toISOString());
  assert.equal(pedido.porFaltaDePagamento, false);
  for (const motivo of ["payment_failed", "payment_disputed"]) {
    const cortada = assinaturaDoStripe({ ...SUB, status: "canceled", cancellation_details: { reason: motivo } });
    assert.equal(cortada.porFaltaDePagamento, true, motivo);
  }
  assert.equal(assinaturaDoStripe({ ...SUB, cancellation_details: { reason: "cancellation_requested" } }).porFaltaDePagamento, false);
  // O Portal no modo flexível marca uma DATA em vez do "fim do período": também é pedido.
  assert.equal(assinaturaDoStripe({ ...SUB, cancel_at: 1_790_000_000 }).cancelarNoFim, true);
  assert.equal(assinaturaDoStripe({ ...SUB, cancel_at: null }).cancelarNoFim, false);
});

test("cancelou no Portal, depois dos 7 dias: um e-mail com a data do fim do acesso, sem estorno", async () => {
  const { portas, chamadas, emails } = portasFalsas({ assinatura: PEDIU });
  await processarAviso("stripe", pediuCancelar, portas);
  assert.deepEqual(chamadas, [
    "receber evt_1", "buscar sub_1", "login dona@agencia.com", "sincronizar sub_1 ativa",
    "pedido sub_1 sim", "reservar aviso sub_1", "e-mail no-fim-do-periodo", "concluir evt_1 processado",
  ]);
  assert.deepEqual(emails, [{ email: "dona@agencia.com", conta: "Agência Exemplo", tipo: "no-fim-do-periodo", ate: "2026-11-08T13:37:12.000Z" }]);
});

test("arrependimento: estorna, registra o estorno e SÓ DEPOIS avisa", async () => {
  const { portas, chamadas, emails } = portasFalsas({ assinatura: PEDIU, estado: { arrependimento: true } });
  await processarAviso("stripe", pediuCancelar, portas);
  assert.deepEqual(chamadas.slice(4), [
    "pedido sub_1 sim", "estornar sub_1", "registrar estorno sub_1 re_1",
    "reservar aviso sub_1", "e-mail arrependimento", "concluir evt_1 processado",
  ]);
  assert.equal(emails[0].ate, null);
});

test("aviso repetido depois de tudo feito: nem estorno, nem e-mail", async () => {
  const { portas, chamadas } = portasFalsas({ assinatura: { ...PEDIU, situacao: "cancelada" }, estado: { arrependimento: true, estornada: true, avisado: true, situacao: "cancelada" } });
  await processarAviso("stripe", aviso("customer.subscription.deleted", { id: "sub_1" }), portas);
  assert.deepEqual(chamadas, ["receber evt_1", "buscar sub_1", "sincronizar sub_1 cancelada", "pedido sub_1 sim", "concluir evt_1 processado"]);
});

test("já estornado mas sem e-mail (falhou antes): só o e-mail sai", async () => {
  const { portas, chamadas } = portasFalsas({ assinatura: { ...PEDIU, situacao: "cancelada" }, estado: { arrependimento: true, estornada: true, situacao: "cancelada" } });
  await processarAviso("stripe", aviso("customer.subscription.deleted", { id: "sub_1" }), portas);
  assert.ok(!chamadas.some((c) => c.startsWith("estornar")));
  assert.ok(chamadas.includes("e-mail arrependimento"));
});

test("dois avisos ao mesmo tempo: quem perde a reserva não manda o e-mail", async () => {
  const { portas, chamadas, emails } = portasFalsas({ assinatura: PEDIU, reservaPerdida: true });
  await processarAviso("stripe", pediuCancelar, portas);
  assert.ok(chamadas.includes("reservar aviso sub_1"));
  assert.deepEqual(emails, []);
});

test("o e-mail falhou: a reserva volta e o aviso falha, para o Stripe repetir", async () => {
  const { portas, chamadas } = portasFalsas({ assinatura: PEDIU, falharEm: "e-mail" });
  await assert.rejects(processarAviso("stripe", pediuCancelar, portas), /recusado/);
  assert.deepEqual(chamadas.slice(-3), ["e-mail no-fim-do-periodo", "devolver aviso sub_1", "concluir evt_1 falhou (e-mail de cancelamento: recusado)"]);
});

test("o estorno falhou: nada é registrado, nenhum e-mail, e o Stripe repete", async () => {
  const { portas, chamadas } = portasFalsas({ assinatura: PEDIU, estado: { arrependimento: true }, falharEm: "estornar" });
  await assert.rejects(processarAviso("stripe", pediuCancelar, portas), /recusou/);
  assert.ok(!chamadas.some((c) => c.startsWith("registrar") || c.startsWith("reservar") || c.startsWith("e-mail")));
});

test("cortada por falta de pagamento: o banco sabe o motivo, e o e-mail diz outra coisa", async () => {
  const cortada = { ...PAGA, situacao: "cancelada" as const, porFaltaDePagamento: true };
  const { portas, chamadas, emails } = portasFalsas({ assinatura: cortada, estado: { situacao: "cancelada" } });
  await processarAviso("stripe", aviso("customer.subscription.deleted", { id: "sub_1" }), portas);
  assert.ok(chamadas.includes("pedido sub_1 sim (falta de pagamento)"));
  assert.equal(emails[0].tipo, "falta-de-pagamento");
});

test("o tipo do e-mail", () => {
  const base = { arrependimento: false, situacao: "ativa" as const, periodoPagoAte: "2026-11-08T00:00:00Z" };
  assert.equal(tipoDoCancelamento({ ...base, arrependimento: true }, true), "arrependimento");
  assert.equal(tipoDoCancelamento(base, true), "falta-de-pagamento");
  assert.equal(tipoDoCancelamento(base, false), "no-fim-do-periodo");
  assert.equal(tipoDoCancelamento({ ...base, situacao: "cancelada" }, false), "imediato");
  assert.equal(tipoDoCancelamento({ ...base, periodoPagoAte: null }, false), "imediato");
});
