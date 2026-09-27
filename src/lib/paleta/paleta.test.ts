import assert from "node:assert/strict";
import test from "node:test";
import { lerCorEscrita, normalizarHex, ordenarPaleta, trechosDaFicha, ehFichaDaPaleta, type CorDaPaleta } from "./paleta";
import { buildChatSystemPrompt, type BrandPromptContext } from "../ai/brand-context";
import { LIMITES_DE_IA, type Trecho } from "../ai/recuperacao";

function cor(parcial: Partial<CorDaPaleta>): CorDaPaleta {
  return {
    id: parcial.nome ?? "id", nome: "Cor", papel: "apoio", segmento: "", hex: "#CC092F", rgb: null, cmyk: null, pms: null,
    pagina: null, ordem: 0, status: "ready", aprovadoEm: "2026-09-27T12:00:00Z", origem: "pessoa", ...parcial,
  };
}

test("HEX colado de qualquer jeito vira a forma do banco", () => {
  assert.equal(normalizarHex("cc092f"), "#CC092F");
  assert.equal(normalizarHex("#CC092F"), "#CC092F");
  assert.equal(normalizarHex(" # cc 09 2f "), "#CC092F");
  assert.equal(normalizarHex("#c02"), "#CC0022");
  assert.equal(normalizarHex("#GG092F"), null);
  assert.equal(normalizarHex("#CC09"), null);
  assert.equal(normalizarHex(42), null);
});

test("a cor escrita passa pelas mesmas regras do banco, com motivo legível", () => {
  const base = { nome: "Vermelho Bradesco", papel: "principal", hex: "cc092f" };
  const lida = lerCorEscrita({ ...base, pms: " 186  C ", pagina: "22" }, 47);
  assert.ok(lida.ok);
  assert.equal(lida.cor.hex, "#CC092F");
  assert.equal(lida.cor.pms, "186 C");
  assert.equal(lida.cor.pagina, 22);

  assert.deepEqual(lerCorEscrita({ ...base, nome: "  " }), { ok: false, motivo: "nome" });
  assert.deepEqual(lerCorEscrita({ ...base, nome: "x".repeat(81) }), { ok: false, motivo: "nome" });
  assert.deepEqual(lerCorEscrita({ ...base, papel: "terciaria" }), { ok: false, motivo: "papel" });
  assert.deepEqual(lerCorEscrita({ ...base, hex: "vermelho" }), { ok: false, motivo: "hex" });
  assert.deepEqual(lerCorEscrita({ nome: "Sem código", papel: "apoio" }), { ok: false, motivo: "sem-codigo" });
  assert.deepEqual(lerCorEscrita({ ...base, cmyk: "x".repeat(41) }), { ok: false, motivo: "codigo-longo" });
  assert.deepEqual(lerCorEscrita({ ...base, pagina: 0 }), { ok: false, motivo: "pagina" });
  assert.deepEqual(lerCorEscrita({ ...base, pagina: 2.5 }), { ok: false, motivo: "pagina" });
  // A página tem de existir no manual atual.
  assert.deepEqual(lerCorEscrita({ ...base, pagina: 48 }, 47), { ok: false, motivo: "pagina" });
  // Só PMS, sem HEX, é ficha válida: há manual que só dá o Pantone.
  assert.ok(lerCorEscrita({ nome: "Só Pantone", papel: "apoio", pms: "286 C" }).ok);
});

test("a ordem da ficha: principais primeiro, depois a ordem escolhida", () => {
  const ordenadas = ordenarPaleta([
    cor({ nome: "B", papel: "apoio", ordem: 1 }),
    cor({ nome: "A", papel: "apoio", ordem: 2 }),
    cor({ nome: "Z", papel: "principal", ordem: 9 }),
  ]);
  assert.deepEqual(ordenadas.map((c) => c.nome), ["Z", "B", "A"]);
});

test("a ficha vai ao Vini em duas fontes, aprovada e rascunho, com a contagem pronta", () => {
  const cores = [
    cor({ nome: "Vermelho", papel: "principal", pagina: 21 }),
    cor({ nome: "Branco", papel: "principal", hex: "#FFFFFF", pagina: 21 }),
    cor({ nome: "Azul", pagina: 22, cmyk: "100 60 0 20" }),
    cor({ nome: "Cinza novo", status: "draft", aprovadoEm: null, pagina: 22 }),
  ];
  const [aprovada, rascunho] = trechosDaFicha(cores, false);

  assert.equal(aprovada.status, "ready");
  assert.equal(aprovada.documentTitle, "Ficha da paleta (aprovada)");
  assert.equal(aprovada.pageStart, 21);
  assert.equal(aprovada.pageEnd, 22);
  assert.match(aprovada.content, /^3 cor\(es\): 2 principal\(is\), 1 de apoio\./);
  assert.match(aprovada.content, /- Azul \(apoio\) — HEX #CC092F · CMYK 100 60 0 20 · p\. 22/);
  assert.doesNotMatch(aprovada.content, /Cinza novo/);

  // O rascunho nunca vai misturado ao aprovado: o status é da fonte.
  assert.equal(rascunho.status, "draft");
  assert.match(rascunho.content, /^1 cor\(es\)/);
  assert.match(rascunho.content, /Cinza novo/);

  assert.ok(ehFichaDaPaleta(aprovada) && ehFichaDaPaleta(rascunho));
  assert.deepEqual(trechosDaFicha([], false), []);
  assert.equal(trechosDaFicha([cor({ status: "draft", aprovadoEm: null })], false).length, 1);
});

test("no prompt, a ficha vai inteira e com a regra; sem ficha, nem a regra", () => {
  const brand: BrandPromptContext = { language: "pt", chatRole: "Você é o Vini.", analysisRole: "", statusLabels: undefined };
  const cheio: Trecho = {
    documentSlug: "cores", documentTitle: "Cores", groupName: "g", section: null, status: "ready",
    pageStart: 21, pageEnd: 22, content: "x".repeat(LIMITES_DE_IA.maxCaracteresPorTrecho),
  };
  // A busca no teto: a ficha não pode perder lugar nem ser cortada por ela.
  const trechos = Array(LIMITES_DE_IA.maxTrechos).fill(cheio);
  const muitas = Array.from({ length: 30 }, (_, i) => cor({ nome: `Tom ${i + 1}`, pms: `PMS ${i + 100} C` }));
  const ficha = trechosDaFicha(muitas, false);
  assert.ok(ficha[0].content.length > LIMITES_DE_IA.maxCaracteresPorTrecho / 2);

  const comFicha = buildChatSystemPrompt(trechos, brand, "quantas cores?", "trechos", ficha);
  assert.match(comFicha, /Tom 30 \(apoio\)/);
  assert.match(comFicha, /30 cor\(es\)/);
  assert.match(comFicha, /responda pela ficha/);
  const semFicha = buildChatSystemPrompt(trechos, brand, "quantas cores?", "trechos");
  assert.doesNotMatch(semFicha, /Ficha da paleta/);
  // A ficha não tira lugar de trecho nenhum da busca.
  const contar = (prompt: string) => prompt.split('<source id="doc:cores"').length - 1;
  assert.ok(contar(semFicha) > 0);
  assert.equal(contar(comFicha), contar(semFicha));

  // Só a ficha, sem trecho da busca: não diz "nenhum trecho correspondeu".
  const soFicha = buildChatSystemPrompt([], brand, "quantas cores?", "trechos", ficha);
  assert.doesNotMatch(soFicha, /Nenhum trecho do manual/);
  assert.match(soFicha, /Tom 1 \(apoio\)/);
});
