import assert from "node:assert/strict";
import test from "node:test";
import { localeDoNavegador } from "./locale";

test("o navegador em português ou sem pedido cai em pt-BR", () => {
  assert.equal(localeDoNavegador("pt-BR,pt;q=0.9,en;q=0.8"), "pt-BR");
  assert.equal(localeDoNavegador("pt-PT"), "pt-BR");
  assert.equal(localeDoNavegador(null), "pt-BR");
  assert.equal(localeDoNavegador(""), "pt-BR");
});

test("o navegador em inglês vira en, e o peso q decide entre dois idiomas", () => {
  assert.equal(localeDoNavegador("en-US,en;q=0.9"), "en");
  assert.equal(localeDoNavegador("en-GB"), "en");
  assert.equal(localeDoNavegador("pt;q=0.5,en;q=0.9"), "en");
});

test("idioma que o produto não tem cai no padrão", () => {
  assert.equal(localeDoNavegador("fr-FR,de;q=0.8"), "pt-BR");
  assert.equal(localeDoNavegador("fr,en;q=0.5"), "en");
});
