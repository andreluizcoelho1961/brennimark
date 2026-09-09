import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { LIMITES_DE_IMPORTACAO } from "./limites";

/**
 * O gerador da fixture de escala, testado SEM gerar 100 MiB.
 *
 * A fixture plena existe para os portões da Fatia 1: 1.000 páginas e um tamanho
 * logo abaixo do teto de bytes, na mesma carga. Ela não pode ser versionada
 * (99 MiB) nem construída a cada execução do CI — seriam minutos de pipeline
 * para reprovar exatamente os mesmos defeitos que a escala pequena reprova.
 *
 * Então o CI exercita a MESMA estrutura em miniatura: mesmos cinco tipos de
 * página, mesmo índice de três níveis, mesmo caminho de código, em ~1,4 MiB.
 * O que a escala pequena não prova — comportamento sob 100 MiB de verdade — é
 * medição de transporte, e pertence à Etapa A.4, não ao CI.
 *
 * O teste roda a partir do diretório compilado em .tmp, então `__dirname` não
 * serve — o caminho sai da raiz do projeto, como em fixture-visual.test.ts.
 */
const raiz = process.cwd();
const GERADOR = path.join(raiz, "scripts", "gerar-fixture-escala.py");

interface PaginaLida {
  largura: number;
  altura: number;
  caracteres: number;
  imagens: number;
}

interface NoDeIndice {
  titulo: string;
  filhos: NoDeIndice[];
}

interface Geracao {
  saida: string;
  caminho: string;
  bytes: number;
  sha256: string;
}

const temporarios: string[] = [];

function gerar(extra: string[] = []): Geracao {
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), "escala-"));
  temporarios.push(destino);
  const saida = execFileSync(
    "python3",
    [GERADOR, "--escala", "pequena", "--destino", destino, ...extra],
    { encoding: "utf8" },
  );
  const caminho = path.join(destino, "escala-pequena-abaixo.pdf");
  const dados = fs.readFileSync(caminho);
  return {
    saida,
    caminho,
    bytes: dados.length,
    sha256: crypto.createHash("sha256").update(dados).digest("hex"),
  };
}

let primeira: Geracao | null = null;

function umaVez(): Geracao {
  if (!primeira) primeira = gerar();
  return primeira;
}

let paginas: PaginaLida[] = [];
let indice: NoDeIndice[] = [];

async function lerFixture() {
  if (paginas.length > 0) return;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dados = new Uint8Array(fs.readFileSync(umaVez().caminho));
  const doc = await pdfjs.getDocument({ data: dados }).promise;

  const lidas: PaginaLida[] = [];
  for (let numero = 1; numero <= doc.numPages; numero += 1) {
    const pagina = await doc.getPage(numero);
    const [x0, y0, x1, y1] = pagina.view;
    const conteudo = await pagina.getTextContent();
    const operadores = await pagina.getOperatorList();
    let imagens = 0;
    for (const fn of operadores.fnArray) {
      if (
        fn === pdfjs.OPS.paintImageXObject ||
        fn === pdfjs.OPS.paintInlineImageXObject
      ) {
        imagens += 1;
      }
    }
    lidas.push({
      largura: Math.abs(x1 - x0),
      altura: Math.abs(y1 - y0),
      caracteres: conteudo.items
        .map((item) => ("str" in item ? item.str : ""))
        .join("")
        .trim().length,
      imagens,
    });
    pagina.cleanup();
  }

  const bruto = (await doc.getOutline().catch(() => null)) as
    | { title?: string; items?: unknown[] }[]
    | null;
  const converter = (itens: { title?: string; items?: unknown[] }[]): NoDeIndice[] =>
    itens.map((item) => ({
      titulo: (item.title ?? "").trim(),
      filhos: item.items?.length
        ? converter(item.items as { title?: string; items?: unknown[] }[])
        : [],
    }));

  paginas = lidas;
  indice = bruto ? converter(bruto) : [];
}

const profundidade = (nos: NoDeIndice[]): number =>
  nos.length === 0 ? 0 : 1 + Math.max(...nos.map((no) => profundidade(no.filhos)));

test.after(() => {
  for (const dir of temporarios) fs.rmSync(dir, { recursive: true, force: true });
});

// ─── O PDF é um PDF ────────────────────────────────────────────────────────

test("o arquivo gerado abre como PDF válido, com páginas legíveis", async () => {
  // Um gerador que produzisse bytes plausíveis e estrutura quebrada passaria em
  // qualquer verificação de tamanho. Só abrir o arquivo com o mesmo leitor que
  // o produto usa prova que o xref e os objetos estão corretos.
  await lerFixture();
  assert.ok(paginas.length > 0, "o leitor não encontrou página nenhuma");
});

test("a estrutura tem as cinco composições de página que a fixture promete", async () => {
  await lerFixture();
  assert.ok(paginas.some((p) => p.altura > p.largura), "nenhuma página em retrato");
  assert.ok(paginas.some((p) => p.largura > p.altura), "nenhuma página em paisagem");
  assert.ok(paginas.some((p) => p.caracteres > 300), "nenhuma página de texto corrido");
  assert.ok(paginas.some((p) => p.imagens > 0), "nenhuma página com imagem");
  // A página muda é o caminho que `secoes.ts` descarta em silêncio, e o manual
  // real da GE não tinha uma única. Se ela sumir do gerador, o defeito volta a
  // não ter teste possível — e é aqui que isso precisa aparecer.
  assert.ok(paginas.some((p) => p.caracteres === 0), "nenhuma página sem texto extraível");
});

test("o índice declarado tem três níveis", async () => {
  await lerFixture();
  // Três, e não dois: é a profundidade que distingue a árvore preservada da
  // árvore curada. Um índice raso deixaria essa diferença sem sujeito de teste.
  assert.ok(indice.length > 0, "o PDF não declara índice");
  assert.equal(profundidade(indice), 3);
});

// ─── Determinismo ──────────────────────────────────────────────────────────

test("duas gerações com a mesma semente produzem bytes idênticos", () => {
  // Sem isto, comparar duas medições de transporte é comparar dois arquivos
  // diferentes e chamar a diferença de resultado.
  const a = umaVez();
  const b = gerar();
  assert.equal(b.sha256, a.sha256);
  assert.equal(b.bytes, a.bytes);
});

test("semente diferente produz arquivo diferente", () => {
  // A outra metade da afirmação: se qualquer semente desse o mesmo arquivo, o
  // teste acima estaria passando por acidente.
  const outra = gerar(["--semente", "7"]);
  assert.notEqual(outra.sha256, umaVez().sha256);
});

// ─── A guarda de sobrescrita ───────────────────────────────────────────────

test("gerar por cima de um arquivo existente falha sem --forcar", () => {
  const alvo = umaVez();
  const destino = path.dirname(alvo.caminho);
  assert.throws(
    () =>
      execFileSync(
        "python3",
        [GERADOR, "--escala", "pequena", "--destino", destino],
        { encoding: "utf8", stdio: "pipe" },
      ),
    /já existe/,
  );
  // E o arquivo que estava lá continua sendo o que era.
  const depois = crypto
    .createHash("sha256")
    .update(fs.readFileSync(alvo.caminho))
    .digest("hex");
  assert.equal(depois, alvo.sha256);
});

test("com --forcar, sobrescreve", () => {
  const alvo = umaVez();
  const destino = path.dirname(alvo.caminho);
  execFileSync(
    "python3",
    [GERADOR, "--escala", "pequena", "--destino", destino, "--forcar"],
    { encoding: "utf8" },
  );
  assert.ok(fs.existsSync(alvo.caminho));
});

// ─── O relatório ───────────────────────────────────────────────────────────

test("o relatório traz tamanho, páginas e sha256 conferíveis", () => {
  const g = umaVez();
  assert.match(g.saida, /bytes\s*:/);
  assert.match(g.saida, /páginas\s*:/);
  // O sha do relatório é o sha do arquivo — não um número decorativo.
  const casado = g.saida.match(/sha256\s*:\s*([0-9a-f]{64})/);
  assert.ok(casado, "o relatório não traz um sha256 de 64 dígitos");
  assert.equal(casado[1], g.sha256);
});

// ─── O gerador não pode divergir dos limites do produto ────────────────────

test("os limites espelhados no gerador são os limites de limites.ts", () => {
  // O gerador repete os dois tetos em Python porque não consegue importar o
  // módulo TypeScript. Repetição sem guarda é divergência marcada para
  // acontecer: mudar `maxBytes` aqui e esquecer o gerador produziria uma
  // fixture "abaixo do limite" que passa do limite, e a Fatia 1 mediria a
  // coisa errada sem que nada acusasse.
  const fonte = fs.readFileSync(GERADOR, "utf8");
  const bytes = fonte.match(/^LIMITE_BYTES = (\d+) \* MIB/m);
  assert.ok(bytes, "o gerador não declara LIMITE_BYTES onde o teste procura");
  assert.equal(Number(bytes[1]) * 1024 * 1024, LIMITES_DE_IMPORTACAO.maxBytes);

  const pags = fonte.match(/^LIMITE_PAGINAS = (\d+)/m);
  assert.ok(pags, "o gerador não declara LIMITE_PAGINAS onde o teste procura");
  assert.equal(Number(pags[1]), LIMITES_DE_IMPORTACAO.maxPaginas);
});

test("a escala plena declara exatamente as 1.000 páginas do teto", () => {
  // A fixture plena precisa bater no teto de páginas E no de bytes na mesma
  // carga. Se a soma das composições deixar de dar 1.000, ela para de testar o
  // teto de páginas e ninguém percebe — o arquivo continua abrindo.
  const fonte = fs.readFileSync(GERADOR, "utf8");
  const bloco = fonte.match(/"plena":\s*\{\s*"paginas":\s*\{([\s\S]*?)\}/);
  assert.ok(bloco, "o perfil plena não foi encontrado no gerador");
  const soma = [...bloco[1].matchAll(/:\s*(\d+)\s*,/g)].reduce(
    (t, m) => t + Number(m[1]),
    0,
  );
  assert.equal(soma, LIMITES_DE_IMPORTACAO.maxPaginas);
});
