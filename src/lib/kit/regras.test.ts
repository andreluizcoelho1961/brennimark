import assert from "node:assert/strict";
import test from "node:test";
import type { Trecho } from "../ai/recuperacao";
import {
  chavesQueFaltam, deLinhaDaRegra, instrucoesDasRegras, lerRegrasDaIA, paginasDasRegras, regrasParaOKit, valorLegivel, type RegraDoLogo,
} from "./regras";

const trecho = (pageStart: number | null, content: string, extra: Partial<Trecho> = {}): Trecho => ({
  documentSlug: "m", documentTitle: "Manual", groupName: "", section: null, status: "ready", pageStart, pageEnd: pageStart, content, ...extra,
});

test("as páginas: as que quem edita ligou ao logotipo valem antes da busca", () => {
  const trechos = [trecho(12, "Área de proteção: x = altura do B")];
  assert.deepEqual(paginasDasRegras(trechos, [14, 12, 14]), [12, 14]);
});

test("as páginas: sem ligação, os trechos que citam os termos das regras (português e inglês)", () => {
  const trechos = [
    trecho(3, "A história da marca"),
    trecho(12, "Respeite a área de proteção em volta do logotipo."),
    trecho(13, "Redução mínima: 120 px"),
    trecho(20, "Clear space around the logo"),
    trecho(21, "área de proteção", { origem: "complemento" }),
    trecho(null, "tamanho mínimo"),
  ];
  assert.deepEqual(paginasDasRegras(trechos, []), [12, 13, 20]);
});

test("as páginas: no máximo quatro", () => {
  const trechos = [1, 2, 3, 4, 5, 6].map((p) => trecho(p, "área de proteção"));
  assert.equal(paginasDasRegras(trechos, []).length, 4);
});

test("a resposta da IA: lê as linhas boas e descarta as esquisitas", () => {
  const texto = [
    "Aqui estão as regras:",
    "area_de_protecao | 0,25 | x = altura do B | 12",
    "reducao_minima_logo | 120px | 120 px digital | 13",
    "reducao_minima_simbolo | 2 | pequeno demais | 13", // fora da faixa
    "area_de_protecao | 0.5 | repetida | 12", // a primeira vale
    "cor_principal | 1 | não é regra do Kit | 12", // chave desconhecida
    "reducao_minima_simbolo | 24 | 24 px | 99", // página não enviada
    "- reducao_minima_simbolo | 32 | 32 px | 13",
  ].join("\n");
  assert.deepEqual(lerRegrasDaIA(texto, [12, 13]), [
    { chave: "area_de_protecao", valor: 0.25, descricao: "x = altura do B", pagina: 12 },
    { chave: "reducao_minima_logo", valor: 120, descricao: "120 px digital", pagina: 13 },
    { chave: "reducao_minima_simbolo", valor: 32, descricao: "32 px", pagina: 13 },
  ]);
});

test("a resposta da IA: nada útil, nada lido", () => {
  assert.deepEqual(lerRegrasDaIA("Não encontrei regras nessas páginas.", [1]), []);
});

test("as instruções citam as páginas e proíbem converter milímetros", () => {
  const i = instrucoesDasRegras([12, 13]);
  assert.match(i, /12, 13/);
  assert.match(i, /NÃO converta/);
});

const regra = (chave: RegraDoLogo["chave"], valor: number): RegraDoLogo => ({ id: chave, chave, valor, descricao: "", pagina: 1, origem: "ia", status: "draft" });

test("as regras para o Kit e o que falta", () => {
  const regras = [regra("area_de_protecao", 0.25), regra("reducao_minima_simbolo", 24)];
  assert.deepEqual(regrasParaOKit(regras), { protecao: 0.25, reducao: { logo: null, simbolo: 24 } });
  assert.deepEqual(chavesQueFaltam(regras), ["reducao_minima_logo"]);
  assert.deepEqual(regrasParaOKit([]), { protecao: 0, reducao: { logo: null, simbolo: null } });
});

test("a linha do banco vira regra; chave desconhecida, não", () => {
  assert.deepEqual(deLinhaDaRegra({ id: "1", chave: "area_de_protecao", valor: "0.25", descricao: "x", pagina: 12, origem: "ia", status: "ready" }),
    { id: "1", chave: "area_de_protecao", valor: 0.25, descricao: "x", pagina: 12, origem: "ia", status: "ready" });
  assert.equal(deLinhaDaRegra({ chave: "outra" }), null);
});

test("o valor legível", () => {
  assert.equal(valorLegivel({ chave: "area_de_protecao", valor: 0.25 }), "25% da altura do logo");
  assert.equal(valorLegivel({ chave: "reducao_minima_logo", valor: 120 }), "120 px de largura");
});
