import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * A fixture visual prova o que o manual real não consegue provar.
 *
 * Medição da Fatia 0: no manual real da GE, TODAS as 743 páginas têm texto
 * extraível. O caminho de código que descarta página sem texto — o defeito
 * mais grave apontado no replanejamento — nunca dispara com ele. Sem uma
 * fixture que tenha páginas de arte pura, esse defeito não tem teste possível,
 * e o CI não consegue reprovar a regressão.
 *
 * Estes testes garantem que a fixture continua contendo cada caso que ela
 * existe para exercitar. Um caso que desaparecer do gerador derruba o teste
 * aqui, em vez de silenciosamente parar de ser testado lá na frente.
 *
 * O teste roda a partir do diretório compilado em .tmp, então `__dirname` não
 * serve — o caminho sai da raiz do projeto, como em leak-guard.test.ts.
 */
const raiz = process.cwd();
const CAMINHO = path.join(raiz, "e2e", "fixtures", "manual-visual.pdf");
const GERADOR = path.join(raiz, "scripts", "gerar-fixture-visual.py");

interface PaginaLida {
  numero: number;
  largura: number;
  altura: number;
  caracteres: number;
  /** Quantos operadores de pintura de imagem a página executa. */
  imagens: number;
  /** Quantos operadores de preenchimento/caminho a página executa. */
  preenchimentos: number;
}

interface NoDeIndice {
  titulo: string;
  nivel: number;
  filhos: NoDeIndice[];
}

let paginas: PaginaLida[] = [];
let indice: NoDeIndice[] = [];

/**
 * Lê a fixture uma vez para todos os testes.
 *
 * `node --test` executa os testes do arquivo em sequência, e abrir o mesmo PDF
 * doze vezes seria doze vezes o mesmo trabalho. A leitura acontece no primeiro
 * teste que precisar dela.
 */
async function lerFixture() {
  if (paginas.length > 0) return;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dados = new Uint8Array(fs.readFileSync(CAMINHO));
  const doc = await pdfjs.getDocument({ data: dados }).promise;

  const lidas: PaginaLida[] = [];
  for (let numero = 1; numero <= doc.numPages; numero += 1) {
    const pagina = await doc.getPage(numero);
    const [x0, y0, x1, y1] = pagina.view;
    const conteudo = await pagina.getTextContent();
    const operadores = await pagina.getOperatorList();

    let imagens = 0;
    let preenchimentos = 0;
    for (const fn of operadores.fnArray) {
      if (
        fn === pdfjs.OPS.paintImageXObject ||
        fn === pdfjs.OPS.paintInlineImageXObject
      ) {
        imagens += 1;
      } else if (fn === pdfjs.OPS.fill || fn === pdfjs.OPS.eoFill || fn === pdfjs.OPS.constructPath) {
        preenchimentos += 1;
      }
    }

    lidas.push({
      numero,
      largura: Math.abs(x1 - x0),
      altura: Math.abs(y1 - y0),
      caracteres: conteudo.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("")
        .trim().length,
      imagens,
      preenchimentos,
    });
  }

  const bruto = (await doc.getOutline().catch(() => null)) as
    | { title?: string; items?: unknown[] }[]
    | null;
  const converter = (itens: { title?: string; items?: unknown[] }[], nivel: number): NoDeIndice[] =>
    itens.map((item) => ({
      titulo: (item.title ?? "").trim(),
      nivel,
      filhos: item.items?.length
        ? converter(item.items as { title?: string; items?: unknown[] }[], nivel + 1)
        : [],
    }));

  paginas = lidas;
  indice = bruto ? converter(bruto, 0) : [];
}

const profundidade = (nos: NoDeIndice[]): number =>
  nos.length === 0 ? 0 : 1 + Math.max(...nos.map((no) => profundidade(no.filhos)));

// ─── O que a fixture contém ────────────────────────────────────────────────

test("a fixture tem exatamente nove páginas", async () => {
  await lerFixture();
  assert.equal(paginas.length, 9);
});

test("há página em retrato E página em paisagem", async () => {
  await lerFixture();
  // Orientação que muda no meio do manual é comum, e é o que obriga o
  // manifesto a guardar dimensões por página em vez de assumir uma medida.
  assert.ok(paginas.some((p) => p.altura > p.largura), "nenhuma página em retrato");
  assert.ok(paginas.some((p) => p.largura > p.altura), "nenhuma página em paisagem");
});

test("há página de texto corrido, com texto extraível de verdade", async () => {
  await lerFixture();
  const texto = paginas.filter((p) => p.caracteres > 400);
  assert.ok(texto.length >= 1, "nenhuma página com texto corrido");
});

test("há página de fotografia, com imagem rasterizada", async () => {
  await lerFixture();
  const foto = paginas.find((p) => p.imagens > 0 && p.caracteres > 0);
  assert.ok(foto, "nenhuma página combina imagem rasterizada com legenda");
});

test("há página de imagem achatada: imagem sem texto nenhum por cima", async () => {
  await lerFixture();
  // É o caso do PDF escaneado ou exportado achatado: a página inteira É uma
  // imagem, e não há uma única palavra a extrair dela.
  const achatada = paginas.find((p) => p.imagens > 0 && p.caracteres === 0);
  assert.ok(achatada, "nenhuma página é imagem achatada sem texto");
});

test("há arte em cor sólida, sem texto e sem imagem rasterizada", async () => {
  await lerFixture();
  // Abertura de seção em vermelho cheio: é desenho vetorial, não imagem, e
  // não tem texto. Some inteira no pipeline atual.
  const arte = paginas.find((p) => p.caracteres === 0 && p.imagens === 0 && p.preenchimentos > 3);
  assert.ok(arte, "nenhuma página é arte vetorial em cor sólida");
});

test("há diagrama: muitos caminhos e pouco texto", async () => {
  await lerFixture();
  const diagrama = paginas.find(
    (p) => p.preenchimentos > 5 && p.caracteres > 0 && p.caracteres < 400,
  );
  assert.ok(diagrama, "nenhuma página parece diagrama com rótulos curtos");
});

test("há tipografia convertida em curvas: desenho de letra, sem operador de texto", async () => {
  await lerFixture();
  // O "G" desenhado como caminho preenchido. Para o extrator é arte — e é
  // exatamente isso que ela é. Um manual real com título em curvas perde o
  // título inteiro, não só a forma.
  const curvas = paginas.filter((p) => p.caracteres === 0 && p.imagens === 0);
  assert.ok(curvas.length >= 2, "esperava arte vetorial E tipografia em curvas");
});

test("há página SEM NENHUM texto extraível — o caso que o manual real não tem", async () => {
  await lerFixture();
  const semTexto = paginas.filter((p) => p.caracteres === 0);
  assert.ok(
    semTexto.length >= 3,
    `esperava ao menos 3 páginas sem texto, encontrei ${semTexto.length}`,
  );
});

test("o índice declarado tem três níveis de profundidade", async () => {
  await lerFixture();
  // Três níveis é o que distingue `outline_nodes` (árvore preservada) de
  // `navigation_nodes` (projeção curada). Com um nível só, a diferença entre
  // preservar a árvore e achatá-la não aparece no teste.
  assert.equal(profundidade(indice), 3);
  assert.ok(indice.length >= 2, "esperava ao menos duas raízes no índice");
});

// ─── O gerador e o arquivo versionado ──────────────────────────────────────

function gerarEm(destino: string): Buffer {
  execFileSync("python3", [GERADOR, destino], { stdio: "pipe" });
  return fs.readFileSync(path.join(destino, "manual-visual.pdf"));
}

test("a geração é determinística: dois lados iguais, byte a byte", async () => {
  // Sem determinismo, o teste de correspondência abaixo falharia por ruído —
  // e a fixture versionada mudaria a cada execução do gerador, poluindo o
  // histórico com diffs binários que não significam nada.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "fixture-visual-"));
  try {
    const primeira = gerarEm(path.join(base, "a"));
    const segunda = gerarEm(path.join(base, "b"));
    assert.ok(primeira.equals(segunda), "duas gerações produziram bytes diferentes");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("o PDF versionado corresponde ao que o gerador produz hoje", async () => {
  // A fixture é binária e versionada. Sem esta checagem, gerador e arquivo
  // divergem em silêncio: alguém muda o gerador, esquece de regerar, e os
  // testes passam a exercitar um arquivo que ninguém mais sabe reproduzir.
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "fixture-visual-"));
  try {
    const gerado = gerarEm(base);
    const versionado = fs.readFileSync(CAMINHO);
    assert.ok(
      gerado.equals(versionado),
      "o PDF versionado não bate com o gerador — rode `python3 scripts/gerar-fixture-visual.py`",
    );
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
