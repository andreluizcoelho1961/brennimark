import assert from "node:assert/strict";
import test from "node:test";
import {
  agrupar, dividir, faixaLegivel, fimDe, inicioDe, moverPagina, normalizar,
  paginasDe, renomear, unir, validarInvariantes, MAXIMO_DE_SECOES, type Secao,
} from "./secoes";
import { detectarRepetidos, type ItemDeTexto, type PaginaExtraida } from "./texto";
import type { ItemDeOutline } from "./tipos";

const item = (texto: string, y: number, altura = 12): ItemDeTexto =>
  ({ texto, x: 40, y, altura, fonte: "F1" });

/** Uma pagina com um titulo destacado e um corpo. */
const comTitulo = (numero: number, titulo: string, corpo: string): PaginaExtraida =>
  ({ numero, alturaDaPagina: 800, itens: [item(titulo, 700, 30), item(corpo, 600, 12)] });

/** Uma pagina so de corpo, sem destaque. */
const soCorpo = (numero: number, corpo: string): PaginaExtraida =>
  ({ numero, alturaDaPagina: 800, itens: [item(corpo, 600, 12)] });

const vazia = (numero: number): PaginaExtraida =>
  ({ numero, alturaDaPagina: 800, itens: [] });

const linhasPorPagina = (paginas: PaginaExtraida[]) =>
  new Map(paginas.map((p) => [p.numero, p.itens.map((i) => i.texto)]));

const todasAsPaginasComTexto = (paginas: PaginaExtraida[]) =>
  paginas.filter((p) => p.itens.length > 0).map((p) => p.numero);

// ─── Intervalos ─────────────────────────────────────────────────────────────

test("intervalos adjacentes e sobrepostos se fundem", () => {
  assert.deepEqual(normalizar([{ de: 1, ate: 3 }, { de: 4, ate: 6 }]), [{ de: 1, ate: 6 }]);
  assert.deepEqual(normalizar([{ de: 1, ate: 5 }, { de: 3, ate: 8 }]), [{ de: 1, ate: 8 }]);
  assert.deepEqual(normalizar([{ de: 9, ate: 9 }, { de: 1, ate: 2 }]),
    [{ de: 1, ate: 2 }, { de: 9, ate: 9 }]);
});

test("a faixa legivel diz a verdade sobre secao descontinua", () => {
  const secao = { sourcePageRanges: [{ de: 1, ate: 5 }, { de: 9, ate: 9 }] } as Secao;
  // Inicio e fim sozinhos diriam "1 a 9", que inclui paginas que nao sao dela.
  assert.equal(faixaLegivel(secao), "1–5, 9");
  assert.equal(inicioDe(secao), 1);
  assert.equal(fimDe(secao), 9);
});

// ─── Ordem de confianca ─────────────────────────────────────────────────────

test("o indice do PDF define as fronteiras antes de tudo", () => {
  const paginas = [
    comTitulo(1, "Introducao grafica", "texto"),
    soCorpo(2, "mais texto"),
    comTitulo(3, "Outro destaque", "texto"),
  ];
  const outline: ItemDeOutline[] = [
    { titulo: "Cor", pagina: 1, nivel: 0, filhos: [] },
    { titulo: "Tipografia", pagina: 3, nivel: 0, filhos: [] },
  ];
  const { secoes } = agrupar({ paginas, outline });

  // Ha titulo visual nas duas paginas, e mesmo assim o indice manda.
  assert.deepEqual(secoes.map((s) => s.titulo), ["Cor", "Tipografia"]);
  assert.ok(secoes.every((s) => s.metodo === "outline"));
  assert.ok(secoes.every((s) => s.confianca === 1));
});

test("o titulo visual so resolve o que o indice deixou em aberto", () => {
  const paginas = [
    comTitulo(1, "Fundamentos", "a"),
    soCorpo(2, "b"),
    comTitulo(3, "Cor", "c"),
  ];
  const outline: ItemDeOutline[] = [{ titulo: "Abertura", pagina: 1, nivel: 0, filhos: [] }];
  const { secoes } = agrupar({ paginas, outline });

  assert.equal(secoes[0].titulo, "Abertura");
  assert.equal(secoes[0].metodo, "outline");
  assert.equal(secoes[1].titulo, "Cor");
  assert.equal(secoes[1].metodo, "heading");
  assert.ok(secoes[1].confianca < 1, "geometria nao prova intencao");
});

test("sem indice e sem titulo, blocos de oito com procedencia no rotulo", () => {
  const paginas = Array.from({ length: 20 }, (_, i) => soCorpo(i + 1, `corpo ${i + 1}`));
  const { secoes } = agrupar({ paginas });

  assert.ok(secoes.every((s) => s.metodo === "page-range"));
  // O rotulo diz de onde veio, em vez de inventar nome de capitulo.
  assert.equal(secoes[0].titulo, "Páginas 1–8");
  assert.equal(secoes[1].titulo, "Páginas 9–16");
  assert.equal(secoes[2].titulo, "Páginas 17–20");
  assert.ok(secoes.every((s) => s.confianca <= 0.2));
});

test("uma secao longa demais e quebrada em blocos", () => {
  // 30 paginas sob um unico titulo nao sao revisaveis.
  const paginas = [
    comTitulo(1, "Aplicacoes", "abertura"),
    ...Array.from({ length: 29 }, (_, i) => soCorpo(i + 2, `corpo ${i + 2}`)),
  ];
  const { secoes } = agrupar({ paginas });
  assert.ok(secoes.length > 1, "uma secao de 30 paginas nao e revisavel");
  assert.equal(secoes[0].titulo, "Aplicacoes");
});

test("uma linha de corpo comprida nao vira titulo", () => {
  const longa = "esta linha tem mais de oitenta caracteres e por isso nao pode ser tomada como um titulo de secao";
  const paginas = [{ numero: 1, alturaDaPagina: 800, itens: [item(longa, 700, 30)] }];
  const { secoes } = agrupar({ paginas });
  assert.equal(secoes[0].metodo, "page-range");
});

// ─── Invariantes ────────────────────────────────────────────────────────────

test("cada pagina com texto pertence a exatamente uma secao", () => {
  const paginas = [
    comTitulo(1, "Cor", "a"), soCorpo(2, "b"), comTitulo(3, "Tipografia", "c"),
    soCorpo(4, "d"), soCorpo(5, "e"),
  ];
  const agrupamento = agrupar({ paginas });
  assert.deepEqual(validarInvariantes(agrupamento, todasAsPaginasComTexto(paginas)), []);

  const todas = agrupamento.secoes.flatMap(paginasDe);
  assert.equal(new Set(todas).size, todas.length, "nenhuma pagina em duas secoes");
  assert.deepEqual([...todas].sort((a, b) => a - b), [1, 2, 3, 4, 5]);
});

test("pagina sem texto fica ignorada com motivo, nunca em uma secao", () => {
  const paginas = [comTitulo(1, "Cor", "a"), vazia(2), soCorpo(3, "c")];
  const agrupamento = agrupar({ paginas });

  assert.deepEqual(agrupamento.ignoradas, [{ pagina: 2, motivo: "sem-texto" }]);
  assert.ok(!agrupamento.secoes.some((s) => paginasDe(s).includes(2)));
  assert.deepEqual(validarInvariantes(agrupamento, todasAsPaginasComTexto(paginas)), []);
});

test("a validacao acusa pagina em duas secoes", () => {
  const agrupamento = {
    secoes: [
      { id: "a", titulo: "A", metodo: "outline", confianca: 1,
        sourcePageRanges: [{ de: 1, ate: 3 }], linhas: [] },
      { id: "b", titulo: "B", metodo: "outline", confianca: 1,
        sourcePageRanges: [{ de: 3, ate: 5 }], linhas: [] },
    ] as Secao[],
    ignoradas: [], removidos: [], unidasPeloLimite: 0,
  };
  const violacoes = validarInvariantes(agrupamento, [1, 2, 3, 4, 5]);
  assert.equal(violacoes.length, 1);
  assert.equal(violacoes[0].tipo, "pagina-em-duas-secoes");
});

test("a validacao acusa pagina sem destino", () => {
  const agrupamento = {
    secoes: [{ id: "a", titulo: "A", metodo: "outline", confianca: 1,
      sourcePageRanges: [{ de: 1, ate: 2 }], linhas: [] }] as Secao[],
    ignoradas: [], removidos: [], unidasPeloLimite: 0,
  };
  const violacoes = validarInvariantes(agrupamento, [1, 2, 3]);
  assert.deepEqual(violacoes.map((v) => v.tipo), ["pagina-sem-destino"]);
});

// ─── Remocao registrada, nao silenciosa ─────────────────────────────────────

test("cabecalho removido vira decisao anotada", () => {
  const paginas = [1, 2, 3, 4, 5].map((n) => ({
    numero: n, alturaDaPagina: 800,
    itens: [item("Brand Guidelines", 780, 8), item(`corpo ${n}`, 600, 12), item(String(n), 20, 8)],
  }));
  const repetidos = detectarRepetidos(paginas);
  const { secoes, removidos } = agrupar({ paginas, repetidos });

  // Sai da leitura editorial...
  assert.ok(!secoes.some((s) => s.linhas.includes("Brand Guidelines")));
  // ...mas fica registrado, com quantas vezes apareceu.
  const cabecalho = removidos.find((r) => r.texto === "Brand Guidelines");
  assert.ok(cabecalho, "remocao sem registro e perda silenciosa");
  assert.equal(cabecalho.ocorrencias, 5);
});

// ─── Texto integral ─────────────────────────────────────────────────────────

test("o texto da secao nao e truncado", () => {
  // 14pt de entrelinha: a distancia real entre linhas de um corpo de 12pt.
  // Com 1pt, elas cairiam na mesma faixa e se fundiriam — corretamente.
  const muitas = Array.from({ length: 60 }, (_, i) => item(`paragrafo ${i}`, 700 - i * 14, 12));
  const paginas = [{ numero: 1, alturaDaPagina: 800, itens: muitas }];
  const { secoes } = agrupar({ paginas });
  // O limite antigo de 40 paragrafos cortava sem avisar.
  assert.equal(secoes[0].linhas.length, 60);
});

// ─── Edicao preserva procedencia ────────────────────────────────────────────

const paginasDeEdicao = [
  comTitulo(1, "Cor", "a"), soCorpo(2, "b"), soCorpo(3, "c"),
  comTitulo(4, "Tipografia", "d"), soCorpo(5, "e"),
];
const mapa = linhasPorPagina(paginasDeEdicao);

test("renomear nao toca na procedencia", () => {
  const { secoes } = agrupar({ paginas: paginasDeEdicao });
  const depois = renomear(secoes, secoes[0].id, "Sistema de cor");
  assert.equal(depois[0].titulo, "Sistema de cor");
  assert.deepEqual(depois[0].sourcePageRanges, secoes[0].sourcePageRanges);
  assert.equal(depois[0].metodo, secoes[0].metodo);
});

test("dividir preserva todas as paginas", () => {
  const { secoes } = agrupar({ paginas: paginasDeEdicao });
  const antes = paginasDe(secoes[0]);
  const depois = dividir(secoes, secoes[0].id, 3, mapa);

  const [a, b] = depois;
  assert.deepEqual([...paginasDe(a), ...paginasDe(b)].sort((x, y) => x - y), antes);
  assert.deepEqual(validarInvariantes(
    { secoes: depois, ignoradas: [], removidos: [], unidasPeloLimite: 0 },
    todasAsPaginasComTexto(paginasDeEdicao),
  ), []);
});

test("unir soma as procedencias sem perder pagina", () => {
  const { secoes } = agrupar({ paginas: paginasDeEdicao });
  const esperado = [...paginasDe(secoes[0]), ...paginasDe(secoes[1])].sort((a, b) => a - b);
  const depois = unir(secoes, secoes[0].id, secoes[1].id, mapa);

  assert.equal(depois.length, 1);
  assert.deepEqual(paginasDe(depois[0]), esperado);
  assert.deepEqual(validarInvariantes(
    { secoes: depois, ignoradas: [], removidos: [], unidasPeloLimite: 0 },
    todasAsPaginasComTexto(paginasDeEdicao),
  ), []);
});

test("mover pagina deixa a origem descontinua, e o modelo diz isso", () => {
  const { secoes } = agrupar({ paginas: paginasDeEdicao });
  // A secao "Cor" tem 1–3; tirar a 2 deixa "1, 3" — que sourcePageStart/End
  // nao conseguiria descrever sem incluir a 2 por engano.
  const depois = moverPagina(secoes, 2, secoes[1].id, mapa);
  const origem = depois.find((s) => s.id === secoes[0].id)!;

  assert.deepEqual(origem.sourcePageRanges, [{ de: 1, ate: 1 }, { de: 3, ate: 3 }]);
  assert.equal(faixaLegivel(origem), "1, 3");
  assert.ok(!paginasDe(origem).includes(2));
  assert.ok(paginasDe(depois.find((s) => s.id === secoes[1].id)!).includes(2));

  assert.deepEqual(validarInvariantes(
    { secoes: depois, ignoradas: [], removidos: [], unidasPeloLimite: 0 },
    todasAsPaginasComTexto(paginasDeEdicao),
  ), [], "mover nao pode quebrar cobertura nem criar sobreposicao");
});

test("mover leva o texto da pagina junto", () => {
  const { secoes } = agrupar({ paginas: paginasDeEdicao });
  const depois = moverPagina(secoes, 2, secoes[1].id, mapa);
  const destino = depois.find((s) => s.id === secoes[1].id)!;
  assert.ok(destino.linhas.includes("b"), "a procedencia sem o texto seria meia verdade");
});

test("mover uma pagina para a secao onde ela ja esta nao muda nada", () => {
  const { secoes } = agrupar({ paginas: paginasDeEdicao });
  assert.deepEqual(moverPagina(secoes, 1, secoes[0].id, mapa), secoes);
});

// ─── O teto de secoes ───────────────────────────────────────────────────────

test("mil paginas com fronteira em cada uma cabem no teto, sem perder pagina", () => {
  // Um manual valido com indice muito detalhado produziria 1000 secoes, e a
  // RPC recusaria a importacao inteira. Recusar um manual VALIDO por causa de
  // um teto do produto seria o produto culpando o cliente pelo proprio limite.
  const paginas = Array.from({ length: 1000 }, (_, i) => soCorpo(i + 1, `corpo ${i + 1}`));
  const outline: ItemDeOutline[] = Array.from({ length: 1000 }, (_, i) => ({
    titulo: `Item ${i + 1}`, pagina: i + 1, nivel: 0, filhos: [],
  }));

  const agrupamento = agrupar({ paginas, outline });

  assert.ok(agrupamento.secoes.length <= MAXIMO_DE_SECOES, "precisa caber no teto");
  assert.ok(agrupamento.unidasPeloLimite > 0, "o produto precisa dizer que uniu");

  // Nenhuma pagina se perdeu, e nenhuma foi para duas secoes.
  const todas = agrupamento.secoes.flatMap(paginasDe).sort((a, b) => a - b);
  assert.equal(todas.length, 1000);
  assert.equal(new Set(todas).size, 1000);
  assert.deepEqual(
    validarInvariantes(agrupamento, todasAsPaginasComTexto(paginas)),
    [],
  );
});

test("o teto nao inventa conteudo: o texto todo continua la", () => {
  const paginas = Array.from({ length: 600 }, (_, i) => soCorpo(i + 1, `corpo ${i + 1}`));
  const outline: ItemDeOutline[] = Array.from({ length: 600 }, (_, i) => ({
    titulo: `Item ${i + 1}`, pagina: i + 1, nivel: 0, filhos: [],
  }));

  const { secoes } = agrupar({ paginas, outline });
  const linhas = secoes.flatMap((s) => s.linhas);
  assert.equal(linhas.length, 600);
  assert.ok(linhas.includes("corpo 599"));
});

test("a primeira secao nunca perde a fronteira", () => {
  const paginas = Array.from({ length: 700 }, (_, i) => soCorpo(i + 1, `c${i + 1}`));
  const outline: ItemDeOutline[] = Array.from({ length: 700 }, (_, i) => ({
    titulo: `Item ${i + 1}`, pagina: i + 1, nivel: 0, filhos: [],
  }));
  const { secoes } = agrupar({ paginas, outline });
  // Dissolver a primeira deixaria o comeco do manual sem secao.
  assert.equal(secoes[0].titulo, "Item 1");
  assert.equal(inicioDe(secoes[0]), 1);
});

test("um manual dentro do teto nao e unido a toa", () => {
  const paginas = Array.from({ length: 40 }, (_, i) => soCorpo(i + 1, `c${i + 1}`));
  const outline: ItemDeOutline[] = Array.from({ length: 40 }, (_, i) => ({
    titulo: `Item ${i + 1}`, pagina: i + 1, nivel: 0, filhos: [],
  }));
  const agrupamento = agrupar({ paginas, outline });
  assert.equal(agrupamento.unidasPeloLimite, 0);
  assert.equal(agrupamento.secoes.length, 40);
});
