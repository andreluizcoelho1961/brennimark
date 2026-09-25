import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCT_LOCALE, inEnglish, isProductLocale, resolveInterfaceLocale } from "./locale";

/**
 * O idioma da interface pertence ao produto e à pessoa; nunca ao manual.
 *
 * O defeito que isto protege era generalizado: 33 pontos decidiam a microcópia
 * da plataforma por `brennimarkInstance.metadata.language`. Importar um manual
 * em inglês passava login, navegação, administração e mensagens de erro para o
 * inglês — a pessoa não pediu isso, a marca do cliente dela pediu.
 */

test("sem preferência, o produto fala o idioma padrão", () => {
  assert.equal(resolveInterfaceLocale(), PRODUCT_LOCALE);
  assert.equal(resolveInterfaceLocale(undefined), PRODUCT_LOCALE);
});

test("a preferência da pessoa vale quando existe", () => {
  assert.equal(resolveInterfaceLocale("en"), "en");
  assert.equal(resolveInterfaceLocale("pt-BR"), "pt-BR");
});

test("um idioma que o produto não fala cai no padrão", () => {
  // Um manual pode declarar qualquer coisa em `metadata.language`. Se esse
  // valor chegasse aqui por engano, a interface não pode ficar em um idioma
  // que ela não tem tradução para exibir.
  assert.equal(resolveInterfaceLocale("de"), PRODUCT_LOCALE);
  assert.equal(resolveInterfaceLocale("pt"), PRODUCT_LOCALE);
  assert.equal(resolveInterfaceLocale(""), PRODUCT_LOCALE);
  assert.equal(resolveInterfaceLocale(42), PRODUCT_LOCALE);
});

test("o vocabulário de idiomas do produto é fechado", () => {
  assert.ok(isProductLocale("pt-BR"));
  assert.ok(isProductLocale("en"));
  assert.ok(!isProductLocale("en-US"));
  assert.ok(!isProductLocale(null));
});

test("inEnglish responde ao idioma da interface", () => {
  assert.equal(inEnglish("en"), true);
  assert.equal(inEnglish("pt-BR"), false);
});
