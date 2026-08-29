import assert from "node:assert/strict";
import test from "node:test";
import { montarContexto } from "./context";
import type { ActiveBrand } from "./brand-row";

/**
 * O contrato da resolução por requisição.
 *
 * `montarContexto` é a parte pura: recebe o que veio do banco e devolve o que
 * as páginas consomem. A consulta em si vive em workspace-context.ts e é
 * testada contra o banco; aqui protege-se a regra, que é onde os enganos
 * silenciosos moram.
 */

const MARCA: ActiveBrand = {
  id: "id-marca",
  key: "marca-teste",
  brand: { name: "Marca Teste", shortName: "MT", descriptor: "descritor da marca" },
  metadata: { title: "Marca Teste", description: "", language: "en" },
  navigation: { groups: ["Grupo"], groupCodes: {}, defaultDocSlug: "abertura", utilityLinks: [] },
  theme: {
    background: "#000", backgroundSecondary: "#000", surface: "#111", surfaceLight: "#222",
    foreground: "#fff", muted: "#999", accent: "#f00", accentSecondary: "#0f0",
    border: "#333", focus: "#fff", fontStack: "var(--font-ui)",
  },
  ai: { knowledgeMode: "docs", chatRole: "", analysisRole: "" },
  legal: { footerNotice: "" },
};

test("sem sessão não há marca, documentos nem capacidades de escrita", () => {
  const ctx = montarContexto({ auth: null, marca: null, docs: [] });
  assert.equal(ctx.brand, null);
  assert.deepEqual(ctx.docs, []);
  assert.equal(ctx.userEmail, undefined);
  assert.ok(!ctx.capabilities.includes("administrar"));
});

test("ausência de marca é nula, não uma marca falsa", () => {
  const ctx = montarContexto({
    auth: { role: "owner", email: "a@b.c" },
    marca: null,
    docs: [],
  });
  // A distinção que o patch existe para criar: sem marca o valor é null, e
  // quem decide o estado vazio pergunta ao banco, não a uma instância global.
  assert.equal(ctx.brand, null);
  assert.equal(ctx.defaultDocSlug, null);
});

test("a marca resolvida define nome, descritor, tema e documento padrão", () => {
  const ctx = montarContexto({
    auth: { role: "member", email: "a@b.c" },
    marca: MARCA,
    docs: [],
  });
  assert.equal(ctx.brand?.brand.name, "Marca Teste");
  assert.equal(ctx.brand?.brand.descriptor, "descritor da marca");
  assert.equal(ctx.brand?.theme.accent, "#f00");
  assert.equal(ctx.defaultDocSlug, "abertura");
});

test("o idioma da interface não vem do idioma do manual", () => {
  const ctx = montarContexto({
    auth: { role: "owner", email: "a@b.c" },
    marca: MARCA, // metadata.language === "en"
    docs: [],
  });
  // O manual está em inglês; a interface continua em português. Login,
  // navegação e administração são do Brennimark, não da marca apresentada.
  assert.equal(ctx.locale, "pt-BR");
});

test("owner administra, member não", () => {
  const owner = montarContexto({ auth: { role: "owner", email: "a@b.c" }, marca: MARCA, docs: [] });
  const member = montarContexto({ auth: { role: "member", email: "a@b.c" }, marca: MARCA, docs: [] });
  assert.ok(owner.capabilities.includes("administrar"));
  assert.ok(!member.capabilities.includes("administrar"));
});

test("o documento padrão só existe quando a marca declara um", () => {
  const semPadrao = { ...MARCA, navigation: { ...MARCA.navigation, defaultDocSlug: "" } };
  const ctx = montarContexto({ auth: { role: "owner", email: "a@b.c" }, marca: semPadrao, docs: [] });
  // Redirecionar para /docs/ vazio produziria um laço; melhor não redirecionar.
  assert.equal(ctx.defaultDocSlug, null);
});
