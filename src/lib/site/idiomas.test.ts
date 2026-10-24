import assert from "node:assert/strict";
import test from "node:test";
import { PAGINAS_DO_SITE } from "./paginas";
import { PAGINAS_TRADUZIDAS, caminhoDoSite, caminhoNoOutroIdioma, caminhoPtDeOutroIdioma, paginaTraduzida } from "./idiomas";

test("o português não leva prefixo, e o inglês leva o endereço traduzido", () => {
  assert.equal(caminhoDoSite("pt-BR", "/agencias"), "/agencias");
  assert.equal(caminhoDoSite("en", "/"), "/en");
  assert.equal(caminhoDoSite("en", "/agencias"), "/en/agencies");
  assert.equal(caminhoDoSite("en", "/ferramentas/janela/kit"), "/en/tools/window/kit");
  assert.equal(caminhoDoSite("en", "/ajuda/categoria/primeiros-passos"), "/en/help/category/primeiros-passos");
  // Âncora e query ficam como vieram.
  assert.equal(caminhoDoSite("en", "/ajuda#suporte"), "/en/help#suporte");
  assert.equal(caminhoDoSite("en", "/materiais#entrega"), "/en/materials#entrega");
});

test("ida e volta: todo endereço do site sobrevive à tradução", () => {
  for (const { slug } of PAGINAS_DO_SITE) {
    const ingles = caminhoDoSite("en", `/${slug}`);
    assert.equal(caminhoPtDeOutroIdioma("en", ingles.slice(3)), `/${slug}`, `${slug} não volta`);
  }
  for (const f of ["/ferramentas/kit", "/ferramentas/cores", "/ferramentas/grids", "/ferramentas/janela/kit", "/ajuda/categoria/x"]) {
    assert.equal(caminhoPtDeOutroIdioma("en", caminhoDoSite("en", f).slice(3)), f, f);
  }
});

test("cada página do menu tem endereço próprio em inglês (nenhum colide)", () => {
  const ingles = PAGINAS_DO_SITE.map((p) => caminhoDoSite("en", `/${p.slug}`));
  assert.equal(new Set(ingles).size, ingles.length);
});

test("pasta em português não é endereço em inglês", () => {
  assert.equal(caminhoPtDeOutroIdioma("en", "/agencias"), null);
  assert.equal(caminhoPtDeOutroIdioma("en", "/ajuda"), null);
  assert.equal(caminhoPtDeOutroIdioma("en", "/"), "/");
});

test("só vale como traduzida a página declarada, e toda declarada existe no site", () => {
  assert.equal(paginaTraduzida("pt-BR", "/qualquer"), true);
  assert.equal(paginaTraduzida("en", "/manifesto"), true);
  assert.equal(paginaTraduzida("en", "/vini"), true);
  assert.equal(paginaTraduzida("en", "/ajuda"), false);
  assert.equal(paginaTraduzida("en", "/"), false);
  const traduzidas = PAGINAS_TRADUZIDAS.en;
  assert.ok(traduzidas !== "todas");
  const slugs = new Set(PAGINAS_DO_SITE.map((p) => p.slug));
  for (const t of traduzidas as ReadonlySet<string>) assert.ok(slugs.has(t), `${t} está em PAGINAS_TRADUZIDAS mas não existe no site`);
});

test("o botão de idioma leva à mesma página no outro idioma", () => {
  assert.equal(caminhoNoOutroIdioma("/agencias", "en"), "/en/agencies");
  assert.equal(caminhoNoOutroIdioma("/", "en"), "/en");
  assert.equal(caminhoNoOutroIdioma("/en/agencies", "pt-BR"), "/agencias");
  assert.equal(caminhoNoOutroIdioma("/en", "pt-BR"), "/");
  assert.equal(caminhoNoOutroIdioma("/en/help/category/x", "pt-BR"), "/ajuda/categoria/x");
});
