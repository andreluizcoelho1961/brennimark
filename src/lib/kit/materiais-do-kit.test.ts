import assert from "node:assert/strict";
import test from "node:test";
import { escolherDesenhos, type VarianteDoKit } from "./materiais-do-kit";

const v = (id: string, extra: Partial<VarianteDoKit>): VarianteDoKit => ({
  id, itemId: "i", tipo: "logo", arquivo: `${id}.png`, mime: "image/png",
  hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espacoDeCor: "rgb", ...extra,
});

test("o logotipo: principal, horizontal, colorido, positivo, RGB e, entre iguais, SVG", () => {
  const d = escolherDesenhos([
    v("cmyk", { espacoDeCor: "cmyk" }),
    v("vertical", { lockup: "vertical" }),
    v("mono", { cor: "monocromatico" }),
    v("secundario", { hierarquia: "secundario" }),
    v("png-padrao", {}),
    v("svg-padrao", { mime: "image/svg+xml", arquivo: "logo.svg" }),
  ]);
  assert.equal(d.logo?.id, "svg-padrao");
});

test("o negativo é a melhor variante negativa; sem nenhuma, não há negativo", () => {
  assert.equal(escolherDesenhos([v("pos", {}), v("neg", { polaridade: "negativo" })]).negativo?.id, "neg");
  assert.equal(escolherDesenhos([v("pos", {})]).negativo, null);
  assert.equal(escolherDesenhos([v("neg", { polaridade: "negativo" })]).logo, null, "negativo não vira logotipo positivo");
});

test("o símbolo vem do ícone; arquivo que não é imagem não entra", () => {
  const d = escolherDesenhos([
    v("logo", {}),
    v("icone-pdf", { tipo: "icone", hierarquia: null, lockup: null, mime: "application/pdf", arquivo: "icone.pdf" }),
    v("icone", { tipo: "icone", hierarquia: null, lockup: null }),
  ]);
  assert.equal(d.simbolo?.id, "icone");
  assert.equal(escolherDesenhos([v("logo", {})]).simbolo, null);
});
