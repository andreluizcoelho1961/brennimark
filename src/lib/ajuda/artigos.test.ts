import assert from "node:assert/strict";
import test from "node:test";
import { CATEGORIAS, artigoDaFerramenta, listarArtigos } from "./artigos";
import { renderizarArtigo } from "./markdown";

/**
 * Os artigos de ajuda são conteúdo do produto e precisam andar com o código:
 * um arquivo sem cabeçalho, numa categoria que não existe, ou uma ferramenta
 * sem o seu "Como usar", quebraria a página só em produção.
 */
test("todo artigo tem categoria conhecida, endereço único e corpo", () => {
  const artigos = listarArtigos();
  assert.ok(artigos.length >= 4);
  const slugs = new Set<string>();
  for (const a of artigos) {
    assert.ok(CATEGORIAS.some((c) => c.slug === a.categoria), `${a.slug}: categoria`);
    assert.ok(!slugs.has(a.slug), `slug repetido: ${a.slug}`);
    slugs.add(a.slug);
    assert.ok(a.corpo.length > 200, `${a.slug}: corpo curto demais`);
  }
});

test("Cores, Grids e Kit têm o seu 'Como usar', e cada um em uma única categoria", () => {
  for (const f of ["cores", "grids", "kit"] as const) {
    const a = artigoDaFerramenta(f);
    assert.equal(a.ferramenta, f);
    assert.equal(a.categoria, "materiais-da-marca");
  }
});

test("os artigos das ferramentas têm as duas visões, e elas diferem", () => {
  for (const f of ["cores", "grids", "kit"] as const) {
    const { corpo } = artigoDaFerramenta(f);
    const site = renderizarArtigo(corpo, "site");
    const marca = renderizarArtigo(corpo, "marca");
    assert.notEqual(site, marca, `${f}: as duas visões ficaram iguais`);
    assert.ok(site.length > 500 && marca.length > 500, `${f}: visão vazia`);
  }
});

// O codinome legado já é barrado em todo o repositório por `src/platform/codinome.test.ts`.
test("o artigo não leva marca de rascunho esquecida", () => {
  for (const a of listarArtigos()) {
    assert.doesNotMatch(a.corpo, /⚠️/, `${a.slug}: marca de rascunho esquecida`);
  }
});
