import assert from "node:assert/strict";
import test from "node:test";
import { parseBrandRow, parseDocumentRow } from "./brand-row";

const LINHA_MARCA = {
  id: "b1", key: "acme", name: "Acme", short_name: "Acme", descriptor: "Sistema de marca",
  language: "pt-BR",
  metadata: { title: "Acme — Brennimark", description: "Diretrizes." },
  navigation: { groups: ["Fundamentos"], groupCodes: { Fundamentos: "FU" }, defaultDocSlug: "intro", utilityLinks: ["chat"] },
  theme: {
    background: "#ffffff", backgroundSecondary: "#f4f4f4", surface: "#f0f0f0", surfaceLight: "#fafafa",
    foreground: "#111111", muted: "#666666", accent: "#cc0000", accentSecondary: "#ff8800",
    border: "#dddddd", focus: "#990000", fontStack: "Inter, sans-serif",
  },
  ai: { knowledgeMode: "docs", chatRole: "Assistente.", analysisRole: "Analista." },
  legal: { footerNotice: "Uso autorizado." },
  status_labels: null,
};

test("uma linha de brands vira instância utilizável", () => {
  const marca = parseBrandRow(LINHA_MARCA);
  assert.ok(marca);
  assert.equal(marca.key, "acme");
  assert.equal(marca.brand.name, "Acme");
  assert.equal(marca.metadata.language, "pt-BR");
  assert.equal(marca.theme.accent, "#cc0000");
  assert.equal(marca.navigation.defaultDocSlug, "intro");
});

test("linha malformada devolve null, em vez de renderizar quebrado", () => {
  assert.equal(parseBrandRow(null), null);
  assert.equal(parseBrandRow({ ...LINHA_MARCA, theme: null }), null);
  assert.equal(parseBrandRow({ ...LINHA_MARCA, key: "" }), null);
  assert.equal(parseBrandRow({ ...LINHA_MARCA, theme: { background: "#fff" } }), null,
    "tema incompleto não pode passar: pintaria a tela com valor indefinido");
});

test("statusLabels só entra quando tem as três chaves", () => {
  assert.equal(parseBrandRow(LINHA_MARCA)?.statusLabels, undefined);
  const comRotulos = parseBrandRow({ ...LINHA_MARCA,
    status_labels: { ready: "Documented", draft: "Case synthesis", pending: "In progress" } });
  assert.equal(comRotulos?.statusLabels?.ready, "Documented");
  const incompleto = parseBrandRow({ ...LINHA_MARCA, status_labels: { ready: "Só um" } });
  assert.equal(incompleto?.statusLabels, undefined, "rótulo parcial não pode ser aplicado pela metade");
});

const LINHA_DOC = {
  slug: "intro", group_name: "Fundamentos", title: "Introdução", status: "ready",
  body: ["Primeiro parágrafo."],
  images: [],
  blocks: [{ kind: "callout", text: "Uma regra." }],
  sort_order: 0,
};

test("uma linha de brand_documents vira página do manual", () => {
  const pagina = parseDocumentRow(LINHA_DOC);
  assert.ok(pagina);
  assert.equal(pagina.slug, "intro");
  assert.equal(pagina.status, "ready");
  assert.equal(pagina.body?.[0], "Primeiro parágrafo.");
  assert.equal(pagina.blocks?.[0]?.kind, "callout");
});

test("status inválido no banco não vira conteúdo aprovado", () => {
  const forjado = parseDocumentRow({ ...LINHA_DOC, status: "aprovadíssimo" });
  assert.equal(forjado, null, "status fora do vocabulário precisa reprovar a linha inteira");
});

test("bloco malformado não derruba a página; ela vem sem blocos", () => {
  const pagina = parseDocumentRow({ ...LINHA_DOC, blocks: [{ kind: "inexistente" }] });
  assert.ok(pagina, "a página precisa sobreviver");
  assert.equal(pagina.blocks, undefined);
  assert.equal(pagina.body?.[0], "Primeiro parágrafo.", "o texto continua servindo");
});
