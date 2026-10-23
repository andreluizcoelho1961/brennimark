import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAnalysisVerdict, parseAnalysisText, sanitizeStructuredAnalysis } from "./analysis-result";

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

/**
 * A resposta REAL do Gemini de 23/10/2026 (tabela `analysis_runs`): cabeçalhos
 * `###` sem dois-pontos, itens numerados, separadores `---` e `$2x$`. O leitor
 * antigo jogou tudo no "veredito".
 */
const RESPOSTA_DE_23_10 = [
  "**Veredito:** Desalinhada.", "", "---", "",
  "### Evidências observadas",
  "- **Posição:** O logotipo está posicionado no canto inferior esquerdo do post.",
  "- **Margem até a borda:** O logotipo está encostado às bordas inferior e esquerda.",
  "- **Proporção/Tamanho:** A largura do logotipo ocupa aproximadamente 40% a 50% da largura total do post.", "", "---", "",
  "### Regras aplicáveis",
  "1. **Margem mínima até a borda:** deve ser de $2x$ (duas vezes a altura da letra \"B\") [Fonte: O logotipo nas peças — PRONTO · /docs/o-logotipo-nas-pecas].",
  "2. **Tamanho em posts 1:1 e 4:5:** a largura do logotipo deve ser igual a $1/4$ (25%) da largura do post [Fonte: O logotipo nas peças — PRONTO · /docs/o-logotipo-nas-pecas].",
  "3. **Área de proteção:** de $1x$ nos quatro lados [Fonte: Área de proteção — PRONTO · /docs/area-de-protecao].", "", "---", "",
  "### Problemas",
  "1. **Violação de margem (Objetiva):** O logotipo não respeita a margem mínima de $2x$.",
  "2. **Violação de proporção/tamanho (Objetiva):** O logotipo está superdimensionado.", "", "---", "",
  "### Impacto", "**Alto.** O desrespeito às margens compromete o respiro visual da peça.", "", "---", "",
  "### Correção mínima recomendada", "Reduzir a largura do logotipo para $1/4$ da largura do post.", "", "---", "",
  "### Confiança", "**Alta.** As regras de dimensionamento e margem são claras.",
].join("\n");

test("cabeçalhos ### sem dois-pontos, itens numerados e --- viram as seções, e não um veredito gigante", () => {
  const a = sanitizeStructuredAnalysis(parseAnalysisText(RESPOSTA_DE_23_10));
  assert.equal(a.verdict, "Desalinhada.");
  assert.equal(a.evidence.length, 3);
  assert.equal(a.rules.length, 3);
  assert.equal(a.problems.length, 2);
  assert.match(a.impact, /^Alto\./);
  assert.match(a.correction, /^Reduzir a largura/);
  assert.match(a.confidence, /^Alta\./);
  assert.equal(a.sources.length, 2);
  // Sem o número do item (a lista já numera), sem `---` e sem os cifrões do LaTeX.
  assert.ok(a.rules[0].startsWith("Margem mínima até a borda:"));
  assert.ok(!a.rules.join(" ").includes("$"));
  assert.ok(a.rules[0].includes("2x"));
  assert.ok(![a.verdict, ...a.evidence, ...a.rules, ...a.problems, a.impact, a.correction, a.confidence].some((x) => x.includes("---")));
});

test("o formato antigo (itens com dois-pontos na mesma linha) segue lido como antes", () => {
  const a = parseAnalysisText("Veredito: Parcialmente alinhada\nEvidências:\n- A cor está certa\nProblemas: nenhum");
  assert.equal(a.verdict, "Parcialmente alinhada");
  assert.deepEqual(a.evidence, ["A cor está certa"]);
  assert.deepEqual(a.problems, ["nenhum"]);
});
