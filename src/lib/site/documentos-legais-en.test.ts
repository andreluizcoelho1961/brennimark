import assert from "node:assert/strict";
import test from "node:test";
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO } from "./documentos-legais";
import { PRIVACY_POLICY, TERMS_OF_USE } from "./documentos-legais-en";

/**
 * O texto em inglês é uma TRADUÇÃO do português (24/10/2026), para o advogado revisar.
 * Estes testes não julgam a qualidade do inglês — quem faz isso é o advogado —, só
 * travam o que uma tradução não pode deixar divergir em silêncio: a versão, a
 * estrutura, as marcações e, principalmente, todo prazo, valor e número de artigo.
 */
const PARES = [
  { nome: "Termos de uso", pt: TERMOS_DE_USO, en: TERMS_OF_USE },
  { nome: "Política de privacidade", pt: POLITICA_DE_PRIVACIDADE, en: PRIVACY_POLICY },
] as const;

/** Os números de um parágrafo, sem o separador de milhar ("13.709" e "13,709" são o mesmo número). */
function numeros(texto: string): string[] {
  return (texto.replace(/(\d)[.,](\d)/g, "$1$2").match(/\d+/g) ?? []).sort();
}

test("a tradução tem a mesma versão do texto em português: é o mesmo ato jurídico, em outra língua", () => {
  for (const { nome, pt, en } of PARES) {
    assert.equal(en.versao, pt.versao, nome);
    assert.deepEqual(numeros(en.vigenteDesde), numeros(pt.vigenteDesde), `${nome}: data de vigência`);
  }
});

test("mesma estrutura: seções numeradas, na mesma ordem, com as mesmas âncoras e os mesmos parágrafos", () => {
  for (const { nome, pt, en } of PARES) {
    assert.equal(en.secoes.length, pt.secoes.length, `${nome}: número de seções`);
    pt.secoes.forEach((secaoPt, i) => {
      const secaoEn = en.secoes[i];
      assert.ok(secaoEn.titulo.startsWith(`${i + 1}. `), `${nome}: "${secaoEn.titulo}" fora de ordem`);
      assert.equal(Boolean(secaoEn.id), Boolean(secaoPt.id), `${nome} §${i + 1}: âncora`);
      assert.equal(secaoEn.paragrafos.length, secaoPt.paragrafos.length, `${nome} §${i + 1}: número de parágrafos`);
    });
  }
});

test("as mesmas marcações em cada parágrafo: negrito, item de lista e link", () => {
  const marcas = (p: string) => ({ negrito: (p.match(/\*\*[^*]+\*\*/g) ?? []).length, lista: p.startsWith("- "), links: (p.match(/\[\[[^\]]+\]\]/g) ?? []).length });
  for (const { nome, pt, en } of PARES) {
    pt.secoes.forEach((secaoPt, i) => secaoPt.paragrafos.forEach((p, j) => {
      assert.deepEqual(marcas(en.secoes[i].paragrafos[j]), marcas(p), `${nome} §${i + 1} ¶${j + 1}`);
    }));
  }
});

test("todo prazo, valor e número de artigo é o mesmo nos dois idiomas, parágrafo a parágrafo", () => {
  for (const { nome, pt, en } of PARES) {
    pt.secoes.forEach((secaoPt, i) => secaoPt.paragrafos.forEach((p, j) => {
      assert.deepEqual(numeros(en.secoes[i].paragrafos[j]), numeros(p), `${nome} §${i + 1} ¶${j + 1}\nPT: ${p.slice(0, 90)}\nEN: ${en.secoes[i].paragrafos[j].slice(0, 90)}`);
    }));
  }
});

test("o inglês não deixa português solto: só os termos jurídicos brasileiros, de propósito, entre parênteses", () => {
  const PERMITIDOS = [
    "Código de Defesa do Consumidor", "Lei Geral de Proteção de Dados", "direito de arrependimento", "Marco Civil da Internet",
    "nota fiscal de serviço", "lucros cessantes", "culpa grave", "encarregado", "comarca", "foro", "dolo", "São Paulo",
  ];
  for (const { nome, en } of PARES) {
    let texto = [en.vigenteDesde, ...en.secoes.flatMap((s) => [s.titulo, ...s.paragrafos])].join("\n");
    for (const termo of PERMITIDOS) texto = texto.split(termo).join("");
    const sobras = texto.split("\n").filter((l) => /[áàâãéêíóôõúüç]/i.test(l));
    assert.deepEqual(sobras, [], `${nome}: português no meio do inglês`);
  }
});

test("os termos definidos ficam constantes: Subscriber, Account e Invited Users, e 'assinante' não aparece", () => {
  const termos = TERMS_OF_USE.secoes.flatMap((s) => s.paragrafos).join(" ");
  assert.match(termos, /"Subscriber" means/);
  assert.match(termos, /"Account" means/);
  assert.match(termos, /"Invited Users" are/);
  for (const doc of [TERMS_OF_USE, PRIVACY_POLICY]) {
    const texto = doc.secoes.flatMap((s) => s.paragrafos).join(" ");
    assert.doesNotMatch(texto, /\bassinante\b|\bconta\b|\bpessoas convidadas\b/i);
    // O termo definido nunca vira sinônimo: o assinante é "Subscriber", não "customer" nem "user account".
    assert.doesNotMatch(texto, /\bcustomers?\b|\buser accounts?\b|\bend users?\b/i);
  }
});

test("os links entre os documentos apontam para âncoras que existem na versão em inglês", () => {
  const todos = [TERMS_OF_USE, PRIVACY_POLICY].flatMap((d) => d.secoes.flatMap((s) => s.paragrafos)).join(" ");
  const links = [...todos.matchAll(/\[\[termos#([a-z-]+)\|/g)].map((m) => m[1]);
  assert.ok(links.length > 0);
  for (const ancora of links) assert.ok(TERMS_OF_USE.secoes.some((s) => s.id === ancora), ancora);
});

test("o inglês diz as mesmas regras de cobrança, atraso e arrependimento do português", () => {
  const texto = TERMS_OF_USE.secoes.flatMap((s) => s.paragrafos).join(" ");
  assert.match(texto, /keeps working normally for 7 days/);
  assert.match(texto, /read-only/);
  assert.match(texto, /Nothing is deleted because of late payment/);
  assert.match(texto, /paid by credit card through Stripe/);
  assert.doesNotMatch(texto, /\bPix\b/);
  assert.match(texto, /within 7 days of the first purchase receives a full refund of the amount paid/);
  assert.match(texto, /duplicate charge, a charge after cancellation or a charge caused by our fault is refunded in full/);
});

test("o inglês também não promete o que o produto não faz, e diz o que a Política diz", () => {
  const texto = PRIVACY_POLICY.secoes.flatMap((s) => s.paragrafos).join(" ");
  assert.match(texto, /We do not store the card number/);
  assert.match(texto, /Each conversation belongs to whoever had it/);
  assert.match(texto, /we do not receive your fonts, font names, file paths or library data/);
  assert.match(texto, /bm_cadastro/);
  assert.match(texto, /Resend/);
  assert.match(texto, /Brazilian General Data Protection Law/);
  assert.match(texto, /Brazilian Civil Rights Framework for the Internet/);
  assert.doesNotMatch(texto, /advertising cookies(?! or tracking)/);
});

test("o inglês identifica a empresa só pelo CNPJ e pelo e-mail, sem CPF, nome do titular nem endereço", () => {
  const texto = [TERMS_OF_USE, PRIVACY_POLICY].flatMap((d) => d.secoes.flatMap((s) => s.paragrafos)).join(" ");
  assert.match(texto, /CNPJ \(Brazilian corporate taxpayer number\) 47\.924\.458\/0001-09/);
  assert.doesNotMatch(texto, /\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)(?<!0001-\d{2})/);
  assert.doesNotMatch(texto, /Vicente da Fontoura|90460-019|Ferreira Coelho/);
  assert.match(texto, /contato@brennimark\.com/);
  assert.match(texto, /privacidade@brennimark\.com/);
  assert.doesNotMatch(texto, /\[e-?mail|\[a confirmar/);
});
