import assert from "node:assert/strict";
import test from "node:test";
import {
  INTERVALO_ENTRE_PEDIDOS_S, MARCA_APAGADA, PRAZO_DA_RECUPERACAO_MINUTOS,
  conferirSegredo, gerarSegredo, lerEmail, marcaDoPedido, podePedirDeNovo, resumoDoSegredo,
} from "./recuperacao";

const AGORA = Date.UTC(2026, 9, 3, 12, 0, 0);

test("o e-mail do pedido: limpo, em minúsculas; lixo é recusado", () => {
  assert.equal(lerEmail("  Fulana@Agencia.COM "), "fulana@agencia.com");
  assert.equal(lerEmail("sem-arroba"), null);
  assert.equal(lerEmail(42), null);
  assert.equal(lerEmail(`${"a".repeat(250)}@b.co`), null);
});

test("o segredo confere só com o resumo guardado, uma vez, no prazo", async () => {
  const segredo = gerarSegredo();
  const meta = marcaDoPedido(await resumoDoSegredo(segredo), AGORA);
  assert.equal(await conferirSegredo(meta, segredo, AGORA + 60_000), "confere");
  assert.equal(await conferirSegredo(meta, gerarSegredo(), AGORA), "nao-confere");
  assert.equal(await conferirSegredo(meta, "curto", AGORA), "nao-confere");
  assert.equal(await conferirSegredo(meta, undefined, AGORA), "nao-confere");
  const limite = PRAZO_DA_RECUPERACAO_MINUTOS * 60_000;
  assert.equal(await conferirSegredo(meta, segredo, AGORA + limite), "confere");
  assert.equal(await conferirSegredo(meta, segredo, AGORA + limite + 1), "vencido");
  // Depois da troca, a marca sai — e o mesmo segredo não serve mais.
  assert.equal(await conferirSegredo({ ...meta, ...MARCA_APAGADA }, segredo, AGORA), "sem-pedido");
  assert.equal(await conferirSegredo(null, segredo, AGORA), "sem-pedido");
});

test("segredo errado não descobre se o link venceu", async () => {
  const meta = marcaDoPedido(await resumoDoSegredo(gerarSegredo()), AGORA);
  assert.equal(await conferirSegredo(meta, gerarSegredo(), AGORA + 10 * 3_600_000), "nao-confere");
});

test("pedir de novo cedo demais não manda outro e-mail", () => {
  const meta = marcaDoPedido("r", AGORA);
  assert.equal(podePedirDeNovo({}, AGORA), true);
  assert.equal(podePedirDeNovo(meta, AGORA + 1000), false);
  assert.equal(podePedirDeNovo(meta, AGORA + INTERVALO_ENTRE_PEDIDOS_S * 1000), true);
  assert.equal(podePedirDeNovo({ recuperacao_pedida_em: "lixo" }, AGORA), true);
});

test("o segredo: 64 hexadecimais, nunca o mesmo, e o resumo não é o segredo", async () => {
  const a = gerarSegredo();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(gerarSegredo(), a);
  assert.notEqual(await resumoDoSegredo(a), a);
});
