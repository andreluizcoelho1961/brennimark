import assert from "node:assert/strict";
import test from "node:test";
import { chaveDeRepeticao, detectarRepetidos, linhasDe, linhasUteis } from "./texto";
import type { ItemDeTexto, PaginaExtraida } from "./texto";

const item = (texto: string, x: number, y: number, altura = 10, fonte = "F1"): ItemDeTexto =>
  ({ texto, x, y, altura, fonte });

const pagina = (numero: number, itens: ItemDeTexto[]): PaginaExtraida =>
  ({ numero, alturaDaPagina: 800, itens });

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
