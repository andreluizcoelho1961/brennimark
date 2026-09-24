import assert from "node:assert/strict";
import test from "node:test";
import { lerPaginasDigitadas, normalizarPaginasDaRegra } from "./regra";

test("páginas válidas saem ordenadas e sem repetição", () => {
  assert.deepEqual(normalizarPaginasDaRegra([14, "12", 12], 27), { ok: true, paginas: [12, 14] });
  assert.deepEqual(normalizarPaginasDaRegra([], null), { ok: true, paginas: [] });
});

test("página que não existe no manual é recusada — e sem manual, nenhuma existe", () => {
  assert.deepEqual(normalizarPaginasDaRegra([28], 27), { ok: false, motivo: "fora-do-manual" });
  assert.deepEqual(normalizarPaginasDaRegra([1], null), { ok: false, motivo: "fora-do-manual" });
});

test("forma errada e excesso são recusados", () => {
  assert.deepEqual(normalizarPaginasDaRegra("12", 27), { ok: false, motivo: "formato" });
  assert.deepEqual(normalizarPaginasDaRegra([0], 27), { ok: false, motivo: "formato" });
  assert.deepEqual(normalizarPaginasDaRegra([1.5], 27), { ok: false, motivo: "formato" });
  assert.deepEqual(normalizarPaginasDaRegra(["abc"], 27), { ok: false, motivo: "formato" });
  assert.deepEqual(normalizarPaginasDaRegra([1, 2, 3, 4, 5, 6], 27), { ok: false, motivo: "demais" });
});

test("o que se digita vira lista", () => {
  assert.deepEqual(lerPaginasDigitadas(" 12, 14;16  18 "), ["12", "14", "16", "18"]);
  assert.deepEqual(lerPaginasDigitadas(""), []);
});
