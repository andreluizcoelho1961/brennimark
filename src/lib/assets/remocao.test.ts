import assert from "node:assert/strict";
import test from "node:test";
import { decidirRemocao } from "./remocao";

/**
 * A trava que separa "sai de uso" de "some para sempre".
 *
 * Até 13/09/2026 não havia decisão nenhuma: o botão da biblioteca apagava. O
 * teste que importa aqui é o negativo — pedir o apagamento de um asset em uso
 * precisa ser RECUSADO, e não atendido "porque a pessoa pediu".
 */

test("o pedido comum tira de uso, e não apaga", () => {
  assert.deepEqual(decidirRemocao({ definitivo: false, descontinuadoEm: null }), {
    acao: "descontinuar",
  });
});

test("apagar um asset EM USO é recusado", () => {
  assert.deepEqual(decidirRemocao({ definitivo: true, descontinuadoEm: null }), {
    acao: "recusar",
    motivo: "precisa-descontinuar-antes",
  });
});

test("apagar o que já saiu de uso é o único caminho até o apagamento", () => {
  assert.deepEqual(decidirRemocao({ definitivo: true, descontinuadoEm: "2026-09-13T10:00:00Z" }), {
    acao: "apagar",
  });
});

test("descontinuar duas vezes não é operação", () => {
  // Sem isto, o segundo clique carimbaria uma data nova por cima e apagaria
  // quando o asset saiu de uso de verdade — reescrever histórico em silêncio.
  assert.deepEqual(decidirRemocao({ definitivo: false, descontinuadoEm: "2026-09-13T10:00:00Z" }), {
    acao: "recusar",
    motivo: "ja-descontinuado",
  });
});
