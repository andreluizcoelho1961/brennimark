import assert from "node:assert/strict";
import test from "node:test";
import { PASSOS_DO_TOUR, jaFoiVisto, passoAnterior, posicaoDoBalao, proximoPasso } from "./passos-do-tour";

const JANELA = { largura: 1200, altura: 800 };
const BALAO = { largura: 320, altura: 180 };

test("todo passo tem título e texto nos dois idiomas, e os ids não se repetem", () => {
  const ids = new Set<string>();
  for (const p of PASSOS_DO_TOUR) {
    for (const lg of ["pt-BR", "en"] as const) {
      assert.ok(p.titulo[lg].length > 2, `${p.id} título ${lg}`);
      assert.ok(p.texto[lg].length > 20, `${p.id} texto ${lg}`);
    }
    assert.ok(!ids.has(p.id), p.id);
    ids.add(p.id);
  }
  assert.equal(PASSOS_DO_TOUR[0].id, "boas-vindas");
  assert.equal(PASSOS_DO_TOUR.at(-1)?.id, "fim");
});

test("o tour começa e termina sem alvo (centro); os do meio apontam para algo", () => {
  assert.equal(PASSOS_DO_TOUR[0].seletor, undefined);
  assert.equal(PASSOS_DO_TOUR.at(-1)?.seletor, undefined);
  for (const p of PASSOS_DO_TOUR.slice(1, -1)) assert.ok(p.seletor, p.id);
});

test("avançar chega ao fim; voltar nunca fica abaixo de zero", () => {
  assert.equal(proximoPasso(0, 5), 1);
  assert.equal(proximoPasso(3, 5), 4);
  assert.equal(proximoPasso(4, 5), "fim");
  assert.equal(passoAnterior(0), 0);
  assert.equal(passoAnterior(3), 2);
});

test("sem alvo, o balão vai ao centro", () => {
  const p = posicaoDoBalao(null, JANELA, BALAO);
  assert.equal(p.modo, "centro");
  assert.equal(p.esquerda, 440);
  assert.equal(p.topo, 310);
});

test("alvo no topo: o balão fica abaixo, centrado no alvo", () => {
  const p = posicaoDoBalao({ topo: 20, esquerda: 500, largura: 100, altura: 32 }, JANELA, BALAO);
  assert.equal(p.modo, "abaixo");
  assert.equal(p.topo, 20 + 32 + 12);
  assert.equal(p.esquerda, 500 + 50 - 160);
});

test("alvo embaixo (o botão do Vini): o balão sobe", () => {
  const p = posicaoDoBalao({ topo: 700, esquerda: 1100, largura: 80, altura: 60 }, JANELA, BALAO);
  assert.equal(p.modo, "acima");
  assert.equal(p.topo, 700 - 12 - 180);
});

test("o balão nunca sai da tela na horizontal", () => {
  const colado = posicaoDoBalao({ topo: 20, esquerda: 0, largura: 40, altura: 30 }, JANELA, BALAO);
  assert.equal(colado.esquerda, 12);
  const naPonta = posicaoDoBalao({ topo: 20, esquerda: 1180, largura: 40, altura: 30 }, JANELA, BALAO);
  assert.equal(naPonta.esquerda, JANELA.largura - BALAO.largura - 12);
});

test("alvo sem tamanho ou gigante: cai no centro, nunca some", () => {
  assert.equal(posicaoDoBalao({ topo: 0, esquerda: 0, largura: 0, altura: 0 }, JANELA, BALAO).modo, "centro");
  assert.equal(posicaoDoBalao({ topo: 0, esquerda: 0, largura: 1200, altura: 800 }, JANELA, BALAO).modo, "centro");
});

test("só o valor '1' conta como tour já visto", () => {
  assert.equal(jaFoiVisto("1"), true);
  for (const v of [null, "", "0", "true", "sim"]) assert.equal(jaFoiVisto(v), false, String(v));
});
