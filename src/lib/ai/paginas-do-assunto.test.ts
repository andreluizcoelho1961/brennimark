import assert from "node:assert/strict";
import test from "node:test";
import type { Trecho } from "./recuperacao";
import { paginasDoAssunto } from "./paginas-do-assunto";
import { paginasDaTipografia } from "../tipografia/tipografia";
import { paginasDoGrid } from "../grids/regras";

const trecho = (pagina: number, content: string, extra: Partial<Trecho> = {}): Trecho => ({
  documentSlug: "s", documentTitle: "t", groupName: "g", section: null, status: "ready", pageStart: pagina, pageEnd: pagina, content, ...extra,
} as Trecho);

// Um manual de bancada com menu lateral em toda página — o caso real de 15/10/2026:
// "Tipografia" e "Grid" no menu de cada página, e o assunto de verdade numa só.
const MENU = "Logos Versões Cores Tipografia Fotografia Grid";
const MANUAL: Trecho[] = [
  trecho(1, `Brandbook da marca de bancada. ${MENU}`),
  trecho(4, `Logo horizontal versão preferencial ${MENU} Utilize em todos os tipos de comunicação.`),
  trecho(5, `Logo vertical versão restrita ${MENU}`),
  trecho(6, `Versão 3D do logo ${MENU}`),
  trecho(10, `Cores da marca ${MENU} PMS 186`),
  trecho(8, `Usos incorretos ${MENU} Não troque a fonte do logo. Não use fonte condensada.`),
  trecho(17, `Tipografia ${MENU} A tipografia da nossa identidade é a Sans de Bancada, uma tipografia exclusiva. Pesos Light, Regular e Bold.`),
  trecho(18, `Estilo fotográfico ${MENU}`),
  trecho(28, `Grid ${MENU} O grid é a matriz de um layout: 12 colunas, margens de 8% e medianiz de 2%.`),
  trecho(29, `Aplicações ${MENU}`),
];

test("menu repetido em toda página não conta como assunto: vai a página que trata dele", () => {
  assert.deepEqual(paginasDaTipografia(MANUAL), [17], "antes: 1, 4, 5, 6 — as primeiras que citavam a palavra; a 8 cita 'fonte' de passagem");
  assert.deepEqual(paginasDoGrid(MANUAL), [28]);
});

test("sem menu, a ordem é título primeiro, depois quantas vezes o termo aparece", () => {
  const termos = /\b(tipografia|fontes?)\b/i;
  const trechos = [
    trecho(3, "Introdução. Usamos fontes com cuidado."),
    trecho(12, "Paleta de cores"),
    trecho(13, "Imagens"),
    trecho(20, "Tipografia institucional: a fonte principal e a fonte de apoio."),
    trecho(21, "Hierarquia de títulos e textos, com a fonte de apoio e a fonte principal; fontes substitutas."),
    trecho(30, "Aplicações"),
  ];
  assert.deepEqual(paginasDoAssunto(trechos, termos, 2), [20, 21], "a 3 cita uma vez e fica de fora do máximo");
  assert.deepEqual(paginasDoAssunto(trechos, termos, 4), [3, 20, 21]);
});

test("a seção do trecho conta como título; complemento e trecho sem página não contam", () => {
  const termos = /\btipografia\b/i;
  const trechos = [
    trecho(8, "Corpo de texto qualquer", { section: "Tipografia" }),
    trecho(9, "Tipografia aqui também", { origem: "complemento" } as Partial<Trecho>),
    trecho(0, "Tipografia", { pageStart: null }),
  ];
  assert.deepEqual(paginasDoAssunto(trechos, termos, 4), [8]);
});

test("com menu e sem página de título, vão as que citam mais de uma vez", () => {
  const termos = /\btipografia\b/i;
  const trechos = [1, 2, 3, 4, 5, 6, 7].map((p) => trecho(p, `Página ${p}. Menu: Logos Tipografia Cores`));
  trechos.push(trecho(9, "Página 9. Menu: Logos Tipografia Cores. A tipografia institucional é a Sans."));
  assert.deepEqual(paginasDoAssunto(trechos, termos, 4), [9]);
});
