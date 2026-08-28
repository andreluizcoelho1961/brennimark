import assert from "node:assert/strict";
import test from "node:test";
import type { DocPageEntry } from "../../content/docs";
import { buildSearchIndex, searchIndex } from "./index";

const docs: DocPageEntry[] = [
  {
    slug: "universo-visual/guia-de-cores",
    group: "Universo Visual",
    title: "Guia de cores",
    status: "ready",
    body: ["A área de proteção do logotipo equivale a duas vezes a faixa do anel."],
    blocks: [
      { kind: "swatches", items: [{ name: "Vermelho", hex: "#E1251B", rgb: "225 37 27" }] },
    ],
  },
  { slug: "tipografia", group: "Universo Visual", title: "Tipografia", status: "draft", body: [] },
  { slug: "tom-de-voz", group: "Universo Verbal", title: "Tom de voz", status: "pending", body: [] },
];

const destinos = [{ href: "/docs/biblioteca", label: "Biblioteca de assets" }];
const index = buildSearchIndex({ docs, destinations: destinos });

test("acha pelo título", () => {
  const r = searchIndex(index, "tipografia");
  assert.equal(r[0]?.href, "/docs/tipografia");
});

test("acha por valor dentro de um bloco — o que a V1 não fazia", () => {
  const r = searchIndex(index, "#E1251B");
  assert.equal(r[0]?.href, "/docs/universo-visual/guia-de-cores");
  assert.match(r[0].excerpt, /E1251B/);
});

test("acha por texto do corpo e devolve o trecho que casou", () => {
  const r = searchIndex(index, "área de proteção");
  assert.equal(r[0]?.href, "/docs/universo-visual/guia-de-cores");
  assert.match(r[0].excerpt, /área de proteção/i);
});

test("título pesa mais que corpo", () => {
  const r = searchIndex(index, "cores");
  assert.equal(r[0]?.title, "Guia de cores");
});

test("todo resultado de diretriz carrega o status editorial", () => {
  for (const r of searchIndex(index, "o")) {
    if (r.kind === "guideline") assert.ok(r.status, `${r.title} sem status`);
  }
});

test("destinos da plataforma entram na mesma busca", () => {
  const r = searchIndex(index, "biblioteca");
  assert.equal(r[0]?.kind, "destination");
  assert.equal(r[0]?.status, undefined);
});

test("consulta vazia não devolve nada, em vez de devolver tudo", () => {
  assert.deepEqual(searchIndex(index, "   "), []);
});

test("sem correspondência devolve lista vazia; nada é inventado", () => {
  assert.deepEqual(searchIndex(index, "zzzzzz"), []);
});

test("ignora acento e caixa", () => {
  assert.ok(searchIndex(index, "AREA DE PROTECAO").length > 0);
  assert.ok(searchIndex(index, "TOM DE VOZ").length > 0);
});
