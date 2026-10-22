import assert from "node:assert/strict";
import test from "node:test";
import { sha256Hex, validarPedidoDePareamento } from "./pareamento";

test("pareamento aceita hashes, uuid e um rótulo limitado", () => {
  const hash = sha256Hex("segredo local");
  assert.deepEqual(validarPedidoDePareamento({ id: "1a2b3c4d-1111-4111-8111-111111111111", tokenHash: hash, segredoHash: hash, rotuloDoDispositivo: "Mac do estúdio" }), {
    id: "1a2b3c4d-1111-4111-8111-111111111111", tokenHash: hash, segredoHash: hash, rotuloDoDispositivo: "Mac do estúdio",
  });
});

test("pareamento recusa segredo cru, hash curto e rótulo de controle", () => {
  assert.equal(validarPedidoDePareamento({ id: "x", tokenHash: "segredo", segredoHash: "x", rotuloDoDispositivo: "Mac\n" }), null);
});
