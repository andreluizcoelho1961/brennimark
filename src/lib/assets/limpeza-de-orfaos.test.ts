import assert from "node:assert/strict";
import test from "node:test";
import {
  limparMateriaisOrfaos,
  segredoDoCronConfere,
  type PortasDaLimpeza,
  type ResultadoDaDrenagem,
} from "./limpeza-de-orfaos";

const SEGREDO = "segredo-do-cron-com-folga-32-car";

test("o segredo certo passa", () => {
  assert.equal(segredoDoCronConfere(`Bearer ${SEGREDO}`, SEGREDO), true);
});

test("sem cabeçalho, ou com outro segredo, não passa", () => {
  assert.equal(segredoDoCronConfere(null, SEGREDO), false);
  assert.equal(segredoDoCronConfere("", SEGREDO), false);
  assert.equal(segredoDoCronConfere(`Bearer ${SEGREDO}x`, SEGREDO), false);
  assert.equal(segredoDoCronConfere(`bearer ${SEGREDO}`, SEGREDO), false);
  assert.equal(segredoDoCronConfere(SEGREDO, SEGREDO), false);
});

test("segredo NÃO configurado fecha a rota — `Bearer undefined` não abre nada", () => {
  assert.equal(segredoDoCronConfere("Bearer undefined", undefined), false);
  assert.equal(segredoDoCronConfere("Bearer ", ""), false);
  assert.equal(segredoDoCronConfere("Bearer        ", "      "), false);
});

test("segredo curto demais é tratado como não configurado", () => {
  assert.equal(segredoDoCronConfere("Bearer curto", "curto"), false);
});

/** Portas falsas: um relógio que anda à mão e uma fila de respostas por conta. */
function portas(over: Partial<PortasDaLimpeza> & { drenagens?: Record<string, ResultadoDaDrenagem[]> } = {}) {
  const chamadas = { enfileirar: [] as number[], drenar: [] as string[] };
  let relogio = 0;
  const filas = over.drenagens ?? {};
  const p: PortasDaLimpeza = {
    enfileirar: over.enfileirar ?? (async (limite) => { chamadas.enfileirar.push(limite); return { dados: 3, erro: null }; }),
    contasComPendencia: over.contasComPendencia ?? (async () => ({ dados: Object.keys(filas), erro: null })),
    drenar: over.drenar ?? (async (conta) => {
      chamadas.drenar.push(conta);
      relogio += 1_000;
      return filas[conta]?.shift() ?? { removidos: 0, pendentes: 0, adiados: 0 };
    }),
    agora: over.agora ?? (() => relogio),
  };
  return { p, chamadas, avancar: (ms: number) => { relogio += ms; } };
}

test("enfileira com o limite, depois drena cada conta uma vez e soma", async () => {
  const { p, chamadas } = portas({
    drenagens: {
      a: [{ removidos: 2, pendentes: 0, adiados: 0 }],
      b: [{ removidos: 1, pendentes: 1, adiados: 1 }],
    },
  });
  const resumo = await limparMateriaisOrfaos(p);
  assert.deepEqual(chamadas.enfileirar, [500]);
  assert.deepEqual(chamadas.drenar, ["a", "b"]);
  assert.deepEqual(resumo, {
    enfileirados: 3, contas: 2, removidos: 3, pendentes: 1, adiados: 1, falhas: [], interrompida: false,
  });
});

test("a conta repetida na lista é drenada uma vez só", async () => {
  const { p, chamadas } = portas({ contasComPendencia: async () => ({ dados: ["a", "a", "b", "a"], erro: null }) });
  await limparMateriaisOrfaos(p);
  assert.deepEqual(chamadas.drenar, ["a", "b"]);
});

test("lote CHEIO de remoções pede outro lote; lote parcial encerra a conta", async () => {
  const { p, chamadas } = portas({
    drenagens: {
      a: [
        { removidos: 50, pendentes: 70, adiados: 0 },
        { removidos: 50, pendentes: 20, adiados: 0 },
        { removidos: 20, pendentes: 0, adiados: 0 },
        { removidos: 99, pendentes: 0, adiados: 0 },
      ],
    },
  });
  const resumo = await limparMateriaisOrfaos(p);
  assert.deepEqual(chamadas.drenar, ["a", "a", "a"]);
  assert.equal(resumo.removidos, 120);
  assert.equal(resumo.pendentes, 0, "o pendente é o do ÚLTIMO lote, não a soma");
});

test("lote cheio de FALHAS não repete: repetir agora daria o mesmo resultado", async () => {
  const { p, chamadas } = portas({ drenagens: { a: [{ removidos: 0, pendentes: 50, adiados: 0 }] } });
  await limparMateriaisOrfaos(p);
  assert.deepEqual(chamadas.drenar, ["a"]);
});

test("o orçamento acaba: para antes da próxima conta e diz que parou", async () => {
  const { p, chamadas } = portas({
    drenagens: { a: [{ removidos: 1, pendentes: 0, adiados: 0 }], b: [], c: [] },
  });
  const resumo = await limparMateriaisOrfaos(p, { orcamentoMs: 1_500 });
  // `a` gasta 1 s; `b` ainda cabe (1 s < 1,5 s) e gasta outro; `c` não.
  assert.deepEqual(chamadas.drenar, ["a", "b"]);
  assert.equal(resumo.interrompida, true);
  assert.equal(resumo.contas, 2);
});

test("o orçamento também corta a repetição dentro de uma conta", async () => {
  const cheio = { removidos: 50, pendentes: 500, adiados: 0 };
  const { p, chamadas } = portas({ drenagens: { a: [cheio, cheio, cheio, cheio, cheio] } });
  await limparMateriaisOrfaos(p, { orcamentoMs: 2_500 });
  assert.equal(chamadas.drenar.length, 3);
});

test("falhar ao enfileirar NÃO impede drenar o que já está na fila", async () => {
  const { p, chamadas } = portas({
    enfileirar: async () => ({ dados: null, erro: new Error("rpc caiu") }),
    drenagens: { a: [{ removidos: 4, pendentes: 0, adiados: 0 }] },
  });
  const resumo = await limparMateriaisOrfaos(p);
  assert.deepEqual(chamadas.drenar, ["a"]);
  assert.equal(resumo.enfileirados, null, "nulo, não zero: zero diria que não havia órfão");
  assert.equal(resumo.removidos, 4);
  assert.deepEqual(resumo.falhas, ["enfileirar"]);
});

test("sem a lista de contas, não drena nada e diz por quê", async () => {
  const { p, chamadas } = portas({ contasComPendencia: async () => ({ dados: null, erro: new Error("x") }) });
  const resumo = await limparMateriaisOrfaos(p);
  assert.deepEqual(chamadas.drenar, []);
  assert.deepEqual(resumo.falhas, ["listar contas"]);
});

test("uma conta que lança não derruba as outras", async () => {
  const drenadas: string[] = [];
  const { p } = portas({
    contasComPendencia: async () => ({ dados: ["a", "b"], erro: null }),
    drenar: async (conta) => {
      if (conta === "a") throw new Error("storage fora");
      drenadas.push(conta);
      return { removidos: 1, pendentes: 0, adiados: 0 };
    },
  });
  const resumo = await limparMateriaisOrfaos(p);
  assert.deepEqual(drenadas, ["b"]);
  assert.deepEqual(resumo.falhas, ["drenar a"]);
  assert.equal(resumo.removidos, 1);
});
