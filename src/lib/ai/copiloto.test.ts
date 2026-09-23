import assert from "node:assert/strict";
import test from "node:test";
import {
  consultaDoPrompt, ehTipoDePrompt, lerCabecalhoDeRegras, regrasDosTrechos, regrasPermitidas, resumoDasRegras, separarRegras, sistemaDoCopiloto,
} from "./copiloto";
import type { Trecho } from "./recuperacao";

/**
 * O copiloto de criação: só regra aprovada entra em silêncio (ADR-0004 §3.2).
 */
const trecho = (slug: string, status: string, pagina: number | null, content = `texto de ${slug}`): Trecho => ({
  documentSlug: slug, documentTitle: slug.toUpperCase(), groupName: "Manual", section: null,
  status, pageStart: pagina, pageEnd: pagina, content,
});

const TRECHOS = [
  trecho("cores", "ready", 12, "Preto VAIO #000000"),
  trecho("cores", "ready", 10, "Suporte #6E6E6E"),
  trecho("fotografia", "draft", 20),
  trecho("tom", "pending", 30),
];

test("os trechos viram uma regra por seção, com a primeira página", () => {
  const regras = regrasDosTrechos(TRECHOS);
  assert.equal(regras.length, 3);
  const cores = regras.find((r) => r.slug === "cores")!;
  assert.equal(cores.pagina, 10);
  assert.match(cores.conteudo, /#000000[\s\S]*#6E6E6E/);
});

test("aprovada é ready, e só ela; draft e pending são rascunho", () => {
  const { aprovadas, rascunhos } = separarRegras(regrasDosTrechos(TRECHOS));
  assert.deepEqual(aprovadas.map((r) => r.slug), ["cores"]);
  assert.deepEqual(rascunhos.map((r) => r.slug).sort(), ["fotografia", "tom"]);
});

test("rascunho só entra se a pessoa marcou — e não marcado nem chega ao modelo", () => {
  const regras = regrasDosTrechos(TRECHOS);
  assert.deepEqual(regrasPermitidas(regras, []).map((r) => r.slug), ["cores"]);
  assert.deepEqual(regrasPermitidas(regras, ["fotografia"]).map((r) => r.slug), ["cores", "fotografia"]);
});

test("o pedido do navegador não injeta regra: slug estranho ou lixo é ignorado", () => {
  const regras = regrasDosTrechos(TRECHOS);
  assert.deepEqual(regrasPermitidas(regras, ["regra-de-outra-marca", 42, null]).map((r) => r.slug), ["cores"]);
  assert.deepEqual(regrasPermitidas(regras, "fotografia").map((r) => r.slug), ["cores"]);
  // Marcar uma aprovada não a duplica.
  assert.deepEqual(regrasPermitidas(regras, ["cores"]).map((r) => r.slug), ["cores"]);
});

test("a lista do navegador não leva o conteúdo das regras", () => {
  const resumo = resumoDasRegras(regrasDosTrechos(TRECHOS));
  for (const r of resumo) assert.equal("conteudo" in r, false);
});

test("a busca junta a descrição e os termos do tipo de peça", () => {
  assert.match(consultaDoPrompt("foto de produto", "imagem"), /^foto de produto .*palette.*paleta/);
  assert.match(consultaDoPrompt("post", "texto"), /tone of voice/);
  assert.ok(consultaDoPrompt("x".repeat(900), "imagem").startsWith("x".repeat(500) + " "));
});

test("tipo de peça fora do vocabulário é recusado", () => {
  assert.equal(ehTipoDePrompt("imagem"), true);
  assert.equal(ehTipoDePrompt("audio"), false);
  assert.equal(ehTipoDePrompt(undefined), false);
});

test("o modelo recebe só as regras permitidas, com status e página", () => {
  const permitidas = regrasPermitidas(regrasDosTrechos(TRECHOS), ["fotografia"]);
  const sistema = sistemaDoCopiloto(permitidas, "imagem", "Sony Vaio");
  assert.match(sistema, /<rule title="CORES" status="ready" page="10">/);
  assert.match(sistema, /<rule title="FOTOGRAFIA" status="draft" page="20">/);
  assert.doesNotMatch(sistema, /TOM/, "rascunho não marcado chegou ao modelo");
  assert.match(sistema, /Write the prompt in English/);
  assert.match(sistemaDoCopiloto([], "texto", "X"), /same language as the person's description/);
  assert.match(sistemaDoCopiloto([], "imagem", "X"), /no brand rules were provided/);
});

test("o cabeçalho de regras vai e volta, e lixo vira lista vazia", () => {
  const lista = [{ slug: "cores", titulo: "Cores", status: "ready", pagina: 10 }];
  assert.deepEqual(lerCabecalhoDeRegras(encodeURIComponent(JSON.stringify(lista))), lista);
  assert.deepEqual(lerCabecalhoDeRegras(null), []);
  assert.deepEqual(lerCabecalhoDeRegras("%7Bquebrado"), []);
  assert.deepEqual(lerCabecalhoDeRegras(encodeURIComponent(JSON.stringify([{ slug: 1 }, "x"]))), []);
});
