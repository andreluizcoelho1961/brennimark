import assert from "node:assert/strict";
import test from "node:test";
import { platformTheme } from "./identity";
import { brandCssVars, platformCssVars, platformAliasVars } from "./tokens";

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

test("os aliases de compatibilidade apontam para a plataforma", () => {
  for (const [key, value] of Object.entries(platformAliasVars())) {
    assert.ok(key.startsWith("--color-"), `alias fora do prefixo legado: ${key}`);
    assert.match(String(value), /var\(--platform-/, `alias não aponta para a plataforma: ${key}`);
  }
});
