import assert from "node:assert/strict";
import test from "node:test";
import { lerPedidoDeSaida, tokenDeSaidaValido } from "./saida";

const TOKEN = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test("só um uuid inteiro vale como token de saída", () => {
  assert.equal(tokenDeSaidaValido(TOKEN), true);
  assert.equal(tokenDeSaidaValido(TOKEN.toUpperCase()), true);
  for (const ruim of ["", "abc", TOKEN.slice(1), `${TOKEN}0`, `${TOKEN}'; drop table x; --`, null, undefined, 42, {}]) {
    assert.equal(tokenDeSaidaValido(ruim), false, String(ruim));
  }
});

test("o pedido de saída traz o token e uma das duas ações", () => {
  assert.deepEqual(lerPedidoDeSaida({ token: TOKEN, acao: "sair" }), { token: TOKEN, acao: "sair" });
  assert.deepEqual(lerPedidoDeSaida({ token: TOKEN.toUpperCase(), acao: "apagar" }), { token: TOKEN, acao: "apagar" });
});

test("pedido torto é recusado, e ação desconhecida não vira apagar", () => {
  for (const ruim of [null, undefined, "x", [], {}, { token: TOKEN }, { acao: "sair" }, { token: TOKEN, acao: "excluir" }, { token: "x", acao: "sair" }]) {
    assert.equal(lerPedidoDeSaida(ruim), null);
  }
});
