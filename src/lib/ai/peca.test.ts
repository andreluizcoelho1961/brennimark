import assert from "node:assert/strict";
import test from "node:test";
import { analiseEmMarkdown, conferirPeca, textoDaRecusa, tomDoVeredito, TETO_DA_PECA_BYTES } from "./peca";
import type { StructuredAnalysis } from "./analysis-result";

const vazia: StructuredAnalysis = {
  verdict: "", evidence: [], rules: [], problems: [], impact: "", correction: "", confidence: "", sources: [], raw: "",
};

test("a peça aceita são as imagens que a rota lê", () => {
  assert.equal(conferirPeca({ type: "image/png", size: 1000 }), null);
  assert.equal(conferirPeca({ type: "image/jpeg", size: TETO_DA_PECA_BYTES }), null);
  assert.equal(conferirPeca({ type: "application/pdf", size: 1000 }), "formato");
  assert.equal(conferirPeca({ type: "", size: 1000 }), "formato");
  assert.equal(conferirPeca({ type: "image/png", size: TETO_DA_PECA_BYTES + 1 }), "tamanho");
});

test("a recusa diz qual limite barrou", () => {
  assert.match(textoDaRecusa("tamanho", { type: "image/png", size: 12.4 * 1024 * 1024 }),
    /tem 12,4 MB; o limite é 10 MB por imagem/);
  assert.match(textoDaRecusa("formato", { type: "application/pdf", size: 1 }),
    /este arquivo é application\/pdf/);
  assert.match(textoDaRecusa("formato", { type: "", size: 1 }), /formato desconhecido/);
});

test("o tom do veredito segue o vocabulário do produto", () => {
  assert.equal(tomDoVeredito("Alinhada"), "aligned");
  assert.equal(tomDoVeredito("Parcialmente alinhada"), "partially_aligned");
  assert.equal(tomDoVeredito("Desalinhada"), "misaligned");
  assert.equal(tomDoVeredito("sei lá"), "unknown");
});

test("a análise vira Markdown com as seções que têm conteúdo, e só elas", () => {
  const md = analiseEmMarkdown({
    ...vazia,
    problems: ["O azul não é o da paleta [Fonte: Cores — PRONTO · /docs/cores]"],
    rules: ["Clusters sempre em azul"],
    correction: "Trocar pelo azul #0050A0.",
  });
  assert.equal(md, [
    "### Problemas",
    "- O azul não é o da paleta [Fonte: Cores — PRONTO · /docs/cores]",
    "",
    "### Regras aplicáveis",
    "- Clusters sempre em azul",
    "",
    "### Correção sugerida",
    "Trocar pelo azul #0050A0.",
  ].join("\n"));
  assert.doesNotMatch(md, /Evidências|Impacto|Confiança/);
});

test("fonte já citada no corpo não repete; a só listada aparece", () => {
  const md = analiseEmMarkdown({
    ...vazia,
    problems: ["Cor errada [Fonte: Cores — PRONTO · /docs/cores]"],
    sources: ["Fonte: Cores — PRONTO · /docs/cores", "Fonte: Logo — RASCUNHO · /docs/logo"],
  });
  assert.equal((md.match(/\/docs\/cores/g) ?? []).length, 1);
  assert.match(md, /### Fontes\n- \[Fonte: Logo — RASCUNHO · \/docs\/logo\]/);
});

test("análise sem nada vira texto vazio, não títulos sem conteúdo", () => {
  assert.equal(analiseEmMarkdown(vazia), "");
});
