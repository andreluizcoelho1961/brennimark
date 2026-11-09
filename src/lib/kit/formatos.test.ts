import assert from "node:assert/strict";
import test from "node:test";
import { formatoDoArquivo, motivoDoCabecalho as motivoDoCabecalhoBase, pesoDoFormato, textoDaRecusa } from "./formatos";
import { comTradutor, tradutorDeTeste } from "../i18n/catalogo-de-teste";

const pt = tradutorDeTeste("ferramentas.arquivos");
const en = tradutorDeTeste("ferramentas.arquivos", "en");
const motivoDoCabecalho = comTradutor(motivoDoCabecalhoBase, pt);

test("PDF e AI abrem como PDF, pelo nome ou pelo tipo", () => {
  assert.deepEqual(formatoDoArquivo("Logo horizontal.ai", "application/pdf"), { tipo: "pdf" });
  assert.deepEqual(formatoDoArquivo("logo.ai", ""), { tipo: "pdf" });
  assert.deepEqual(formatoDoArquivo("logo.AI", "application/postscript"), { tipo: "pdf" }, "o .ai vale pelo nome; o cabeçalho decide depois");
  assert.deepEqual(formatoDoArquivo("logo.pdf", ""), { tipo: "pdf" });
  assert.deepEqual(formatoDoArquivo("sem-extensao", "application/pdf"), { tipo: "pdf" });
});

test("as imagens que o navegador desenha", () => {
  for (const [nome, mime] of [["a.svg", "image/svg+xml"], ["a.png", "image/png"], ["a.jpg", "image/jpeg"], ["a.jpeg", "image/jpeg"], ["a.webp", "image/webp"], ["a.gif", "image/gif"], ["a.avif", "image/avif"]]) {
    assert.deepEqual(formatoDoArquivo(nome, ""), { tipo: "imagem", mime });
  }
  assert.deepEqual(formatoDoArquivo("sem-extensao", "image/png"), { tipo: "imagem", mime: "image/png" });
});

test("EPS, Affinity e Corel ficam fora, dizendo o formato e o que fazer", () => {
  for (const [nome, palavra] of [["a.eps", "EPS"], ["a.afdesign", "Affinity"], ["a.af", "Affinity"], ["a.cdr", "CorelDRAW"]]) {
    const f = formatoDoArquivo(nome, "");
    assert.equal(f.tipo, "fora");
    const texto = f.tipo === "fora" ? textoDaRecusa(f, pt) : "";
    assert.match(texto, new RegExp(palavra));
    assert.match(texto, /SVG ou PDF/);
  }
  assert.equal(formatoDoArquivo("sem-extensao", "application/postscript").tipo, "fora", "PostScript sem nome .ai é EPS");
  assert.equal(formatoDoArquivo("planilha.xlsx", "").tipo, "fora");
});

test("o cabeçalho: %PDF abre; .ai sem compatibilidade PDF começa com %!PS", () => {
  assert.equal(motivoDoCabecalho("%PDF-1.6\n%âãÏÓ", "logo.ai"), null);
  assert.match(motivoDoCabecalho("%!PS-Adobe-3.0", "logo.ai") ?? "", /sem "compatibilidade PDF"/);
  assert.match(motivoDoCabecalho("%!PS-Adobe-3.0 EPSF-3.0", "logo.pdf") ?? "", /EPS/);
  assert.match(motivoDoCabecalho("PK\u0003\u0004", "logo.pdf") ?? "", /não parece um PDF/);
});

test("vetor antes de bitmap: SVG, depois PDF/AI, depois imagem; fora é negativo", () => {
  assert.equal(pesoDoFormato("a.svg", ""), 2);
  assert.equal(pesoDoFormato("a.ai", "application/pdf"), 1);
  assert.equal(pesoDoFormato("a.png", ""), 0);
  assert.equal(pesoDoFormato("a.eps", ""), -1);
});

test("a recusa sai no idioma pedido", () => {
  const eps = formatoDoArquivo("logo.eps", "");
  assert.equal(eps.tipo, "fora");
  if (eps.tipo === "fora") {
    assert.match(textoDaRecusa(eps, pt), /EPS, que o Kit ainda não abre\. Quem edita a marca/);
    assert.match(textoDaRecusa(eps, en), /EPS, which Kit can't open yet\. Whoever edits the brand/);
  }
  assert.match(motivoDoCabecalhoBase("%!PS-Adobe-3.0", "logo.ai", en) ?? "", /without "PDF compatibility"/);
});
