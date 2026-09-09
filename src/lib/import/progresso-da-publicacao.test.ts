import assert from "node:assert/strict";
import test from "node:test";
import { rotuloDoProgresso } from "./progresso-da-publicacao";

const pt = (p: string) => p;
const en = (_: string, e: string) => e;

test("sem progresso, o rótulo genérico — que é o estado que este módulo existe para encurtar", () => {
  assert.equal(rotuloDoProgresso(null, pt), "Publicando…");
});

test("a contagem diz a etapa E os números, porque é isso que dá para conferir na tela", () => {
  assert.equal(
    rotuloDoProgresso({ etapa: "renderizando", feito: 7, total: 25 }, pt),
    "Renderizando página 7 de 25…",
  );
  assert.equal(
    rotuloDoProgresso({ etapa: "enviando", feito: 3, total: 25 }, pt),
    "Enviando imagem 3 de 25…",
  );
});

test("gravar não tem contagem — e não inventa uma", () => {
  // A RPC é uma chamada só. Fabricar "1 de 1" daria a impressão de uma fila
  // que não existe.
  assert.equal(rotuloDoProgresso({ etapa: "gravando", feito: 0, total: 0 }, pt), "Gravando a marca…");
});

test("total zero volta ao genérico em vez de anunciar '0 de 0'", () => {
  // Um manual sem nenhuma página visual passa por aqui. "0 de 0" sugeriria
  // trabalho que não existe, o que é pior que não dizer nada.
  assert.equal(rotuloDoProgresso({ etapa: "renderizando", feito: 0, total: 0 }, pt), "Publicando…");
  assert.equal(rotuloDoProgresso({ etapa: "enviando", feito: 0, total: -1 }, pt), "Publicando…");
});

test("o rótulo atravessa o idioma da interface", () => {
  assert.equal(
    rotuloDoProgresso({ etapa: "renderizando", feito: 2, total: 9 }, en),
    "Rendering page 2 of 9…",
  );
  assert.equal(rotuloDoProgresso({ etapa: "gravando", feito: 0, total: 0 }, en), "Saving the brand…");
});
