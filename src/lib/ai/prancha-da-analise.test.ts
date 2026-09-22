import assert from "node:assert/strict";
import test from "node:test";
import { itensDaPrancha, linhaDaFonte, nomeDaPrancha, quebrarTexto, separarCitacoes } from "./prancha-da-analise";
import type { StructuredAnalysis } from "./analysis-result";

const vazia: StructuredAnalysis = {
  verdict: "", evidence: [], rules: [], problems: [], impact: "", correction: "", confidence: "", sources: [], raw: "",
};

test("a citação sai do texto e vira fonte com página e status", () => {
  const r = separarCitacoes("O cluster está vermelho [Fonte: Cluster Colours — RASCUNHO · /docs/cluster].", { "/docs/cluster": 12 });
  assert.equal(r.texto, "O cluster está vermelho.");
  assert.deepEqual(r.fontes, [{ titulo: "Cluster Colours", status: "RASCUNHO", pagina: 12 }]);
});

test("citação na ordem inversa (caminho antes do status) também é lida", () => {
  const r = separarCitacoes("Logo [Source: Logo — /docs/logo · DRAFT]", {});
  assert.deepEqual(r.fontes, [{ titulo: "Logo", status: "DRAFT", pagina: null }]);
  assert.equal(r.texto, "Logo");
});

test("as correções são os problemas numerados, e a correção sugerida fecha a lista", () => {
  const itens = itensDaPrancha({
    ...vazia,
    problems: ["Cluster vermelho [Fonte: Cluster — PRONTO · /docs/cluster]", "  ", "Logo na vertical"],
    correction: "Refazer o cluster em azul.",
  }, { "/docs/cluster": 12 });
  assert.deepEqual(itens.map((i) => [i.numero, i.texto]), [
    [1, "Cluster vermelho"], [2, "Logo na vertical"], [3, "Refazer o cluster em azul."],
  ]);
  assert.equal(itens[0].fontes[0].pagina, 12);
});

test("análise sem problemas nem correção não inventa item", () => {
  assert.deepEqual(itensDaPrancha(vazia, {}), []);
});

test("a procedência diz página e status — rascunho sai escrito", () => {
  assert.equal(linhaDaFonte({ titulo: "Cluster Colours", status: "rascunho", pagina: 12 }), "Cluster Colours · p. 12 · RASCUNHO");
  assert.equal(linhaDaFonte({ titulo: "Logo", status: "", pagina: null }), "Logo");
});

test("o texto quebra na largura, e palavra enorme é cortada no caractere", () => {
  const medir = (s: string) => s.length; // 1 unidade por caractere
  assert.deepEqual(quebrarTexto("um dois tres quatro", 8, medir), ["um dois", "tres", "quatro"]);
  assert.deepEqual(quebrarTexto("abcdefghijk", 4, medir), ["abcd", "efgh", "ijk"]);
  for (const linha of quebrarTexto("texto com umapalavragigantesca no meio", 10, medir)) {
    assert.ok(linha.length <= 10, `linha vazou: ${linha}`);
  }
});

test("o nome do arquivo vem da peça, sem caracteres que quebram download", () => {
  assert.equal(nomeDaPrancha("Campanha Outono/2026.PNG"), "Campanha-Outono-2026-analise.png");
  assert.equal(nomeDaPrancha("cartaz.jpeg", true), "cartaz-review.png");
  assert.equal(nomeDaPrancha("///.png"), "peca-analise.png");
});
