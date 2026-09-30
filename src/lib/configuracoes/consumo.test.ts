import assert from "node:assert/strict";
import test from "node:test";
import { inicioUtc, percentualDoTeto, resumoDoConsumo, type GastoDoRazao } from "./consumo";

const AGORA = new Date("2026-09-30T02:30:00Z"); // 29/09, 23h30 em Brasília; 30/09 em UTC
const UM = { id: "m1", nome: "Marca Um" };
const DOIS = { id: "m2", nome: "Marca Dois" };

const base = {
  mes: "2026-09",
  marcas: [DOIS, UM],
  execucoes: [],
  gasto: [],
  armazenamento: [],
  orcamentos: [],
  fotografia: null,
  agora: AGORA,
};

test("o teto usa o dia e o mês em UTC, como a reserva no banco", () => {
  assert.deepEqual(inicioUtc(AGORA), { dia: "2026-09-30T00:00:00.000Z", mes: "2026-09-01T00:00:00.000Z" });
});

test("o percentual soma o consolidado e, sem ele, o reservado; ignora o liberado e o de antes", () => {
  const gasto: GastoDoRazao[] = [
    { status: "settled", reserved_micros: 900, settled_micros: 300, created_at: "2026-09-30T01:00:00Z" },
    { status: "reserved", reserved_micros: 200, settled_micros: null, created_at: "2026-09-30T02:00:00Z" },
    { status: "released", reserved_micros: 5000, settled_micros: null, created_at: "2026-09-30T02:10:00Z" },
    { status: "settled", reserved_micros: 900, settled_micros: 700, created_at: "2026-09-29T23:59:59Z" },
  ];
  assert.deepEqual(percentualDoTeto(gasto, "2026-09-30T00:00:00.000Z", 1000), { pct: 50, estado: "ok" });
  assert.deepEqual(percentualDoTeto(gasto, "2026-09-01T00:00:00.000Z", 1500), { pct: 80, estado: "alerta" });
  assert.deepEqual(percentualDoTeto(gasto, "2026-09-01T00:00:00.000Z", 1200), { pct: 100, estado: "esgotado" });
  assert.equal(percentualDoTeto([], "2026-09-01T00:00:00.000Z", 0).estado, "esgotado");
});

test("conta por marca e por tipo; marca sem uso aparece com zero", () => {
  const r = resumoDoConsumo({
    ...base,
    execucoes: [
      { brand_id: "m1", task: "assist" }, { brand_id: "m1", task: "assist" },
      { brand_id: "m1", task: "analyse-image" }, { brand_id: "m1", task: "prompt" },
      { brand_id: "m1", task: "tarefa-desconhecida" },
    ],
  });
  assert.deepEqual(r.marcas.map((m) => [m.nome, m.perguntas, m.analises, m.prompts]), [
    ["Marca Dois", 0, 0, 0],
    ["Marca Um", 2, 1, 1],
  ]);
  assert.deepEqual([r.totais.perguntas, r.totais.analises, r.totais.prompts], [2, 1, 1]);
});

test("armazenamento por tipo; o que não é marca viva vem depois, com nome honesto", () => {
  const r = resumoDoConsumo({
    ...base,
    armazenamento: [
      { brand_id: "m1", bucket_id: "brand-imports", bytes: 1000 },
      { brand_id: "m1", bucket_id: "brand-assets", bytes: 200 },
      { brand_id: "m1", bucket_id: "analysis-evidence", bytes: 30 },
      { brand_id: null, bucket_id: "brand-imports", bytes: 7 },
      { brand_id: "apagada", bucket_id: "brand-assets", bytes: 5 },
    ],
    fotografia: "2026-09-29",
  });
  assert.deepEqual(r.marcas.map((m) => m.nome), ["Marca Dois", "Marca Um", "Marca apagada", "Sem marca"]);
  const um = r.marcas.find((m) => m.id === "m1")!;
  assert.deepEqual([um.manuais_bytes, um.materiais_bytes, um.pecas_bytes], [1000, 200, 30]);
  assert.equal(r.totais.manuais_bytes + r.totais.materiais_bytes + r.totais.pecas_bytes, 1242);
  assert.equal(r.fotografia, "2026-09-29");
});

test("tetos da conta (dia e mês) e pausas da conta e da marca", () => {
  const r = resumoDoConsumo({
    ...base,
    gasto: [{ status: "settled", reserved_micros: 0, settled_micros: 250, created_at: "2026-09-30T01:00:00Z" }],
    orcamentos: [
      { brand_id: null, period: "daily", limit_micros: 1000, kill_switch: false },
      { brand_id: null, period: "monthly", limit_micros: 10000, kill_switch: false },
      // Linha de marca só para a trava, sem teto próprio: não vira teto na tela.
      { brand_id: "m2", period: "daily", limit_micros: null, kill_switch: true },
    ],
  });
  assert.deepEqual(r.tetos, [
    { periodo: "dia", pct: 25, estado: "ok" },
    { periodo: "mes", pct: 3, estado: "ok" },
  ]);
  assert.equal(r.contaPausada, false);
  assert.deepEqual(r.marcas.filter((m) => m.pausada).map((m) => m.id), ["m2"]);

  const semMensal = resumoDoConsumo({ ...base, orcamentos: [{ brand_id: null, period: "daily", limit_micros: 1000, kill_switch: true }] });
  assert.deepEqual(semMensal.tetos.map((t) => t.periodo), ["dia"]);
  assert.equal(semMensal.contaPausada, true);
});

test("nada em dinheiro sai do resumo (decisão de 30/09: só uso e percentual)", () => {
  const r = resumoDoConsumo({
    ...base,
    gasto: [{ status: "settled", reserved_micros: 123456, settled_micros: 654321, created_at: "2026-09-30T01:00:00Z" }],
    orcamentos: [{ brand_id: null, period: "daily", limit_micros: 987654, kill_switch: false }],
  });
  const json = JSON.stringify(r);
  assert.doesNotMatch(json, /micros|123456|654321|987654|USD|BRL/);
});
