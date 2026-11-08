import assert from "node:assert/strict";
import { test } from "node:test";
import { dolaresParaMicros, microsParaDolares, perguntasQueCabem } from "./teto";

test("vazio, nulo e texto em branco significam sem teto", () => {
  assert.equal(dolaresParaMicros(null), null);
  assert.equal(dolaresParaMicros(undefined), null);
  assert.equal(dolaresParaMicros(""), null);
  assert.equal(dolaresParaMicros("   "), null);
});

test("dólar vira micros inteiros, com vírgula ou ponto", () => {
  assert.equal(dolaresParaMicros(5), 5_000_000);
  assert.equal(dolaresParaMicros("12,5"), 12_500_000);
  assert.equal(dolaresParaMicros("0.02"), 20_000);
});

test("zero, negativo, texto, infinito e acima do máximo são inválidos", () => {
  for (const v of [0, -1, "abc", Number.NaN, Infinity, 1_000_001, {}, [], true]) {
    assert.equal(dolaresParaMicros(v), "invalido", String(v));
  }
});

test("micros de volta para dólares", () => {
  assert.equal(microsParaDolares(null), null);
  assert.equal(microsParaDolares(2_500_000), 2.5);
});

test("perguntas que cabem: média real com 5 ou mais, estimativa com menos", () => {
  assert.deepEqual(perguntasQueCabem(1, 0.5, 10), { quantas: 20, estimativa: false });
  assert.deepEqual(perguntasQueCabem(1, 0.01, 1), { quantas: 50, estimativa: true });
  assert.deepEqual(perguntasQueCabem(0.001, 0, 0), { quantas: 0, estimativa: true });
});
