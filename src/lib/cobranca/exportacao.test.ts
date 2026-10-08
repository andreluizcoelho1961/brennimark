import assert from "node:assert/strict";
import test from "node:test";
import { PRAZO_DA_EXPORTACAO_DIAS, pedidoParaTela, prazoDaExportacao } from "./exportacao";

test("o prazo da exportação: 15 dias corridos do pedido (Termos, seção 13)", () => {
  assert.equal(PRAZO_DA_EXPORTACAO_DIAS, 15);
  assert.equal(prazoDaExportacao("2026-10-08T15:00:00.000Z"), "2026-10-23T15:00:00.000Z");
});

test("o pedido para a tela: nunca pediu é null; o prazo vem junto", () => {
  assert.equal(pedidoParaTela(null), null);
  assert.deepEqual(pedidoParaTela({ pedido_em: "2026-10-08T15:00:00.000Z", entregue_em: null }),
    { pedidoEm: "2026-10-08T15:00:00.000Z", prazo: "2026-10-23T15:00:00.000Z", entregueEm: null });
});
