import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { categoriasDoIdioma, CATEGORIAS, listarArtigos } from "./artigos";
import { renderizarArtigo } from "./markdown";

/**
 * A Central de ajuda em inglês tem de seguir o português: cada artigo existe
 * nos dois idiomas e tem a MESMA estrutura (seções, blocos de site/marca,
 * links, tabelas). Sem isto, um artigo traduzido pela metade ou desencontrado
 * do original só aparece quando alguém lê em inglês.
 */
/** Acento ou palavra de ligação do português: basta uma para a linha ser suspeita. */
const parecePortugues = (texto: string) => /[áàâãéêíóôõúüç]|\b(não|para|com|uma|você|seu|sua|dos|das|são|marca)\b/i.test(texto);

const PASTA = path.join(process.cwd(), "src", "content", "ajuda");
const arquivos = fs.readdirSync(PASTA).filter((f) => f.endsWith(".md"));

const contar = (texto: string, re: RegExp) => (texto.match(re) ?? []).length;
const estrutura = (md: string) => ({
  secoes: contar(md, /^## /gm),
  blocos: contar(md, /^:::(site|marca)/gm),
  marcas: contar(md, /\{(site|marca): /g),
  // `/suporte` e `/ajuda#suporte` são o mesmo destino (a seção de suporte da Central).
  links: [...md.matchAll(/\]\((\/[^)]*)\)/g)].map((m) => (m[1] === "/suporte" ? "/ajuda#suporte" : m[1])).sort(),
  linhasDeTabela: contar(md, /^\|/gm),
  itens: contar(md, /^\s*(- |\d+\. )/gm),
  codigos: [...md.matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort(),
});

test("todo artigo em português tem o seu em inglês, com o mesmo cabeçalho e a mesma estrutura", () => {
  const pt = listarArtigos("pt-BR");
  const en = listarArtigos("en");
  assert.equal(en.length, pt.length);
  for (const a of pt) {
    assert.ok(fs.existsSync(path.join(PASTA, "en", `${a.slug}.md`)), `${a.slug}: falta a tradução em src/content/ajuda/en`);
    const b = en.find((x) => x.slug === a.slug)!;
    assert.equal(b.categoria, a.categoria, `${a.slug}: categoria`);
    assert.equal(b.ferramenta, a.ferramenta, `${a.slug}: ferramenta`);
    assert.equal(b.ordem, a.ordem, `${a.slug}: ordem`);
    assert.deepEqual(estrutura(b.corpo), estrutura(a.corpo), `${a.slug}: estrutura diferente do original`);
  }
});

test("o inglês não deixa frase em português", () => {
  for (const f of arquivos) {
    const md = fs.readFileSync(path.join(PASTA, "en", f), "utf8");
    // Pedaços que são nome próprio ou arquivo, não frase: ficam de fora.
    const limpo = md.replace(/^(categoria|ferramenta):.*$/gm, "").replace(/:::(site|marca)|\{(site|marca): /g, "").replace(/`[^`]*`/g, "").replace(/Brasília/g, "Brasilia").replace(/\*\*brennimark\.com\/login\*\*/g, "");
    const achadas = limpo
      .split("\n")
      .map((l) => l.replace(/[*_>#|]/g, " ").trim())
      .filter((l) => l && parecePortugues(l));
    assert.deepEqual(achadas, [], `${f}: linha em português no artigo em inglês`);
  }
});

test("as categorias e o rótulo das visões também têm inglês", () => {
  const en = categoriasDoIdioma("en");
  assert.equal(en.length, CATEGORIAS.length);
  for (const c of en) assert.ok(!parecePortugues(`${c.titulo} ${c.descricao}`), c.slug);
  const md = ":::site\nA\n:::\n\n:::marca\nB\n:::\n";
  assert.match(renderizarArtigo(md, "tudo", "en"), /On the site, no login/);
  assert.match(renderizarArtigo(md, "tudo", "pt-BR"), /No site, sem login/);
});

test("o link interno do artigo sai no endereço do idioma do leitor", () => {
  const md = "Veja [isto](/ajuda/kit) e [aquilo](/licenca-de-fontes) e [fora](https://exemplo.com).";
  const en = renderizarArtigo(md, "tudo", "en");
  assert.match(en, /href="\/en\/help\/kit"/);
  assert.match(en, /href="\/en\/font-license"/);
  assert.match(en, /href="https:\/\/exemplo\.com"/);
  assert.match(renderizarArtigo(md, "tudo", "pt-BR"), /href="\/ajuda\/kit"/);
});
