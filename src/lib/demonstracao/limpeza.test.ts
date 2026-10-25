import assert from "node:assert/strict";
import test from "node:test";
import { LIMITE_POR_RODADA, rodarLimpezaDoTour, type PortasDaLimpeza } from "./limpeza";

function portas(sobre: Partial<PortasDaLimpeza> & { tour?: Set<string> } = {}) {
  const apagados: string[] = [];
  const p: PortasDaLimpeza = {
    vencidos: async () => [],
    orfaos: async () => [],
    ehDoTour: async (id) => (sobre.tour ? sobre.tour.has(id) : true),
    apagar: async (id) => { apagados.push(id); },
    ...sobre,
  };
  return { p, apagados };
}

test("apaga vencidos e órfãos, uma vez cada (sem duplicar)", async () => {
  const { p, apagados } = portas({ vencidos: async () => ["a", "b"], orfaos: async () => ["b", "c"] });
  const r = await rodarLimpezaDoTour(p);
  assert.deepEqual(apagados, ["a", "b", "c"]);
  assert.deepEqual(r, { apagados: 3, recusados: 0, restantes: 0, falhas: [] });
});

test("usuário que a conferência não reconhece como do tour NUNCA é apagado", async () => {
  const { p, apagados } = portas({ vencidos: async () => ["tour1", "conta-real"], tour: new Set(["tour1"]) });
  const r = await rodarLimpezaDoTour(p);
  assert.deepEqual(apagados, ["tour1"]);
  assert.equal(r.recusados, 1);
});

test("uma falha não derruba o resto e aparece no resumo", async () => {
  const apagados: string[] = [];
  const { p } = portas({
    vencidos: async () => ["a", "b", "c"],
    apagar: async (id) => { if (id === "b") throw new Error("deleteUser: 500"); apagados.push(id); },
  });
  const r = await rodarLimpezaDoTour(p);
  assert.deepEqual(apagados, ["a", "c"]);
  assert.equal(r.apagados, 2);
  assert.equal(r.falhas.length, 1);
  assert.match(r.falhas[0], /deleteUser: 500/);
});

test("falha ao conferir também vira falha, sem apagar", async () => {
  const { p, apagados } = portas({ vencidos: async () => ["a"], ehDoTour: async () => { throw new Error("rede"); } });
  const r = await rodarLimpezaDoTour(p);
  assert.deepEqual(apagados, []);
  assert.equal(r.falhas.length, 1);
});

test("no máximo uma rodada por vez; o resto fica para amanhã", async () => {
  const ids = Array.from({ length: LIMITE_POR_RODADA + 30 }, (_, i) => `u${i}`);
  const { p, apagados } = portas({ vencidos: async () => ids });
  const r = await rodarLimpezaDoTour(p);
  assert.equal(apagados.length, LIMITE_POR_RODADA);
  assert.equal(r.restantes, 30);
});

test("lista vazia não faz nada", async () => {
  const { p, apagados } = portas();
  assert.deepEqual(await rodarLimpezaDoTour(p), { apagados: 0, recusados: 0, restantes: 0, falhas: [] });
  assert.deepEqual(apagados, []);
});
