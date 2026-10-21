import assert from "node:assert/strict";
import test from "node:test";
import { filtrarPorAudiencia, renderizarArtigo, separarCabecalho, textoPuro } from "./markdown";

const MD = `Texto comum.

:::site
Só no site.
:::

:::marca
Só na marca.
:::

Frase com {marca: trecho da marca} e {site: trecho do site}.`;

test("cada visão mostra o que é dela e some com o que é da outra", () => {
  const site = filtrarPorAudiencia(MD, "site");
  assert.match(site, /Só no site\./);
  assert.doesNotMatch(site, /Só na marca/);
  assert.match(site, /trecho do site/);
  assert.doesNotMatch(site, /trecho da marca/);

  const marca = filtrarPorAudiencia(MD, "marca");
  assert.match(marca, /Só na marca\./);
  assert.doesNotMatch(marca, /Só no site/);
  assert.match(marca, /trecho da marca/);
  assert.doesNotMatch(marca, /trecho do site/);
});

test("a visão 'tudo' mostra as duas e diz de qual é cada trecho", () => {
  const tudo = filtrarPorAudiencia(MD, "tudo");
  assert.match(tudo, /Só no site\./);
  assert.match(tudo, /Só na marca\./);
  assert.match(tudo, /No site, sem login/);
  assert.match(tudo, /Dentro de uma marca/);
  assert.match(tudo, /\(dentro de uma marca: trecho da marca\)/);
});

test("nenhuma marcação de audiência vaza para o HTML", () => {
  for (const a of ["site", "marca", "tudo"] as const) {
    const html = renderizarArtigo(MD, a);
    assert.doesNotMatch(html, /:::|\{marca:|\{site:/, `vazou em ${a}`);
  }
});

test("HTML cru e javascript: no Markdown viram texto e '#', não código", () => {
  const html = renderizarArtigo("<script>alert(1)</script>\n\n[x](javascript:alert(1))\n\n[ok](/ajuda)", "tudo");
  assert.doesNotMatch(html, /<script/i);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /javascript:/);
  assert.match(html, /<a href="\/ajuda">ok<\/a>/);
});

test("lista aninhada e tabela renderizam", () => {
  const html = renderizarArtigo("- a\n  - b\n\n| x | y |\n|---|---|\n| 1 | 2 |", "site");
  assert.match(html, /<ul>\s*<li>a\s*<ul>/);
  assert.match(html, /<table>/);
});

test("o cabeçalho falha alto quando falta campo", () => {
  assert.throws(() => separarCabecalho("sem cabeçalho", "x.md"), /falta o cabeçalho/);
  assert.throws(() => separarCabecalho("---\ntitulo: A\n---\ncorpo", "x.md"), /falta "resumo"/);
  const ok = separarCabecalho("---\ntitulo: A\nresumo: B\ncategoria: c\nordem: 2\nferramenta: kit\n---\ncorpo", "x.md");
  assert.equal(ok.cabecalho.ferramenta, "kit");
  assert.equal(ok.cabecalho.ordem, 2);
  assert.equal(ok.corpo, "corpo");
});

test("o texto da busca não leva marcação", () => {
  const t = textoPuro("## Título\n\n**negrito** e [link](/x) e `código`");
  assert.doesNotMatch(t, /[*#`\[\]]/);
  assert.match(t, /negrito e link e código/);
});
