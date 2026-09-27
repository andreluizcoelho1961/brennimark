import assert from "node:assert/strict";
import test from "node:test";
import {
  chaveDoNome, instrucoesDaSugestao, lerPaginasPedidas, lerSugestao, paginasDaPaleta, pontuarCodigosDeCor, soOQueFalta,
  MAXIMO_DE_PAGINAS_DA_SUGESTAO,
} from "./sugestao";
import type { Trecho } from "../ai/recuperacao";

function trecho(parcial: Partial<Trecho>): Trecho {
  return { documentSlug: "s", documentTitle: "Página", groupName: "g", section: null, status: "draft", pageStart: 1, pageEnd: 1, content: "", ...parcial };
}

test("página de paleta tem código de cor; página de texto não", () => {
  assert.ok(pontuarCodigosDeCor("Pantone 186 C · CMYK 0 100 85 0 · RGB 204 9 47 · HEX #CC092F") >= 5);
  assert.equal(pontuarCodigosDeCor("O logotipo deve ter área de proteção igual à altura do B."), 0);
});

test("as páginas da paleta saem do texto indexado, as de mais código primeiro", () => {
  const paginas = paginasDaPaleta([
    trecho({ documentTitle: "Logotipo", pageStart: 4, pageEnd: 5, content: "Área de proteção e redução mínima." }),
    trecho({ documentTitle: "Cores", pageStart: 21, pageEnd: 21, content: "Pantone 186 C, CMYK 0 100 85 0, RGB 204 9 47, #CC092F" }),
    trecho({ documentTitle: "Cores de apoio", pageStart: 22, pageEnd: 22,
      content: "PMS 7545 C CMYK 23 2 0 72 #425563; PMS 286 C CMYK 100 66 0 2 #0033A0; PMS 368 C #78BE20; RGB 120 190 32" }),
    trecho({ documentTitle: "Tipografia", pageStart: 30, pageEnd: 30, content: "Bradesco Sans, cor do texto em RGB." }),
  ]);
  // A de uma menção só ("em RGB") não conta como paleta.
  assert.deepEqual(paginas, [21, 22]);
});

test("uma seção longa entra só pelas primeiras páginas, e o total tem teto", () => {
  const paginas = paginasDaPaleta([
    trecho({ pageStart: 10, pageEnd: 20, content: "CMYK RGB HEX #111111 #222222" }),
    trecho({ pageStart: 40, pageEnd: 41, content: "CMYK RGB #333333" }),
  ]);
  assert.equal(paginas.length, MAXIMO_DE_PAGINAS_DA_SUGESTAO);
  assert.deepEqual(paginas, [10, 11, 12, 40]);
  assert.deepEqual(paginasDaPaleta([trecho({ content: "sem cor nenhuma" })]), []);
});

test("as páginas digitadas na tela são conferidas contra o manual", () => {
  assert.deepEqual(lerPaginasPedidas("22, 21 21", 47), { ok: true, paginas: [21, 22] });
  assert.deepEqual(lerPaginasPedidas("", 47), { ok: true, paginas: [] });
  assert.deepEqual(lerPaginasPedidas("vinte", 47), { ok: false, motivo: "formato" });
  assert.deepEqual(lerPaginasPedidas("0", 47), { ok: false, motivo: "formato" });
  assert.deepEqual(lerPaginasPedidas("1 2 3 4 5", 47), { ok: false, motivo: "demais" });
  assert.deepEqual(lerPaginasPedidas("48", 47), { ok: false, motivo: "fora-do-manual" });
});

test("a instrução proíbe converter código, e diz as páginas na ordem", () => {
  const pt = instrucoesDaSugestao(false, [21, 22]);
  assert.match(pt, /páginas 21, 22 do manual, nesta ordem/);
  assert.match(pt, /Nunca converta nem calcule um código/);
  assert.match(instrucoesDaSugestao(true, [3]), /Never convert or calculate a code/);
});

test("a resposta da IA vira cores que passam nas regras do banco", () => {
  const resposta = '```json\n{"cores":[' +
    '{"nome":"Vermelho Bradesco","papel":"principal","segmento":"","hex":"#cc092f","rgb":"204 9 47","cmyk":"0 100 85 0","pms":"186 C","pagina":21},' +
    '{"nome":"Cinza","papel":"qualquer","segmento":"Varejo","hex":null,"rgb":null,"cmyk":"0 0 0 60","pms":null,"pagina":99},' +
    '{"nome":"Sem código","papel":"apoio","hex":null,"rgb":null,"cmyk":null,"pms":null,"pagina":22},' +
    '{"nome":"HEX torto","papel":"apoio","hex":"vermelho","pagina":22}' +
    "]}\n```";
  const cores = lerSugestao(resposta, [21, 22]);
  assert.equal(cores.length, 2);
  assert.deepEqual(cores[0], { nome: "Vermelho Bradesco", papel: "principal", segmento: "", hex: "#CC092F", rgb: "204 9 47", cmyk: "0 100 85 0", pms: "186 C", pagina: 21 });
  // Papel desconhecido vira apoio; página que não foi enviada vira sem página.
  assert.equal(cores[1].papel, "apoio");
  assert.equal(cores[1].pagina, null);
  assert.equal(cores[1].segmento, "Varejo");
});

test("resposta cortada no meio ainda entrega as cores que terminaram", () => {
  const cortada = '{"cores":[{"nome":"Azul","papel":"apoio","hex":"#0033A0","pagina":22},{"nome":"Verde","papel":"apoio","hex":"#78BE20","pag';
  const cores = lerSugestao(cortada, [22]);
  assert.deepEqual(cores.map((c) => c.nome), ["Azul"]);
  assert.deepEqual(lerSugestao("não sei", [22]), []);
  assert.deepEqual(lerSugestao('{"cores":[]}', [22]), []);
  // Lista solta, sem o invólucro, também serve.
  assert.equal(lerSugestao('[{"nome":"Azul","papel":"apoio","pms":"286 C","pagina":22}]', [22]).length, 1);
});

test("só o que falta: nada repete HEX ou nome já na ficha, nem dentro da sugestão", () => {
  const base = { papel: "apoio" as const, segmento: "", rgb: null, cmyk: null, pms: null, pagina: 22 };
  const { novas, repetidas } = soOQueFalta(
    [
      { ...base, nome: "Vermelho Bradesco", hex: "#CC092F" },
      { ...base, nome: "Vermelho institucional", hex: "#CC092F" },
      { ...base, nome: "AZUL  Noite", hex: "#0B1F3A" },
      { ...base, nome: "Verde", hex: "#78BE20" },
      { ...base, nome: "verde", hex: "#78BE21" },
      { ...base, nome: "Só Pantone", hex: null },
    ],
    [{ nome: "Azul noite", hex: null }, { nome: "Vermelho", hex: "#CC092F" }],
  );
  assert.deepEqual(novas.map((c) => c.nome), ["Verde", "Só Pantone"]);
  assert.equal(repetidas, 4);
  assert.equal(chaveDoNome("  Açaí   ESCURO "), "acai escuro");
});
