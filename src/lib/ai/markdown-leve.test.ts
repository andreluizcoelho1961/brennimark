import assert from "node:assert/strict";
import test from "node:test";
import { blocosDeMarkdown, enfases, envolvidoEmEnfase, semMatematica } from "./markdown-leve";

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

test("negrito dentro de itálico não deixa asterisco cru (ensaio de 25/09/2026)", () => {
  assert.deepEqual(
    enfases("*Nota: consta num documento com status de **RASCUNHO**, orientação provisória.*"),
    [{ tipo: "italico", valor: "Nota: consta num documento com status de RASCUNHO, orientação provisória." }],
  );
});

test("--- vira separador, e não texto cru (ensaio de 26/09/2026)", () => {
  assert.deepEqual(blocosDeMarkdown("Cores principais\n\n---\n\n2. Tons de apoio"), [
    { tipo: "paragrafo", texto: "Cores principais" },
    { tipo: "separador" },
    { tipo: "lista", ordenada: true, itens: ["Tons de apoio"] },
  ]);
  assert.deepEqual(blocosDeMarkdown("* * *"), [{ tipo: "separador" }]);
  assert.deepEqual(blocosDeMarkdown("___"), [{ tipo: "separador" }]);
});

test("dois traços não são separador: continuam texto", () => {
  assert.deepEqual(blocosDeMarkdown("--"), [{ tipo: "paragrafo", texto: "--" }]);
});

test("LaTeX simples sai sem os cifrões — foi o que o Vini escreveu em 23/10/2026", () => {
  assert.equal(semMatematica("a medida $x$ é igual à altura da letra B"), "a medida x é igual à altura da letra B");
  assert.equal(semMatematica("um terço ($1/3$) da altura"), "um terço (1/3) da altura");
  assert.equal(semMatematica("$\\frac{1}{3}$ da altura e $2 \\times x$ de margem"), "1/3 da altura e 2 × x de margem");
  assert.equal(semMatematica("proporção de $25\\%$ da largura"), "proporção de 25% da largura");
  assert.equal(semMatematica("$\\text{altura do B}$"), "altura do B");
});

test("preço e outros cifrões não viram fórmula", () => {
  for (const texto of ["custa R$ 5,00 e US$ 10 por mês", "de R$5 a R$10", "só US$5", "um $ solto", "5$ e 6$"]) {
    assert.equal(semMatematica(texto), texto);
  }
});

test("a resposta formatada não mostra o cifrão da fórmula", () => {
  const blocos = blocosDeMarkdown("* A medida $x$ vale um terço ($1/3$).");
  assert.deepEqual(blocos, [{ tipo: "lista", ordenada: false, itens: ["A medida x vale um terço (1/3)."] }]);
});

test("itálico e negrito que envolvem o parágrafo inteiro são reconhecidos — mesmo atravessando uma citação", () => {
  const nota = "*Nota: o manual não traz essa diretriz [Fonte: O logotipo nas peças — PRONTO · /docs/o-logotipo-nas-pecas], mas ela vem de um complemento.*";
  assert.deepEqual(envolvidoEmEnfase(nota), {
    tipo: "italico",
    dentro: "Nota: o manual não traz essa diretriz [Fonte: O logotipo nas peças — PRONTO · /docs/o-logotipo-nas-pecas], mas ela vem de um complemento.",
  });
  assert.deepEqual(envolvidoEmEnfase("**Atenção: veja [Fonte: A — PRONTO · /docs/a] antes.**"), { tipo: "negrito", dentro: "Atenção: veja [Fonte: A — PRONTO · /docs/a] antes." });
  // O que NÃO é parágrafo envolvido: duas ênfases separadas, multiplicação, texto comum.
  assert.equal(envolvidoEmEnfase("*um* e *dois*"), null);
  assert.equal(envolvidoEmEnfase("**um** e **dois**"), null);
  assert.equal(envolvidoEmEnfase("5 * 3 * 2"), null);
  assert.equal(envolvidoEmEnfase("texto comum"), null);
  assert.equal(envolvidoEmEnfase("*aberto sem fechar"), null);
});
