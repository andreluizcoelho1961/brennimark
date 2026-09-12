import assert from "node:assert/strict";
import test from "node:test";
import {
  ehTituloGenerico, indiceDasSecoes, indiceDosMarcadores, montarIndice,
} from "./indice";

/**
 * Os casos vieram de manuais REAIS, medidos em 12/09/2026 (30 manuais do acervo
 * do André). Não são hipóteses: cada um reproduz um defeito observado.
 */

test("Shell: 4 marcadores chamados SECTION 1 e 2 não viram índice", () => {
  const shell = [
    { titulo: "SECTION 1", pagina: 3, nivel: 1 },
    { titulo: "SECTION 2", pagina: 9, nivel: 1 },
    { titulo: "SECTION 3", pagina: 18, nivel: 1 },
    { titulo: "SECTION 4", pagina: 27, nivel: 1 },
  ];
  assert.equal(indiceDosMarcadores(shell), null, "índice genérico deveria ser recusado");
});

test("Natura: topo genérico cai, e os filhos com nome sobrevivem", () => {
  const natura = [
    { titulo: "Seção Padrão", pagina: 1, nivel: 1 },
    { titulo: "Nossa marca", pagina: 4, nivel: 2 },
    { titulo: "Cores institucionais", pagina: 12, nivel: 2 },
    { titulo: "Tipografia", pagina: 20, nivel: 2 },
  ];
  const itens = indiceDosMarcadores(natura);
  assert.ok(itens, "deveria aproveitar os filhos");
  assert.deepEqual(itens.map((i) => i.titulo), ["Nossa marca", "Cores institucionais", "Tipografia"]);
});

test("GE: destino que não resolve é descartado, e a árvore profunda vira 2 níveis", () => {
  const ge = [
    { titulo: "GE Identity Program", pagina: 1, nivel: 1 },
    { titulo: "Logotipo", pagina: 12, nivel: 2 },
    { titulo: "Monograma em fundo escuro", pagina: 14, nivel: 3 },
    { titulo: "Assinatura conjunta", pagina: 30, nivel: 4 },
    { titulo: "Referência sem destino", pagina: null, nivel: 2 },
    { titulo: "Cores", pagina: 48, nivel: 1 },
    { titulo: "Tipografia", pagina: 96, nivel: 2 },
  ];
  const itens = indiceDosMarcadores(ge);
  assert.ok(itens);
  assert.deepEqual(
    itens.map((i) => i.titulo),
    ["GE Identity Program", "Logotipo", "Cores", "Tipografia"],
    "níveis 3 e 4 e o destino quebrado deveriam ter saído",
  );
  assert.ok(itens.every((i) => i.nivel <= 2));
});

test("Apple: um índice bom passa inteiro", () => {
  const apple = [
    { titulo: "Apple Requirements", pagina: 2, nivel: 1 },
    { titulo: "Apple Channel Signatures", pagina: 9, nivel: 1 },
    { titulo: "Using Apple Assets", pagina: 18, nivel: 1 },
    { titulo: "Websites", pagina: 26, nivel: 2 },
  ];
  assert.equal(indiceDosMarcadores(apple)?.length, 4);
});

test("títulos genéricos, um a um", () => {
  for (const t of ["SECTION 1", "Seção Padrão", "Páginas 9–16", "Página 12", "Page 4", "Capítulo 3", "12", "Sumário", "Contents", " "]) {
    assert.equal(ehTituloGenerico(t), true, `deveria ser genérico: ${t}`);
  }
  for (const t of ["Cores", "Usos incorretos", "Logotipo", "Área de respiro", "1. Diretrizes institucionais"]) {
    assert.equal(ehTituloGenerico(t), false, `NÃO deveria ser genérico: ${t}`);
  }
});

test("plano B: as seções extraídas entram, menos as que se chamam Páginas N–M", () => {
  const secoes = [
    { titulo: "Cores", pagina: 4 },
    { titulo: "Páginas 9–16", pagina: 9 },
    { titulo: "Tipografia", pagina: 17 },
    { titulo: "Grid", pagina: 22 },
  ];
  assert.deepEqual(indiceDasSecoes(secoes).map((i) => i.titulo), ["Cores", "Tipografia", "Grid"]);
});

test("a decisão diz de onde veio o índice", () => {
  const bons = [
    { titulo: "Cores", pagina: 2, nivel: 1 },
    { titulo: "Tipografia", pagina: 8, nivel: 1 },
    { titulo: "Grid", pagina: 14, nivel: 1 },
  ];
  const secoes = [
    { titulo: "Cores", pagina: 2 },
    { titulo: "Tipografia", pagina: 8 },
    { titulo: "Grid", pagina: 14 },
  ];
  assert.equal(montarIndice(bons, secoes).fonte, "marcadores");
  assert.equal(montarIndice([], secoes).fonte, "secoes");
  assert.equal(montarIndice([], []).fonte, "nenhuma");
  // Marcador ruim NÃO impede o plano B: é o caso da Shell com seções extraídas.
  const shell = [{ titulo: "SECTION 1", pagina: 3, nivel: 1 }];
  assert.equal(montarIndice(shell, secoes).fonte, "secoes");
});
