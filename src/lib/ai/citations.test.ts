import assert from "node:assert/strict";
import test from "node:test";
import { parseBrandCitations } from "./citations";
import { resolveStatusLabels } from "../../components/docs/status";

const PADRAO = resolveStatusLabels({ language: "pt-BR" });

test("transforma uma fonte documentada em citação interna segura", () => {
  const result = parseBrandCitations(
    "Use preto. [Fonte: Guia de Cores — PRONTO · /docs/universo-visual/guia-de-cores]",
    PADRAO,
  );

  assert.equal(result.length, 2);
  assert.deepEqual(result[1], {
    type: "citation",
    raw: "[Fonte: Guia de Cores — PRONTO · /docs/universo-visual/guia-de-cores]",
    title: "Guia de Cores",
    status: "PRONTO",
    statusKey: "ready",
    path: "/docs/universo-visual/guia-de-cores",
  });
});

test("preserva texto parcial durante o streaming", () => {
  const content = "Resposta [Fonte: Guia de Cores — PRONTO · /docs/universo";
  assert.deepEqual(parseBrandCitations(content, PADRAO), [{ type: "text", value: content }]);
});

test("tolera status e caminho invertidos pelo modelo", () => {
  const result = parseBrandCitations(
    "Uma fonte. [Fonte: Tipografia — /docs/tipografia · PRONTO]",
    PADRAO,
  );

  // O título passa direto. Havia aqui uma tabela traduzindo ids técnicos como
  // `structured:typography` para "Tipografia", "Guia de Cores", "Símbolos e
  // Logotipos" — os nomes das seções do manual de UM cliente, embutidos no
  // núcleo. Aquelas fontes estruturadas não existem mais; o prompt manda o
  // modelo citar o TÍTULO da fonte, que já vem do manual de cada marca.
  assert.deepEqual(result[1], {
    type: "citation",
    raw: "[Fonte: Tipografia — /docs/tipografia · PRONTO]",
    title: "Tipografia",
    status: "PRONTO",
    statusKey: "ready",
    path: "/docs/tipografia",
  });
});

test("não cria link para URL externa ou formato não documentado", () => {
  const content = "[Fonte: Externa — PRONTO · https://example.com]";
  assert.deepEqual(parseBrandCitations(content, PADRAO), [{ type: "text", value: content }]);
});
