import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CARACTERES_DO_PAPEL_DA_MARCA, parseBrandRow, parseDocumentRow } from "./brand-row";

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

test("chatRole/analysisRole no teto (1.000) são preservados", () => {
  const noTeto = "x".repeat(MAX_CARACTERES_DO_PAPEL_DA_MARCA);
  const marca = parseBrandRow({ ...LINHA_MARCA, ai: { knowledgeMode: "docs", chatRole: noTeto, analysisRole: noTeto } });
  assert.equal(marca?.ai.chatRole, noTeto);
  assert.equal(marca?.ai.analysisRole, noTeto);
});

test("chatRole/analysisRole além do teto (1.001) caem para vazio, não truncam em silêncio", () => {
  /*
   * Mesma disciplina do resto deste arquivo: dado malformado nunca vira
   * conteúdo aprovado. Um papel longo demais é tratado como ausente — cai
   * para "" — nunca é cortado no caractere 1.000 sem avisar, o que
   * mudaria o SENTIDO do que a marca escreveu sem ninguém decidir isso.
   */
  const alemDoTeto = "x".repeat(MAX_CARACTERES_DO_PAPEL_DA_MARCA + 1);
  const marca = parseBrandRow({ ...LINHA_MARCA, ai: { knowledgeMode: "docs", chatRole: alemDoTeto, analysisRole: alemDoTeto } });
  assert.equal(marca?.ai.chatRole, "", "papel longo demais deveria virar vazio, não ficar truncado");
  assert.equal(marca?.ai.analysisRole, "");
});

test("o teto conta CARACTERES Unicode (pontos de código), não unidades UTF-16 nem bytes", () => {
  /*
   * 😀 fica fora do plano básico do Unicode — em JavaScript, `.length`
   * conta UNIDADES UTF-16, e esse emoji ocupa duas: `"😀".repeat(1000).length`
   * dá 2000, não 1000. O `char_length` do Postgres conta pontos de
   * código, então 1.000 emojis contam como 1.000 lá. Se este código
   * usasse `.length` puro, o teto do TypeScript seria mais restritivo que
   * o do banco para qualquer texto com esse tipo de caractere — as duas
   * camadas contariam coisas diferentes com o mesmo nome.
   */
  const milEmojis = "😀".repeat(MAX_CARACTERES_DO_PAPEL_DA_MARCA);
  assert.equal(milEmojis.length, MAX_CARACTERES_DO_PAPEL_DA_MARCA * 2, "cada 😀 ocupa 2 unidades UTF-16 — a premissa deste teste");
  const marca = parseBrandRow({ ...LINHA_MARCA, ai: { knowledgeMode: "docs", chatRole: milEmojis, analysisRole: "" } });
  assert.equal(marca?.ai.chatRole, milEmojis, "1.000 emojis (1.000 pontos de código) deveriam ser aceitos, não recusados por contar unidades UTF-16");
});

test("1.001 pontos de código (não unidades UTF-16) são recusados, mesmo em Unicode", () => {
  const milEUmEmojis = "😀".repeat(MAX_CARACTERES_DO_PAPEL_DA_MARCA + 1);
  const marca = parseBrandRow({ ...LINHA_MARCA, ai: { knowledgeMode: "docs", chatRole: milEUmEmojis, analysisRole: "" } });
  assert.equal(marca?.ai.chatRole, "");
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
