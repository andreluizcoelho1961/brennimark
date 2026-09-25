import assert from "node:assert/strict";
import test from "node:test";
import { NOME_MAXIMO, confirmacaoConfere, normalizarNomeDaMarca } from "./nome-da-marca";

test("o nome é aparado e os espaços em sequência viram um só", () => {
  assert.equal(normalizarNomeDaMarca("  Grupo   HEINEKEN  "), "Grupo HEINEKEN");
});

test("quebra de linha e caractere de controle não entram no nome", () => {
  assert.equal(normalizarNomeDaMarca("Sony\nVaio\t"), "Sony Vaio");
});

test("nome vazio, só espaço ou que não é texto é recusado", () => {
  assert.equal(normalizarNomeDaMarca(""), null);
  assert.equal(normalizarNomeDaMarca("   "), null);
  assert.equal(normalizarNomeDaMarca(null), null);
  assert.equal(normalizarNomeDaMarca(42), null);
});

test("o teto é o do banco: 120 entra, 121 não", () => {
  assert.equal(normalizarNomeDaMarca("a".repeat(NOME_MAXIMO)), "a".repeat(NOME_MAXIMO));
  assert.equal(normalizarNomeDaMarca("a".repeat(NOME_MAXIMO + 1)), null);
});

test("a confirmação de apagar aceita o nome sem distinguir caixa nem espaços", () => {
  assert.equal(confirmacaoConfere("  grupo heineken ", "Grupo HEINEKEN"), true);
  assert.equal(confirmacaoConfere("Grupo", "Grupo HEINEKEN"), false);
  assert.equal(confirmacaoConfere("", ""), false);
});
