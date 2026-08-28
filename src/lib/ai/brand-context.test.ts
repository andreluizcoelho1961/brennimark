import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisBrandContext,
  buildBrandContext,
  buildChatSystemPrompt,
  getBrandKnowledgeSources,
} from "./brand-context";
import type { DocPageEntry } from "../../content/docs";

const PAGINAS: DocPageEntry[] = [
  {
    slug: "cores",
    group: "Visual",
    title: "Cores",
    status: "ready",
    body: ["A cor primária é aplicada em superfície, não em texto corrido."],
    blocks: [{ kind: "swatches", items: [{ name: "Primária", hex: "#2B6CB0" }] }],
  },
  { slug: "voz", group: "Verbal", title: "Tom de voz", status: "draft", body: ["Frase curta, sem adjetivo vazio."] },
  { slug: "pendente", group: "Verbal", title: "Assinatura", status: "pending", body: [] },
];

test("cada página vira uma fonte, e só o que a marca importou entra", () => {
  const sources = getBrandKnowledgeSources(PAGINAS);
  const ids = sources.map((source) => source.id);

  assert.equal(new Set(ids).size, ids.length, "ids de fonte precisam ser únicos");
  assert.equal(sources.length, PAGINAS.length, "nenhuma fonte além das páginas");
  assert.ok(sources.every((source) => source.kind === "guide-page"));
  assert.ok(!ids.some((id) => id.startsWith("structured:")), "não pode haver fonte fabricada pelo produto");
});

test("sem marca importada, o contexto é vazio em vez de inventado", () => {
  assert.deepEqual(getBrandKnowledgeSources([]), []);
  assert.equal(buildBrandContext([]).trim(), "");
});

test("a análise recebe só as páginas com bloco visual", () => {
  const context = buildAnalysisBrandContext(PAGINAS);
  const fullContext = buildBrandContext(PAGINAS);

  assert.match(context, /id="doc:cores"/);
  assert.doesNotMatch(context, /id="doc:voz"/, "página sem bloco visual não deveria entrar");
  assert.ok(context.length < fullContext.length);
});

test("guia sem nenhum bloco visual cai para o guia inteiro, em vez de mandar vazio", () => {
  const semBlocos = PAGINAS.filter((p) => !p.blocks);
  const context = buildAnalysisBrandContext(semBlocos);
  assert.match(context, /id="doc:voz"/);
  assert.ok(buildAnalysisSystemPrompt(semBlocos).includes(context), "o prompt de análise precisa embutir o contexto");
});

test("o valor de um bloco chega ao contexto, com o status da página que o contém", () => {
  const context = buildBrandContext(PAGINAS);

  assert.match(context, /#2B6CB0/, "o hex do swatch precisa chegar à IA");
  assert.match(context, /PRONTO/, "a página aprovada precisa se anunciar como tal");
  assert.match(context, /RASCUNHO/, "rascunho não pode ser apresentado como regra");
});

test("preserva status e caminho para respostas verificáveis", () => {
  const sources = getBrandKnowledgeSources(PAGINAS);

  for (const source of sources) {
    assert.ok(source.title, "toda fonte precisa de título citável");
    assert.match(source.path, /^\/docs\//, "o caminho precisa levar de volta à página");
    assert.ok(["ready", "draft", "pending"].includes(source.status));
  }

  const pendente = sources.find((s) => s.status === "pending");
  assert.ok(pendente, "página em construção precisa continuar sendo uma fonte");
  assert.equal(pendente.facts.length, 0, "página sem conteúdo não pode ganhar fato inventado");
});

test("prompts exigem citação, incerteza e separação de interpretação", () => {
  const chatPrompt = buildChatSystemPrompt();
  const analysisPrompt = buildAnalysisSystemPrompt();

  for (const prompt of [chatPrompt, analysisPrompt]) {
    assert.match(prompt, /Toda afirmação material deve terminar.*com uma citação/);
    assert.match(prompt, /Não há uma diretriz documentada suficiente para responder isso/);
    assert.match(prompt, /Interpretação:/);
    assert.match(prompt, /<brand_knowledge>/);
    assert.match(prompt, /<\/brand_knowledge>/);
  }

  assert.match(analysisPrompt, /Veredito: alinhada, parcialmente alinhada ou desalinhada/);
  assert.match(analysisPrompt, /Confiança: alta, média ou baixa/);
  assert.match(analysisPrompt, /não permitem confirmar um valor hexadecimal exato/i);
  assert.match(analysisPrompt, /não constitui violação se for plausivelmente compatível/i);
  assert.match(analysisPrompt, /essa evidência documental prevalece/i);
});
