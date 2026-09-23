import assert from "node:assert/strict";
import test from "node:test";
import { MAX_TITULO, idDeConversa, limitarConteudo, tituloDaConversa } from "./conversas";

test("o título é a primeira pergunta, numa linha só", () => {
  assert.equal(tituloDaConversa("  qual é   a cor\nprimária? "), "qual é a cor primária?");
  assert.equal(tituloDaConversa("   "), "Conversa");
});

test("pergunta longa vira título com reticências, dentro do teto do banco", () => {
  const t = tituloDaConversa("x".repeat(300));
  assert.equal(t.length, MAX_TITULO);
  assert.ok(t.endsWith("…"));
});

test("identificador do navegador só vale com forma de uuid", () => {
  assert.equal(idDeConversa("5A6195C2-35A7-4B41-B475-972F186F3021"), "5a6195c2-35a7-4b41-b475-972f186f3021");
  assert.equal(idDeConversa("'; drop table conversas; --"), null);
  assert.equal(idDeConversa(42), null);
  assert.equal(idDeConversa(undefined), null);
});

test("conteúdo acima do teto é cortado, não recusado", () => {
  assert.equal(limitarConteudo("abc"), "abc");
  assert.equal(limitarConteudo("y".repeat(50_000)).length, 40_000);
});
