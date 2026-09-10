import assert from "node:assert/strict";
import test from "node:test";
import type { Secao } from "../import/secoes";
import {
  atribuirSlugs,
  coberturaPorPagina,
  montarManifesto,
  type GeometriaDaPagina,
} from "./manifesto-da-importacao";

const secao = (id: string, titulo: string, ranges: [number, number][]): Secao => ({
  id,
  titulo,
  metodo: "outline",
  confianca: 0.9,
  sourcePageRanges: ranges.map(([de, ate]) => ({ de, ate })),
  linhas: [],
});

const geo = (numero: number, extra: Partial<GeometriaDaPagina> = {}): GeometriaDaPagina => ({
  numero,
  larguraPt: 595,
  alturaPt: 842,
  rotacao: 0,
  caracteres: 100,
  ...extra,
});

// ─── O slug decidido uma vez ───────────────────────────────────────────────

/**
 * O defeito que este módulo existe para não deixar voltar: títulos repetidos
 * são comuns num manual, e o slug do relatório não aplicava o desempate. A
 * segunda "Aplicações" apontaria para o documento da primeira — página na
 * seção errada, em silêncio, com o número certo de páginas.
 */
test("títulos repetidos recebem slugs distintos, e o desempate é a ordem", () => {
  const slugs = atribuirSlugs([
    secao("a", "Aplicações", [[1, 2]]),
    secao("b", "Cores", [[3, 3]]),
    secao("c", "Aplicações", [[4, 5]]),
  ]);

  assert.equal(slugs.get("a"), "aplicacoes");
  assert.equal(slugs.get("c"), "aplicacoes-3");
  assert.equal(new Set(slugs.values()).size, 3, "nenhum slug repetido");
});

test("título que não produz slug cai no id da seção", () => {
  const slugs = atribuirSlugs([secao("secao-x", "———", [[1, 1]])]);
  assert.equal(slugs.get("secao-x"), "secao-x");
});

// ─── Cobertura por página ──────────────────────────────────────────────────

test("cada página do intervalo recebe o slug da seção", () => {
  const secoes = [secao("a", "Cores", [[1, 3]]), secao("b", "Tipografia", [[5, 6]])];
  const cobertura = coberturaPorPagina(secoes, atribuirSlugs(secoes));

  assert.deepEqual([...cobertura.entries()].sort(), [
    [1, "cores"], [2, "cores"], [3, "cores"], [5, "tipografia"], [6, "tipografia"],
  ]);
  assert.equal(cobertura.has(4), false, "página fora de qualquer seção não é coberta");
});

/**
 * Intervalos descontínuos são a razão de `sourcePageRanges` ser uma lista e
 * não um par: "1–5 e 9" é o que sobra depois de alguém mover uma página.
 */
test("uma seção descontínua cobre todas as suas faixas", () => {
  const secoes = [secao("a", "Cores", [[1, 2], [9, 9]])];
  const cobertura = coberturaPorPagina(secoes, atribuirSlugs(secoes));
  assert.deepEqual([...cobertura.keys()].sort((x, y) => x - y), [1, 2, 9]);
});

test("em sobreposição, a primeira seção vence — a ordem da prévia decide", () => {
  const secoes = [secao("a", "Cores", [[1, 3]]), secao("b", "Tipografia", [[3, 4]])];
  const cobertura = coberturaPorPagina(secoes, atribuirSlugs(secoes));
  assert.equal(cobertura.get(3), "cores");
});

// ─── O manifesto completo ──────────────────────────────────────────────────

/**
 * A invariante central: 1..N, sempre. A RPC recusa qualquer outra coisa, e uma
 * página que nenhuma seção cobre é um FATO sobre o original — capa, folha em
 * branco, abertura só visual —, não um motivo para o manifesto ter furo.
 */
test("o manifesto cobre 1..N mesmo com páginas que nenhuma seção alcança", () => {
  const manifesto = montarManifesto({
    geometria: [geo(1), geo(2), geo(3), geo(4)],
    secoes: [secao("a", "Cores", [[2, 3]])],
    totalDePaginas: 4,
  });

  assert.deepEqual(manifesto.map((p) => p.pagina), [1, 2, 3, 4]);
  assert.deepEqual(manifesto.map((p) => p.secao_slug), [null, "cores", "cores", null]);
});

test("página sem texto extraível entra como visual, não como ausente", () => {
  const manifesto = montarManifesto({
    geometria: [geo(1, { caracteres: 0 }), geo(2)],
    secoes: [],
    totalDePaginas: 2,
  });

  assert.equal(manifesto[0].tem_texto, false);
  assert.equal(manifesto[0].caracteres, 0);
  assert.equal(manifesto[1].tem_texto, true);
  assert.equal(manifesto.length, 2, "a página só visual continua no manifesto");
});

test("a geometria e a rotação do original atravessam intactas", () => {
  const manifesto = montarManifesto({
    geometria: [geo(1, { larguraPt: 841.89, alturaPt: 595.28, rotacao: 90 })],
    secoes: [],
    totalDePaginas: 1,
  });

  assert.equal(manifesto[0].largura_pt, 841.89);
  assert.equal(manifesto[0].altura_pt, 595.28);
  assert.equal(manifesto[0].rotacao, 90);
});

/**
 * Zero em vez de um palpite: a conferência do registrador recusa o manifesto
 * como defeituoso, e isso é melhor que gravar A4 para uma página cujo tamanho
 * nunca foi medido. Geometria errada não se distingue de geometria certa
 * depois de gravada.
 */
test("página sem geometria lida entra com zero, e não com um palpite", () => {
  const manifesto = montarManifesto({
    geometria: [geo(1)],
    secoes: [],
    totalDePaginas: 2,
  });

  assert.equal(manifesto.length, 2);
  assert.equal(manifesto[1].largura_pt, 0);
  assert.equal(manifesto[1].altura_pt, 0);
});

/**
 * O manifesto e os documentos precisam concordar sobre o slug, porque é por
 * ele que o registrador liga página a seção. Este teste amarra os dois usos ao
 * mesmo `atribuirSlugs`.
 */
test("o slug do manifesto é o mesmo que nomeia o documento da seção", () => {
  const secoes = [
    secao("a", "Aplicações", [[1, 1]]),
    secao("b", "Aplicações", [[2, 2]]),
  ];
  const slugs = atribuirSlugs(secoes);
  const manifesto = montarManifesto({
    geometria: [geo(1), geo(2)],
    secoes,
    totalDePaginas: 2,
  });

  assert.equal(manifesto[0].secao_slug, slugs.get("a"));
  assert.equal(manifesto[1].secao_slug, slugs.get("b"));
  assert.notEqual(manifesto[0].secao_slug, manifesto[1].secao_slug);
});

test("mil páginas produzem mil linhas, sem furo", () => {
  const total = 1000;
  const manifesto = montarManifesto({
    geometria: Array.from({ length: total }, (_, i) => geo(i + 1)),
    secoes: [secao("a", "Manual", [[1, total]])],
    totalDePaginas: total,
  });

  assert.equal(manifesto.length, total);
  assert.equal(manifesto[0].pagina, 1);
  assert.equal(manifesto[total - 1].pagina, total);
  assert.equal(new Set(manifesto.map((p) => p.pagina)).size, total);
});
