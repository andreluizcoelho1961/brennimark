import assert from "node:assert/strict";
import test from "node:test";
import { parseBrandCitations } from "./citations";

test("transforma uma fonte documentada em citação interna segura", () => {
  const result = parseBrandCitations(
    "Use preto. [Fonte: Guia de Cores — PRONTO · /docs/universo-visual/guia-de-cores]",
  );

  assert.equal(result.length, 2);
  assert.deepEqual(result[1], {
    type: "citation",
    raw: "[Fonte: Guia de Cores — PRONTO · /docs/universo-visual/guia-de-cores]",
    title: "Guia de Cores",
    status: "PRONTO",
    path: "/docs/universo-visual/guia-de-cores",
  });
});

test("preserva texto parcial durante o streaming", () => {
  const content = "Resposta [Fonte: Guia de Cores — PRONTO · /docs/universo";
  assert.deepEqual(parseBrandCitations(content), [{ type: "text", value: content }]);
});

test("tolera status e caminho invertidos pelo modelo", () => {
  const result = parseBrandCitations(
    "Gotham. [Fonte: structured:typography — /docs/universo-visual/tipografia · PRONTO]",
  );

  assert.deepEqual(result[1], {
    type: "citation",
    raw: "[Fonte: structured:typography — /docs/universo-visual/tipografia · PRONTO]",
    title: "Tipografia",
    status: "PRONTO",
    path: "/docs/universo-visual/tipografia",
  });
});

test("não cria link para URL externa ou formato não documentado", () => {
  const content = "[Fonte: Externa — PRONTO · https://example.com]";
  assert.deepEqual(parseBrandCitations(content), [{ type: "text", value: content }]);
});
