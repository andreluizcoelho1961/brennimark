import assert from "node:assert/strict";
import test from "node:test";
import { intervaloDeEspera } from "./fila";

test("a primeira tentativa é imediata", () => {
  // A maioria das exclusões funciona. Cobrar espera de todas para punir as
  // poucas que falham seria o troco errado.
  assert.equal(intervaloDeEspera(0), 0);
});

test("a espera cresce a cada falha", () => {
  const esperas = [1, 2, 3, 4].map(intervaloDeEspera);
  for (let i = 1; i < esperas.length; i += 1) {
    assert.ok(esperas[i] > esperas[i - 1], "repetir a mesma falha no mesmo ritmo não é tentar de novo");
  }
});

test("a espera tem teto de uma hora", () => {
  // Sem teto, um arquivo que falhou dez vezes esperaria dias depois que o
  // problema já passou — e uma falha do Storage costuma ser transitória.
  assert.equal(intervaloDeEspera(50), 60 * 60_000);
  assert.equal(intervaloDeEspera(1000), 60 * 60_000);
});

test("tentativa negativa não vira espera negativa", () => {
  assert.equal(intervaloDeEspera(-1), 0);
});
