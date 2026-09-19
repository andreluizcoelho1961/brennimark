import assert from "node:assert/strict";
import test from "node:test";
import { codificarMapa, decodificarMapa, destinoDaCitacao, mapaDePaginas } from "./paginas-citadas";

/**
 * A citação leva à página — e a página vem do servidor, nunca do modelo.
 */

test("o mapa sai dos trechos entregues, com a primeira página de cada documento", () => {
  const mapa = mapaDePaginas([
    { documentSlug: "cores", pageStart: 14 },
    { documentSlug: "cores", pageStart: 12 },
    { documentSlug: "logo", pageStart: 5 },
    { documentSlug: "sem-pagina", pageStart: null },
  ]);
  assert.deepEqual(mapa, { "/docs/cores": 12, "/docs/logo": 5 });
});

test("o cabeçalho vai e volta, inclusive com acento", () => {
  const mapa = { "/docs/tipografia-e-família": 7 };
  const cabecalho = codificarMapa(mapa);
  assert.match(cabecalho, /^[\x20-\x7e]+$/, "cabeçalho HTTP precisa ser ASCII");
  assert.deepEqual(decodificarMapa(cabecalho), mapa);
});

test("cabeçalho ausente ou adulterado vira mapa vazio, sem página inventada", () => {
  assert.deepEqual(decodificarMapa(null), {});
  assert.deepEqual(decodificarMapa("%7Bquebrado"), {});
  assert.deepEqual(decodificarMapa(codificarMapa({ "/docs/x": -1 } as never)), {});
  assert.deepEqual(decodificarMapa(encodeURIComponent('{"https://fora.test":3}')), {});
  assert.deepEqual(decodificarMapa(encodeURIComponent("[1,2]")), {});
});

test("citação com página leva ao manual naquela página", () => {
  const base = "/w/conta/b/marca/docs";
  assert.deepEqual(destinoDaCitacao("/docs/cores", { "/docs/cores": 12 }, base, "7"), {
    href: "/w/conta/b/marca/docs/original?pagina=12&ir=7", pagina: 12,
  });
});

test("citação sem página conhecida abre o manual, sem inventar lugar", () => {
  const base = "/w/conta/b/marca/docs";
  assert.deepEqual(destinoDaCitacao("/docs/inventada", { "/docs/cores": 12 }, base, "7"), {
    href: "/w/conta/b/marca/docs/original", pagina: null,
  });
});
