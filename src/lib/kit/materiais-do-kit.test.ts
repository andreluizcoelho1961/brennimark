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

test("o símbolo vem do ícone; formato que o Kit não abre não entra", () => {
  const d = escolherDesenhos([
    v("logo", {}),
    v("icone-eps", { tipo: "icone", hierarquia: null, lockup: null, mime: "application/postscript", arquivo: "icone.eps" }),
    v("icone", { tipo: "icone", hierarquia: null, lockup: null }),
  ]);
  assert.equal(d.simbolo?.id, "icone");
  assert.equal(escolherDesenhos([v("logo", {})]).simbolo, null);
});

test("o .ai entra (10/10/2026): sozinho é o logotipo; entre iguais, SVG > PDF/AI > PNG", () => {
  const ai = v("ai", { arquivo: "Logo horizontal versão preferencial.ai", mime: "application/pdf" });
  const so = escolherDesenhos([ai]);
  assert.equal(so.logo?.id, "ai");
  assert.equal(so.semLogoPorque, null);
  assert.equal(escolherDesenhos([v("png", {}), ai]).logo?.id, "ai");
  assert.equal(escolherDesenhos([v("png", {}), ai, v("svg", { arquivo: "l.svg", mime: "image/svg+xml" })]).logo?.id, "svg");
});

test("o formato desempata, não manda: a principal em PNG vence a secundária em SVG", () => {
  const d = escolherDesenhos([
    v("svg-secundario", { hierarquia: "secundario", arquivo: "l.svg", mime: "image/svg+xml" }),
    v("png-principal", {}),
  ]);
  assert.equal(d.logo?.id, "png-principal");
});

test("só há logotipo em EPS: a tela diz o arquivo e o motivo, não 'não tem logotipo'", () => {
  const d = escolherDesenhos([v("eps", { arquivo: "logo.eps", mime: "application/postscript" })]);
  assert.equal(d.logo, null);
  assert.match(d.semLogoPorque ?? "", /logo\.eps/);
  assert.match(d.semLogoPorque ?? "", /EPS/);
  assert.equal(escolherDesenhos([]).semLogoPorque, null, "sem logo nenhum, a mensagem de sempre");
});
