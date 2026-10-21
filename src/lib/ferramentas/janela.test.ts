import assert from "node:assert/strict";
import test from "node:test";
import {
  ajustarATela, enderecoDaJanela, enderecoNormal, ehFerramentaEmJanela, geometriaInicial, lerGeometria, mudouGeometria,
  nomeDaJanela, recursosDaJanela, TAMANHO_MINIMO,
} from "./janela";

const TELA = { largura: 1920, altura: 1080 };

test("só as três ferramentas gratuitas abrem em janela", () => {
  for (const f of ["kit", "cores", "grids"]) assert.equal(ehFerramentaEmJanela(f), true);
  for (const ruim of ["fonts", "KIT", "", "../grids", null, undefined, 3]) assert.equal(ehFerramentaEmJanela(ruim), false);
});

test("os endereços e o nome da janela (o mesmo nome reaproveita a janela aberta)", () => {
  assert.equal(enderecoNormal("grids"), "/ferramentas/grids");
  assert.equal(enderecoDaJanela("grids"), "/ferramentas/janela/grids");
  assert.equal(nomeDaJanela("cores"), "bm-janela-cores");
  assert.notEqual(nomeDaJanela("kit"), nomeDaJanela("cores"), "cada ferramenta tem a sua janela");
});

test("a primeira abertura: tamanho padrão, no meio da tela", () => {
  const g = geometriaInicial("grids", TELA);
  assert.equal(g.largura, 1180);
  assert.equal(g.esquerda, Math.round((1920 - 1180) / 2));
  assert.equal(g.topo, Math.round((1080 - 800) / 2));
});

test("numa tela pequena a janela inicial cabe", () => {
  const g = geometriaInicial("grids", { largura: 1000, altura: 700 });
  assert.ok(g.largura <= 1000 && g.altura <= 700);
  assert.ok(g.largura >= TAMANHO_MINIMO.largura && g.altura >= TAMANHO_MINIMO.altura);
});

test("a geometria lembrada: só vale se tiver a forma certa", () => {
  assert.deepEqual(lerGeometria('{"largura":900,"altura":700,"esquerda":10,"topo":20}'), { largura: 900, altura: 700, esquerda: 10, topo: 20 });
  for (const ruim of [null, undefined, "", "x", "[]", "{}", '{"largura":"900"}', '{"largura":900,"altura":700,"esquerda":10}', '{"largura":null,"altura":1,"esquerda":1,"topo":1}']) {
    assert.equal(lerGeometria(ruim), null, String(ruim));
  }
});

test("ajustar à tela de hoje: tamanho entre o mínimo e a tela", () => {
  const g = ajustarATela({ largura: 100, altura: 100, esquerda: 50, topo: 50 }, TELA);
  assert.equal(g.largura, TAMANHO_MINIMO.largura);
  assert.equal(g.altura, TAMANHO_MINIMO.altura);
  const grande = ajustarATela({ largura: 9000, altura: 9000, esquerda: 0, topo: 0 }, TELA);
  assert.equal(grande.largura, 1920);
  assert.equal(grande.altura, 1080);
});

test("o monitor de ontem não está ligado: a janela volta para uma tela que existe", () => {
  // A janela estava num segundo monitor à direita (x = 3000) e ele sumiu.
  const g = ajustarATela({ largura: 900, altura: 700, esquerda: 3000, topo: 200 }, TELA);
  assert.ok(g.esquerda <= 1920 - 120, "pelo menos uma parte da janela dentro da tela");
  // E à esquerda, muito além da borda.
  const e = ajustarATela({ largura: 900, altura: 700, esquerda: -5000, topo: 200 }, TELA);
  assert.ok(e.esquerda + e.largura >= 120, "a borda direita da janela ainda aparece");
  const abaixo = ajustarATela({ largura: 900, altura: 700, esquerda: 100, topo: 5000 }, TELA);
  assert.ok(abaixo.topo <= 1080 - 120);
  const acima = ajustarATela({ largura: 900, altura: 700, esquerda: 100, topo: -400 }, TELA);
  assert.ok(acima.topo >= 0, "a barra de título nunca fica acima da tela");
});

test("uma janela que já está na tela não se mexe", () => {
  const g = { largura: 900, altura: 700, esquerda: 300, topo: 100 };
  assert.deepEqual(ajustarATela(g, TELA), g);
});

test("os recursos do window.open pedem a janela enxuta", () => {
  assert.equal(recursosDaJanela({ largura: 900, altura: 700, esquerda: 10, topo: 20 }), "popup=yes,width=900,height=700,left=10,top=20");
});

test("só vale gravar quando a janela mudou de verdade", () => {
  const a = { largura: 900, altura: 700, esquerda: 10, topo: 20 };
  assert.equal(mudouGeometria(null, a), true);
  assert.equal(mudouGeometria(a, { ...a, esquerda: 11 }), false, "1 px não conta");
  assert.equal(mudouGeometria(a, { ...a, largura: 950 }), true);
});
