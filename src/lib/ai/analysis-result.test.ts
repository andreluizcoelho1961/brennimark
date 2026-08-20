import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAnalysisVerdict, parseAnalysisText } from "./analysis-result";

test("structures a grounded brand analysis and deduplicates sources", () => {
  const result = parseAnalysisText(`**Veredito:** parcialmente alinhada

- Evidências observadas:
- A peça usa preto e turquesa.

- Regras aplicáveis:
- O turquesa é um acento. [Fonte: Guia de Cores — PRONTO · /docs/cores]
- A regra permanece. [Fonte: Guia de Cores — PRONTO · /docs/cores]

- Problemas:
- Não há violação objetiva.

- Impacto: baixo
- Correção mínima recomendada: conferir o arquivo-fonte.
- Confiança: média, pois a imagem está comprimida.`);

  assert.equal(result.verdict, "parcialmente alinhada");
  assert.deepEqual(result.evidence, ["A peça usa preto e turquesa."]);
  assert.equal(result.rules.length, 2);
  assert.deepEqual(result.problems, ["Não há violação objetiva."]);
  assert.equal(result.impact, "baixo");
  assert.equal(result.correction, "conferir o arquivo-fonte.");
  assert.match(result.confidence, /^média/);
  assert.deepEqual(result.sources, ["Fonte: Guia de Cores — PRONTO · /docs/cores"]);
});

test("preserves the raw response when a model ignores the requested headings", () => {
  const result = parseAnalysisText("A peça parece alinhada, mas é preciso conferir o arquivo-fonte.");
  assert.equal(result.verdict, "");
  assert.equal(result.raw, "A peça parece alinhada, mas é preciso conferir o arquivo-fonte.");
});

test("normalizes model verdicts for history metrics and calibration", () => {
  assert.equal(normalizeAnalysisVerdict("Parcialmente alinhada"), "partially_aligned");
  assert.equal(normalizeAnalysisVerdict("DESALINHADA — contraste insuficiente"), "misaligned");
  assert.equal(normalizeAnalysisVerdict("Alinhada"), "aligned");
  assert.equal(normalizeAnalysisVerdict("Não foi possível decidir"), "unknown");
});

test("removes inline markdown decoration from structured sections", () => {
  const result = parseAnalysisText("Problemas:\n- **Violação objetiva:** uso de *wordmark* incorreto.");
  assert.deepEqual(result.problems, ["Violação objetiva: uso de wordmark incorreto."]);
});
