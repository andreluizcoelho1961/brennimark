import assert from "node:assert/strict";
import test from "node:test";
import { PACOTES, compraDePacoteDoAviso, pacotePorCodigo, parametrosDoCheckoutDePacote } from "./pacotes";
import { processarAviso, type Aviso, type Portas, type Resultado } from "./webhook";

const CONTA = "0b1f7b3e-1d6c-4f0a-9b52-7a3d2c9e4f10";
const sessao = (extra: Record<string, unknown> = {}, meta: Record<string, unknown> = {}) => ({
  id: "cs_live_1", mode: "payment", payment_status: "paid", currency: "brl", amount_total: 2900,
  metadata: { tipo: "pacote", workspace_id: CONTA, pacote: "100-perguntas", ...meta }, ...extra,
});
const aviso = (object: unknown, type = "checkout.session.completed"): Aviso => ({ id: "evt_p1", type, data: { object } });

test("o catálogo: dois pacotes, preços em centavos de real", () => {
  assert.deepEqual(PACOTES.map((p) => [p.codigo, p.quantidade, p.valorCentavos]), [["100-perguntas", 100, 2900], ["500-perguntas", 500, 11900]]);
  assert.equal(pacotePorCodigo("500-perguntas")?.quantidade, 500);
  assert.equal(pacotePorCodigo("1000000-perguntas"), null);
});

test("a compra lida do aviso usa a quantidade do CATÁLOGO, não a dos metadados", () => {
  const c = compraDePacoteDoAviso(aviso(sessao({}, { quantidade: "99999" })));
  assert.equal(c?.pacote.quantidade, 100);
  assert.equal(c?.workspaceId, CONTA);
  assert.equal(c?.sessao, "cs_live_1");
});

test("só pagamento confirmado de pacote conta; assinatura, não pago e outros tipos passam batido", () => {
  assert.equal(compraDePacoteDoAviso(aviso(sessao({ payment_status: "unpaid" }))), null);
  assert.equal(compraDePacoteDoAviso(aviso(sessao({ mode: "subscription" }))), null);
  assert.equal(compraDePacoteDoAviso(aviso(sessao({}, { tipo: "outra" }))), null);
  assert.equal(compraDePacoteDoAviso(aviso(sessao(), "invoice.paid")), null);
  assert.equal(compraDePacoteDoAviso(aviso(sessao(), "checkout.session.async_payment_succeeded"))?.pacote.codigo, "100-perguntas");
});

test("sessão paga com metadados inválidos ou moeda errada SOBE como erro (dinheiro não some calado)", () => {
  assert.throws(() => compraDePacoteDoAviso(aviso(sessao({}, { pacote: "inventado" }))), /metadados inválidos/);
  assert.throws(() => compraDePacoteDoAviso(aviso(sessao({}, { workspace_id: "não-é-uuid" }))), /metadados inválidos/);
  assert.throws(() => compraDePacoteDoAviso(aviso(sessao({ currency: "usd" }))), /moeda/);
});

test("o checkout é pagamento único, em reais, preso à conta e ao cliente", () => {
  const p = parametrosDoCheckoutDePacote({
    pacote: PACOTES[1], workspaceId: CONTA, idDoCliente: "cus_1", origem: "https://brennimark.com", slugDaConta: "minha-agencia", ingles: false,
  });
  assert.equal(p.mode, "payment");
  assert.equal(p.customer, "cus_1");
  assert.equal(p.line_items[0].price_data.unit_amount, 11900);
  assert.equal(p.line_items[0].price_data.currency, "brl");
  assert.deepEqual(p.metadata, { tipo: "pacote", workspace_id: CONTA, pacote: "500-perguntas" });
  assert.deepEqual(p.payment_intent_data.metadata, p.metadata);
  assert.ok(p.success_url.startsWith("https://brennimark.com/w/minha-agencia/configuracoes?parte=ia"));
});

function portas(creditar: () => Promise<boolean>): { portas: Portas; chamadas: string[] } {
  const chamadas: string[] = [];
  const proibido = async () => { throw new Error("assinatura não deveria ser tocada"); };
  return {
    chamadas,
    portas: {
      async receber() { return "novo"; },
      async concluir(_p: string, _id: string, r: Resultado | "falhou", d: string | null) { chamadas.push(`concluir ${r}${d ? ` (${d})` : ""}`); },
      async creditarPacote(c: { pacote: { codigo: string } }) { chamadas.push(`creditar ${c.pacote.codigo}`); return creditar(); },
      buscarAssinatura: proibido, garantirLogin: proibido, sincronizar: proibido, pedidoDeCancelamento: proibido,
      estornar: proibido, registrarEstorno: proibido, reservarAviso: proibido, avisarCancelamento: proibido,
    } as unknown as Portas,
  };
}

test("valor pago diferente do catálogo falha o aviso (B2); sem valor também", () => {
  assert.throws(() => compraDePacoteDoAviso(aviso(sessao({ amount_total: 100 }))), /valor pago diverge/);
  assert.throws(() => compraDePacoteDoAviso(aviso(sessao({ amount_total: undefined }))), /valor pago diverge/);
  assert.equal(compraDePacoteDoAviso(aviso(sessao({ amount_total: 2900 })))?.valorCentavos, 2900);
});

test("falha ao creditar avisa a equipe só na primeira vez, e leva sessão, conta e pacote no detalhe", async () => {
  const alertas: string[] = [];
  const base = portas(async () => { throw new Error("pacote: 22023 pacote_sem_franquia"); });
  const comAlerta = { ...base.portas, async alertarPacoteNaoCreditado(a: { detalhe: string }) { alertas.push(a.detalhe); } } as Portas;
  await assert.rejects(processarAviso("stripe", aviso(sessao()), comAlerta), /pacote_sem_franquia/);
  assert.equal(alertas.length, 1);
  assert.match(alertas[0], /sessao=cs_live_1 conta=0b1f7b3e.* pacote=100-perguntas/);
  assert.match(base.chamadas.at(-1) ?? "", /sessao=cs_live_1/);
  const repetido = { ...comAlerta, async receber() { return "repetir" as const; } } as Portas;
  await assert.rejects(processarAviso("stripe", aviso(sessao()), repetido), /pacote_sem_franquia/);
  assert.equal(alertas.length, 1);
});

test("o alerta que falha não esconde a falha original", async () => {
  const base = portas(async () => { throw new Error("pacote: 22023 pacote_sem_franquia"); });
  const quebrado = { ...base.portas, async alertarPacoteNaoCreditado() { throw new Error("resend fora"); } } as Portas;
  await assert.rejects(processarAviso("stripe", aviso(sessao()), quebrado), /pacote_sem_franquia/);
});

test("o webhook credita o pacote sem tocar em assinatura", async () => {
  const { portas: p, chamadas } = portas(async () => true);
  const d = await processarAviso("stripe", aviso(sessao()), p);
  assert.equal(d.resultado, "processado");
  assert.deepEqual(chamadas, ["creditar 100-perguntas", "concluir processado (pacote 100-perguntas creditado)"]);
});

test("aviso repetido: a sessão já creditada vira 'já creditado', sem erro", async () => {
  const { portas: p, chamadas } = portas(async () => false);
  const d = await processarAviso("stripe", aviso(sessao()), p);
  assert.equal(d.resultado, "processado");
  assert.ok(chamadas.at(-1)?.includes("já creditado"));
});

test("falha ao creditar marca o aviso como falhou e sobe (o Stripe tenta de novo)", async () => {
  const { portas: p, chamadas } = portas(async () => { throw new Error("pacote: 22023 pacote_sem_franquia"); });
  await assert.rejects(processarAviso("stripe", aviso(sessao()), p), /pacote_sem_franquia/);
  assert.ok(chamadas.at(-1)?.startsWith("concluir falhou"));
});
