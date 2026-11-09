import assert from "node:assert/strict";
import test from "node:test";
import { idiomaDoEmailPelaMoeda } from "./idioma-do-email";

test("quem assina em dólar recebe e-mail em inglês; o resto, em português", () => {
  assert.equal(idiomaDoEmailPelaMoeda("USD"), "en");
  assert.equal(idiomaDoEmailPelaMoeda("usd"), "en");
  assert.equal(idiomaDoEmailPelaMoeda("BRL"), "pt-BR");
  assert.equal(idiomaDoEmailPelaMoeda(null), "pt-BR");
  assert.equal(idiomaDoEmailPelaMoeda(undefined), "pt-BR");
});
