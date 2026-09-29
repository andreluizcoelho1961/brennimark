import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { CAMINHOS_DO_SITE, CAPITULOS_DA_HOME, PAGINAS_DO_SITE } from "./paginas";

/**
 * O mapa do site e as pastas de rota andam juntos.
 *
 * A lista decide o que o `proxy` deixa passar sem sessão. Uma página nova
 * criada só como pasta ficaria atrás do login para quem visita; uma entrada
 * na lista sem pasta abriria sem sessão um endereço que ninguém desenhou.
 */
const PASTA_DO_SITE = path.join(process.cwd(), "src/app/(site)");

test("cada página da lista tem a sua rota", () => {
  for (const { slug } of PAGINAS_DO_SITE) {
    assert.ok(existsSync(path.join(PASTA_DO_SITE, slug, "page.tsx")), `falta src/app/(site)/${slug}/page.tsx`);
  }
});

test("cada rota do site está na lista", () => {
  const pastas = readdirSync(PASTA_DO_SITE, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const slugs = new Set(PAGINAS_DO_SITE.map((p) => p.slug));
  for (const pasta of pastas) assert.ok(slugs.has(pasta), `src/app/(site)/${pasta} não está em PAGINAS_DO_SITE`);
});

test("os caminhos do site são a home e as páginas, e nada mais", () => {
  assert.equal(CAMINHOS_DO_SITE.size, PAGINAS_DO_SITE.length + 1);
  assert.ok(CAMINHOS_DO_SITE.has("/"));
  for (const caminho of CAMINHOS_DO_SITE) {
    assert.match(caminho, /^\/[a-z-]*$/, `${caminho} não é um caminho simples`);
  }
});

test("nenhum endereço do site pisa numa rota do produto", () => {
  const produto = readdirSync(path.join(process.cwd(), "src/app"), { withFileTypes: true })
    .filter((e) => e.isDirectory() && !e.name.startsWith("("))
    .map((e) => e.name);
  for (const { slug } of PAGINAS_DO_SITE) assert.ok(!produto.includes(slug), `/${slug} já é rota do produto`);
});

test("os capítulos da home têm âncoras únicas", () => {
  const ids = CAPITULOS_DA_HOME.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});
