import assert from "node:assert/strict";
import test from "node:test";
import { platformTheme } from "./identity";
import * as tokens from "./tokens";
import { brandCssVars, platformCssVars } from "./tokens";

const BRAND_THEME = {
  background: "#0A0A0A", backgroundSecondary: "#111111", surface: "#141414",
  surfaceLight: "#1C1C1C", foreground: "#FFFFFF", muted: "#8FC0AC",
  accent: "#8FC0AC", accentSecondary: "#D4AF37", border: "#2A2A2A",
  focus: "#2E4A6B", fontStack: "'Barlow', sans-serif",
};

test("tokens da plataforma só usam o namespace da plataforma", () => {
  for (const key of Object.keys(platformCssVars(platformTheme))) {
    assert.ok(/^--(platform|color-platform)-/.test(key), `token fora do namespace: ${key}`);
  }
});

test("tokens da marca só usam o namespace da marca", () => {
  for (const key of Object.keys(brandCssVars(BRAND_THEME))) {
    assert.ok(/^--(brand|color-brand|font-brand)/.test(key), `token fora do namespace: ${key}`);
  }
});

test("nenhum token vaza de um namespace para o outro", () => {
  const plat = new Set(Object.keys(platformCssVars(platformTheme)));
  const brand = new Set(Object.keys(brandCssVars(BRAND_THEME)));
  for (const key of brand) assert.ok(!plat.has(key), `marca invadiu a plataforma: ${key}`);
  for (const key of plat) assert.ok(!brand.has(key), `plataforma invadiu a marca: ${key}`);
});

test("nenhum valor da marca aparece nos tokens da plataforma", () => {
  const values = new Set(Object.values(platformCssVars(platformTheme)).map(String));
  for (const brandValue of Object.values(BRAND_THEME)) {
    assert.ok(!values.has(String(brandValue)), `valor da marca na plataforma: ${brandValue}`);
  }
});

test("todo campo do tema da marca vira token da marca", () => {
  const emitted = JSON.stringify(brandCssVars(BRAND_THEME));
  for (const [field, value] of Object.entries(BRAND_THEME)) {
    assert.ok(emitted.includes(String(value)), `campo não emitido: ${field}`);
  }
});

test("não existem mais aliases de compatibilidade", () => {
  // Eles apontavam o vocabulário legado para a plataforma ou para a marca,
  // conforme o escopo, e serviram para migrar sem quebrar tudo de uma vez.
  //
  // Enquanto existiam, um componente novo podia consumir o nome antigo e
  // FUNCIONAR — e funcionar era o problema: o nome legado não dizia se aquela
  // cor era da moldura ou da marca, que é justamente a distinção que o produto
  // precisa manter. Removidos no V1; escolher entre os dois namespaces virou
  // obrigatório.
  const exportado = Object.keys(tokens);
  assert.ok(!exportado.includes("platformAliasVars"), "o alias da plataforma voltou");
  assert.ok(!exportado.includes("brandAliasVars"), "o alias da marca voltou");
  // E nenhum outro export com cara de ponte entre os vocabulários.
  assert.deepEqual(exportado.filter((nome) => /alias|legad|compat/i.test(nome)), []);
});
