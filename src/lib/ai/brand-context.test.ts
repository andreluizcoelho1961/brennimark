import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAnalysisSystemPrompt,
  buildAnalysisBrandContext,
  buildBrandContext,
  buildChatSystemPrompt,
  getBrandKnowledgeSources,
} from "./brand-context";

test("normaliza páginas e dados estruturados em fontes únicas", () => {
  const sources = getBrandKnowledgeSources();
  const ids = sources.map((source) => source.id);

  assert.equal(new Set(ids).size, ids.length, "source ids must be unique");
  assert.ok(sources.some((source) => source.id === "structured:colors"));
  assert.ok(sources.some((source) => source.id === "structured:typography"));
  assert.ok(sources.some((source) => source.id === "structured:logos"));
  assert.ok(sources.some((source) => source.id === "structured:voice"));
  assert.ok(sources.some((source) => source.id === "assets:official"));
});

test("usa um contexto visual compacto na análise de peças", () => {
  const context = buildAnalysisBrandContext();
  const fullContext = buildBrandContext();

  assert.match(context, /id="structured:colors"/);
  assert.match(context, /id="structured:logos"/);
  assert.doesNotMatch(context, /id="assets:official"/);
  assert.ok(context.length < fullContext.length);
  assert.ok(buildAnalysisSystemPrompt().includes(context));
});

test("inclui respostas para as perguntas críticas da marca", () => {
  const context = buildBrandContext();

  assert.match(context, /#000000/);
  assert.match(context, /#F6F2EF/);
  assert.match(context, /#01A48F/);
  assert.match(context, /Gotham Black \(900\)/);
  assert.match(context, /wordmark-horizontal-white\.png/);
  assert.match(context, /Keep it monochrome/);
  assert.match(context, /Fora do vocabulário: Revolutionary/);
  assert.match(context, /portrait-spotlight\.jpg/);
  assert.match(context, /Music-Icons\.ai/);
});

test("preserva status e caminho para respostas verificáveis", () => {
  const context = buildBrandContext();

  assert.match(context, /id="structured:colors" status="PRONTO"/);
  assert.match(context, /id="structured:photography" status="RASCUNHO"/);
  assert.match(context, /CAMINHO: \/docs\/universo-visual\/guia-de-cores/);
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
