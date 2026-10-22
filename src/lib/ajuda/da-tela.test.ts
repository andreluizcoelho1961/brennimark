import assert from "node:assert/strict";
import test from "node:test";
import { artigoDaTela } from "./da-tela";
import { listarArtigos } from "./artigos";

test("cada tela da marca e da conta leva ao seu artigo, em produção e na bancada", () => {
  const casos: [string, string | null][] = [
    ["/w/agencia/b/acme/docs/original", "manual-em-pdf"],
    ["/dev/marcas/acme/original", "manual-em-pdf"],
    ["/w/agencia/b/acme/docs/complementos", "complementos"],
    ["/w/agencia/b/acme/docs/kit", "kit"],
    ["/w/agencia/b/acme/docs/cores", "cores"],
    ["/w/agencia/b/acme/docs/grids", "grids"],
    ["/w/agencia/pessoas", "pessoas-e-acesso"],
    ["/w/agencia/links", "links-de-entrega"],
    ["/w/agencia/registros", "registros"],
    ["/w/agencia/configuracoes", "assinatura"],
    ["/w/agencia/b/acme/docs/admin", "tipografia-e-fontes"],
    ["/w/agencia/importar", "primeiros-passos"],
    ["/w/agencia/b/acme/docs/chat", "vini-max"],
    ["/w/agencia/b/acme/docs/historico/123", "vini-max"],
  ];
  for (const [caminho, esperado] of casos) assert.equal(artigoDaTela(caminho), esperado, caminho);
});

test("tela sem artigo devolve null: o painel mostra a lista", () => {
  assert.equal(artigoDaTela("/w/agencia"), null);
  assert.equal(artigoDaTela("/w/agencia/b/acme/docs/biblioteca"), null);
  assert.equal(artigoDaTela("/docs"), null);
  assert.equal(artigoDaTela("/"), null);
});

test("consulta e fragmento não atrapalham", () => {
  assert.equal(artigoDaTela("/w/agencia/pessoas?x=1#topo"), "pessoas-e-acesso");
});

test("todo artigo para onde uma tela aponta existe de verdade", () => {
  const existentes = new Set(listarArtigos().map((a) => a.slug));
  const telas = ["original", "complementos", "kit", "cores", "grids", "pessoas", "links", "registros", "configuracoes", "admin", "importar", "chat", "analise", "historico"];
  for (const t of telas) {
    const slug = artigoDaTela(`/w/c/${t}`);
    assert.ok(slug && existentes.has(slug), `${t} aponta para "${slug}", que não existe em src/content/ajuda`);
  }
});
