import assert from "node:assert/strict";
import test from "node:test";
import { escolherDesenhos, nomeDaVariante, opcoesDoPapel, type VarianteDoKit } from "./materiais-do-kit";

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

test("o vertical (10/10/2026): o melhor logotipo vertical vira papel próprio; sem horizontal, o logotipo cuida dos dois", () => {
  const d = escolherDesenhos([v("h", {}), v("vert", { lockup: "vertical" }), v("vert-mono", { lockup: "vertical", cor: "monocromatico" })]);
  assert.equal(d.logo?.id, "h");
  assert.equal(d.vertical?.id, "vert");
  assert.equal(escolherDesenhos([v("h", {})]).vertical, null, "sem vertical, nada");
  const so = escolherDesenhos([v("vert", { lockup: "vertical" })]);
  assert.equal(so.logo?.id, "vert");
  assert.equal(so.vertical, null);
});

test("as opções de cada papel: da melhor para a pior; a que não abre vem por último, com o motivo", () => {
  const todas = [
    v("eps", { arquivo: "l.eps", mime: "application/postscript" }),
    v("vert", { lockup: "vertical" }),
    v("h", {}),
    v("neg", { polaridade: "negativo" }),
    v("ico", { tipo: "icone", hierarquia: null, lockup: null }),
  ];
  assert.deepEqual(opcoesDoPapel(todas, "logo").map((o) => o.variante.id), ["h", "vert", "eps"]);
  assert.deepEqual(opcoesDoPapel(todas, "vertical").map((o) => o.variante.id), ["vert"], "no papel vertical, só o vertical");
  assert.deepEqual(opcoesDoPapel(todas, "negativo").map((o) => o.variante.id), ["neg"]);
  assert.deepEqual(opcoesDoPapel(todas, "simbolo").map((o) => o.variante.id), ["ico"]);
  const eps = opcoesDoPapel(todas, "logo").at(-1)!;
  assert.equal(eps.abre, false);
  assert.match(eps.motivo ?? "", /EPS/);
});

test("o nome da versão: o rótulo dos Materiais, ou os atributos e o formato", () => {
  assert.equal(nomeDaVariante(v("a", { arquivo: "a.svg" })), "Horizontal · colorido · SVG");
  assert.equal(nomeDaVariante(v("a", { lockup: "vertical", cor: "monocromatico", polaridade: "negativo", arquivo: "a.ai" })), "Vertical · monocromático · negativo · AI");
  assert.equal(nomeDaVariante(v("a", { rotulo: "Versão preferencial", arquivo: "a.pdf" })), "Versão preferencial · PDF");
  assert.equal(nomeDaVariante(v("a", { tipo: "icone", hierarquia: null, lockup: null, cor: null, polaridade: null, arquivo: "a.png" })), "Símbolo · PNG");
});
