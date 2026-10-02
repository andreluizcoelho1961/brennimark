import assert from "node:assert/strict";
import test from "node:test";
import {
  chaveDeRepeticao, detectarRepetidos, detectarRepetidosPorPosicao, linhasDe, linhasUteis, removidosPorPosicao, semRepetidosPorPosicao,
} from "./texto";
import type { ItemDeTexto, PaginaExtraida } from "./texto";

const item = (texto: string, x: number, y: number, altura = 10, fonte = "F1"): ItemDeTexto =>
  ({ texto, x, y, altura, fonte });

const pagina = (numero: number, itens: ItemDeTexto[]): PaginaExtraida =>
  ({ numero, alturaDaPagina: 800, larguraPt: 595, alturaPt: 800, rotacao: 0, itens });

test("itens na mesma altura viram uma linha, na ordem da leitura", () => {
  const linhas = linhasDe(pagina(1, [
    item("mundo", 120, 700),
    item("Ola", 40, 700),
    item("segunda linha", 40, 680),
  ]));
  assert.equal(linhas[0].texto, "Ola mundo");
  assert.equal(linhas[1].texto, "segunda linha");
});

test("a altura da linha e a do maior item, que e o sinal de destaque", () => {
  const linhas = linhasDe(pagina(1, [item("CORES", 40, 700, 28), item("(R)", 140, 700, 9)]));
  assert.equal(linhas[0].altura, 28);
});

test("numeros de pagina diferentes colidem na mesma chave", () => {
  // "12" e "13" sao a mesma coisa: o numero da folha. Sem normalizar, a
  // repeticao nunca seria percebida.
  assert.equal(chaveDeRepeticao("12"), chaveDeRepeticao("13"));
  assert.equal(chaveDeRepeticao("Pagina 4"), chaveDeRepeticao("Pagina 87"));
  assert.notEqual(chaveDeRepeticao("Cores"), chaveDeRepeticao("Tipografia"));
});

const comCabecalho = (numero: number, corpo: string) =>
  pagina(numero, [
    item("Brand Guidelines", 40, 780, 8),
    item(corpo, 40, 500, 12),
    item(String(numero), 500, 20, 8),
  ]);

test("cabecalho e rodape repetidos sao reconhecidos", () => {
  const paginas = [1, 2, 3, 4, 5].map((n) => comCabecalho(n, `conteudo ${n}`));
  const repetidos = detectarRepetidos(paginas);

  // Sao exatamente o que a heuristica de "linha curta no alto" elegeria como
  // titulo, e sao o oposto: repetem-se porque NAO marcam secao.
  assert.ok(repetidos.has(chaveDeRepeticao("Brand Guidelines")));
  assert.ok(repetidos.has(chaveDeRepeticao("3")));
});

test("um titulo de secao nao e confundido com cabecalho", () => {
  const paginas = [
    ...[1, 2, 3, 4].map((n) => comCabecalho(n, `conteudo ${n}`)),
    pagina(5, [
      item("Brand Guidelines", 40, 780, 8),
      item("Cor", 40, 700, 30),
      item("A paleta parte do vermelho.", 40, 600, 12),
      item("5", 500, 20, 8),
    ]),
  ];
  const repetidos = detectarRepetidos(paginas);
  assert.ok(!repetidos.has(chaveDeRepeticao("Cor")), "aparece uma vez so, e secao");

  const uteis = linhasUteis(paginas[4], repetidos).map((l) => l.texto);
  assert.deepEqual(uteis, ["Cor", "A paleta parte do vermelho."]);
});

test("PDF curto demais nao tem repeticao confiavel", () => {
  // Em duas paginas, tudo se repete por acaso. Melhor nao decidir.
  const paginas = [comCabecalho(1, "a"), comCabecalho(2, "b")];
  assert.equal(detectarRepetidos(paginas).size, 0);
});

test("linha do meio da pagina nao e cabecalho, mesmo repetida", () => {
  const paginas = [1, 2, 3, 4, 5].map((n) =>
    pagina(n, [item("mesmo texto no meio", 40, 400, 12), item(`corpo ${n}`, 40, 300, 12)]),
  );
  // A margem e o que distingue moldura de conteudo.
  assert.equal(detectarRepetidos(paginas).size, 0);
});

test("texto de corpo no alto da mancha nao e confundido com cabecalho", () => {
  // A margem precisa ser estreita o bastante para nao engolir a primeira linha
  // do conteudo. Com 12% da altura, uma linha a 88% da pagina caia na faixa.
  const paginas = [1, 2, 3, 4, 5].map((n) =>
    pagina(n, [
      item("Brand Guidelines", 40, 780, 8),
      item(`Conteudo da pagina ${n}`, 40, 700, 14),
      item(String(n), 500, 20, 8),
    ]),
  );
  const repetidos = detectarRepetidos(paginas);
  const uteis = linhasUteis(paginas[2], repetidos).map((l) => l.texto);
  assert.deepEqual(uteis, ["Conteudo da pagina 3"]);
});

// ─── Repetição por posição: o menu lateral (26/09/2026) ─────────────────────

function paginaDeManual(numero: number, corpo: ItemDeTexto[]): PaginaExtraida {
  const menu: ItemDeTexto[] = ["Logotipo", "Cores", "Tipografia", "Fotografia"].map((texto, i) => ({
    texto, x: 20, y: 700 - i * 20, altura: 9, fonte: "Menu",
  }));
  return { numero, alturaDaPagina: 800, larguraPt: 600, alturaPt: 800, rotacao: 0, itens: [...menu, ...corpo] };
}

const MANUAL = [
  paginaDeManual(1, [{ texto: "Manual da Marca", x: 200, y: 400, altura: 40, fonte: "Titulo" }]),
  paginaDeManual(2, [
    { texto: "Logotipo", x: 200, y: 740, altura: 28, fonte: "Titulo" },
    // Na MESMA altura do item "Logotipo" do menu: sem o filtro por posição, viraria uma linha só.
    { texto: "Use o símbolo sobre fundo escuro.", x: 200, y: 700, altura: 10, fonte: "Corpo" },
  ]),
  paginaDeManual(3, [
    { texto: "Cores", x: 200, y: 740, altura: 28, fonte: "Titulo" },
    { texto: "O azul principal é o Cobalto.", x: 200, y: 680, altura: 10, fonte: "Corpo" },
  ]),
  paginaDeManual(4, [
    { texto: "Tipografia", x: 200, y: 740, altura: 28, fonte: "Titulo" },
    { texto: "Use o símbolo sobre fundo escuro.", x: 300, y: 300, altura: 10, fonte: "Corpo" },
  ]),
  paginaDeManual(5, [{ texto: "Contato", x: 200, y: 740, altura: 28, fonte: "Titulo" }]),
];

test("o menu que se repete no mesmo lugar sai antes de virar linha junto com o corpo", () => {
  const repetidos = detectarRepetidosPorPosicao(MANUAL);
  assert.equal(repetidos.size, 4);
  const limpas = semRepetidosPorPosicao(MANUAL, repetidos);
  const pagina2 = linhasDe(limpas[1]).map((l) => l.texto);
  // O título da página continua: ele está em outro lugar, não é o item do menu.
  assert.deepEqual(pagina2, ["Logotipo", "Use o símbolo sobre fundo escuro."]);
  assert.deepEqual(linhasDe(limpas[2]).map((l) => l.texto), ["Cores", "O azul principal é o Cobalto."]);
  // Sem o filtro, o menu grudava no corpo: é o defeito que o ensaio achou.
  assert.ok(linhasDe(MANUAL[1]).some((l) => l.texto === "Logotipo Use o símbolo sobre fundo escuro."));
});

test("texto que se repete em lugares diferentes é conteúdo, e fica", () => {
  const limpas = semRepetidosPorPosicao(MANUAL, detectarRepetidosPorPosicao(MANUAL));
  assert.ok(linhasDe(limpas[3]).some((l) => l.texto === "Use o símbolo sobre fundo escuro."));
  assert.ok(linhasDe(limpas[1]).some((l) => l.texto === "Use o símbolo sobre fundo escuro."));
});

test("o que se repete em menos de 60% das páginas fica; manual curto não perde nada", () => {
  const comMenuEmDuas = MANUAL.map((p, i) => (i < 2 ? p : { ...p, itens: p.itens.filter((it) => it.fonte !== "Menu") }));
  assert.equal(detectarRepetidosPorPosicao(comMenuEmDuas).size, 0);
  assert.equal(detectarRepetidosPorPosicao(MANUAL.slice(0, 2)).size, 0);
});

test("o que saiu por posição vai para a prévia, com o número de páginas", () => {
  const removidos = removidosPorPosicao(MANUAL, detectarRepetidosPorPosicao(MANUAL));
  assert.deepEqual(removidos.map((r) => `${r.texto}:${r.ocorrencias}`).sort(),
    ["Cores:5", "Fotografia:5", "Logotipo:5", "Tipografia:5"]);
  assert.equal(MANUAL[1].itens.length, 6, "a entrada não é alterada");
});

test("título numerado no mesmo lugar é conteúdo: 'Capítulo 1', 'Capítulo 2'… ficam", () => {
  const paginas = [1, 2, 3, 4, 5].map((n) => paginaDeManual(n, [
    { texto: `Capítulo ${n}`, x: 200, y: 740, altura: 28, fonte: "Titulo" },
    { texto: `Corpo do capítulo ${n}.`, x: 200, y: 600, altura: 10, fonte: "Corpo" },
  ]));
  const limpas = semRepetidosPorPosicao(paginas, detectarRepetidosPorPosicao(paginas));
  assert.deepEqual(linhasDe(limpas[2]).map((l) => l.texto), ["Capítulo 3", "Corpo do capítulo 3."]);
});
