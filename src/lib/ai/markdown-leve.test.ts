import assert from "node:assert/strict";
import test from "node:test";
import { blocosDeMarkdown, enfases } from "./markdown-leve";

/**
 * O Markdown das respostas — o que o ensaio de 18/09 mostrou cru.
 *
 * O ponto de segurança (nada vira HTML) está na forma do resultado: dado, e
 * não marcação. Estes testes trancam a leitura.
 */

test("a resposta do ensaio vira título, lista e parágrafo", () => {
  const resposta = [
    "The brand guidelines do not define a single primary color.",
    "",
    "### Provisional Rules (DRAFT)",
    "",
    "* **Principle Colours:** VAIO black and VAIO support colour.",
    "* **Logo Colours:** white on VAIO black.",
    "",
    "*Interpretation: the documentation uses \"principle colours\".*",
  ].join("\n");

  assert.deepEqual(blocosDeMarkdown(resposta), [
    { tipo: "paragrafo", texto: "The brand guidelines do not define a single primary color." },
    { tipo: "titulo", nivel: 3, texto: "Provisional Rules (DRAFT)" },
    { tipo: "lista", ordenada: false, itens: [
      "**Principle Colours:** VAIO black and VAIO support colour.",
      "**Logo Colours:** white on VAIO black.",
    ] },
    { tipo: "paragrafo", texto: "*Interpretation: the documentation uses \"principle colours\".*" },
  ]);
});

test("lista numerada e lista com traço não se misturam", () => {
  assert.deepEqual(blocosDeMarkdown("1. um\n2. dois\n- solto"), [
    { tipo: "lista", ordenada: true, itens: ["um", "dois"] },
    { tipo: "lista", ordenada: false, itens: ["solto"] },
  ]);
});

test("linha recuada continua o item de cima", () => {
  assert.deepEqual(blocosDeMarkdown("- primeira parte\n  e o resto"), [
    { tipo: "lista", ordenada: false, itens: ["primeira parte e o resto"] },
  ]);
});

test("linhas seguidas formam um parágrafo, e a quebra fica", () => {
  assert.deepEqual(blocosDeMarkdown("linha um\nlinha dois"), [
    { tipo: "paragrafo", texto: "linha um\nlinha dois" },
  ]);
});

test("cerquilha sem espaço não é título: #0A0A0A é uma cor", () => {
  assert.deepEqual(blocosDeMarkdown("#0A0A0A é o preto"), [
    { tipo: "paragrafo", texto: "#0A0A0A é o preto" },
  ]);
});

test("HTML no texto continua texto — quem escapa é o React", () => {
  const blocos = blocosDeMarkdown("<img src=x onerror=alert(1)>");
  assert.deepEqual(blocos, [{ tipo: "paragrafo", texto: "<img src=x onerror=alert(1)>" }]);
});

test("negrito e itálico viram ênfase; o resto fica texto", () => {
  assert.deepEqual(enfases("**Cores:** preto e *suporte*."), [
    { tipo: "negrito", valor: "Cores:" },
    { tipo: "texto", valor: " preto e " },
    { tipo: "italico", valor: "suporte" },
    { tipo: "texto", valor: "." },
  ]);
});

test("marcador sem par não engole a frase", () => {
  assert.deepEqual(enfases("5 * 3 e um ** perdido"), [{ tipo: "texto", valor: "5 * 3 e um ** perdido" }]);
  assert.deepEqual(enfases("nome_de_arquivo_final.pdf"), [{ tipo: "texto", valor: "nome_de_arquivo_final.pdf" }]);
});
