import assert from "node:assert/strict";
import test from "node:test";
import { comparable, pageFromSnapshot, parseSnapshot } from "./version-snapshot";
import type { DocPageEntry } from "../../content/docs";

/**
 * A recuperação precisa devolver a página inteira.
 *
 * O defeito que estes testes protegem foi real: o gatilho já gravava `blocks`
 * no instantâneo, mas a leitura ignorava o campo. Recuperar uma página trazia
 * texto e imagens de volta e descartava em silêncio paletas, galerias e
 * territórios — o conteúdo que mais custa a produzir.
 */

const PAGINA_COMPLETA: DocPageEntry = {
  slug: "cores",
  group: "Sistema",
  title: "Cores",
  status: "ready",
  body: ["A paleta parte do vermelho institucional."],
  images: [{ src: "/a.png", alt: "aplicação" }],
  blocks: [
    {
      kind: "swatches",
      items: [{ name: "Vermelho", hex: "#E1251B" }],
    },
  ],
};

/** O que o gatilho grava, com as chaves do banco. */
function instantaneoDe(pagina: DocPageEntry) {
  return {
    slug: pagina.slug,
    group: pagina.group,
    title: pagina.title,
    status: pagina.status,
    body: pagina.body,
    images: pagina.images ?? [],
    blocks: pagina.blocks ?? [],
    sortOrder: 0,
  };
}

test("a página recuperada é idêntica à original — blocos inclusive", () => {
  const instantaneo = parseSnapshot(instantaneoDe(PAGINA_COMPLETA));
  assert.ok(instantaneo);
  const recuperada = pageFromSnapshot(instantaneo);

  assert.deepEqual(recuperada.body, PAGINA_COMPLETA.body);
  assert.deepEqual(recuperada.images, PAGINA_COMPLETA.images);
  assert.deepEqual(
    recuperada.blocks,
    PAGINA_COMPLETA.blocks,
    "os blocos são o conteúdo estruturado; perdê-los esvazia a recuperação",
  );
});

test("instantâneo anterior à coluna de blocos continua válido", () => {
  const antigo = instantaneoDe(PAGINA_COMPLETA) as Record<string, unknown>;
  delete antigo.blocks;
  const instantaneo = parseSnapshot(antigo);
  // A coluna nasceu depois; ausência não é defeito e não pode invalidar uma
  // versão que já estava gravada.
  assert.ok(instantaneo, "versão antiga precisa continuar recuperável");
  assert.equal(instantaneo.blocks, undefined);
});

test("bloco malformado não derruba a versão inteira", () => {
  const instantaneo = parseSnapshot({
    ...instantaneoDe(PAGINA_COMPLETA),
    blocks: [{ kind: "isso-nao-existe" }],
  });
  // Perder um bloco é aceitável; perder a única cópia da página não é.
  assert.ok(instantaneo);
  assert.equal(instantaneo.blocks, undefined);
  assert.deepEqual(instantaneo.body, PAGINA_COMPLETA.body);
});

test("instantâneo sem os campos obrigatórios é recusado", () => {
  assert.equal(parseSnapshot({ slug: "x" }), null);
  assert.equal(parseSnapshot({ ...instantaneoDe(PAGINA_COMPLETA), status: "aprovado" }), null);
  assert.equal(parseSnapshot(null), null);
});

test("a comparação entre versões enxerga mudança de bloco", () => {
  const antes = parseSnapshot(instantaneoDe(PAGINA_COMPLETA))!;
  const depois = parseSnapshot({
    ...instantaneoDe(PAGINA_COMPLETA),
    blocks: [{ kind: "swatches", items: [{ name: "Preto", hex: "#000000" }] }],
  })!;
  // Sem isto, trocar a paleta inteira apareceria no histórico como "Versão
  // republicada", sem dizer o que mudou.
  assert.notDeepEqual(comparable(antes)!.blocks, comparable(depois)!.blocks);
});
