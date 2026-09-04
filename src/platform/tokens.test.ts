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

// ─── --font-brand-display: nunca por indireção var() ──────────────────────
//
// Achado ao testar o editor de tema ao vivo: uma primeira versão declarava
// `--font-brand-display: var(--font-brand)` só no :root, esperando que
// marcas sem fonte de título/destaque própria herdassem a de corpo. Não
// herdava — uma custom property só recalcula onde é REDECLARADA, e como só
// o :root a declarava, ela "congelava" ali, ANTES de qualquer marca existir,
// e toda marca acabava com a fonte de UI no título, mesmo com a fonte de
// corpo certa ao lado. A correção: `brandCssVars` sempre emite um valor
// LITERAL, nunca uma referência a outra variável.

test("--font-brand-display é sempre um valor literal, nunca uma referência var()", () => {
  const emitted = brandCssVars(BRAND_THEME) as Record<string, string>;
  assert.equal(emitted["--font-brand-display"], BRAND_THEME.fontStack,
    "sem fontStackDisplay próprio, o valor deveria ser o LITERAL de fontStack — nunca `var(--font-brand)`");
  assert.ok(!String(emitted["--font-brand-display"]).includes("var("),
    "indireção var() aqui é o defeito que este teste existe para impedir");
});

test("--font-brand-display usa o valor de fontStackDisplay quando a marca declara um", () => {
  const emitted = brandCssVars({ ...BRAND_THEME, fontStackDisplay: "'Univers Condensed', sans-serif" }) as Record<string, string>;
  assert.equal(emitted["--font-brand-display"], "'Univers Condensed', sans-serif");
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
