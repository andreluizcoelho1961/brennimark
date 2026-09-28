import assert from "node:assert/strict";
import test from "node:test";
import { diaDeReferencia, dinheiro, emReais, intervaloDoMes, tamanho, totaisPorConta, usoDoLimite, type LinhaDeArmazenamento, type LinhaDeIa } from "./custos";

const agora = new Date("2026-09-28T15:00:00Z");

test("o mês é o de Brasília, em UTC, e o fim é exclusivo", () => {
  assert.deepEqual(intervaloDoMes("2026-09", agora), { mes: "2026-09", inicio: "2026-09-01T03:00:00.000Z", fim: "2026-10-01T03:00:00.000Z" });
  assert.deepEqual(intervaloDoMes("2026-12", agora).fim, "2027-01-01T03:00:00.000Z");
  // Mês torto vira o atual.
  assert.equal(intervaloDoMes("2026-13", agora).mes, "2026-09");
  assert.equal(intervaloDoMes(null, agora).mes, "2026-09");
  // Às 23h de 30/11 em Brasília já é dezembro em UTC — mas o mês atual é novembro.
  assert.equal(intervaloDoMes(null, new Date("2026-12-01T02:00:00Z")).mes, "2026-11");
});

test("a fotografia de armazenamento: o último dia do mês, ou hoje no mês corrente", () => {
  assert.equal(diaDeReferencia("2026-08", agora), "2026-08-31");
  assert.equal(diaDeReferencia("2026-09", agora), "2026-09-28");
  assert.equal(diaDeReferencia("2026-02", agora), "2026-02-28");
});

test("por conta e por marca, somando modelos e tipos de arquivo; quem custa mais primeiro", () => {
  const ia: LinhaDeIa[] = [
    { workspace_id: "w1", conta: "Agência", brand_id: "a", marca: "Bradesco", provider: "google", model: "g", currency: "USD", execucoes: 40, tokens_entrada: 600_000, tokens_saida: 30_000, custo_micros: 1_500_000, sem_uso_medido: 1 },
    { workspace_id: "w1", conta: "Agência", brand_id: "a", marca: "Bradesco", provider: "groq", model: "q", currency: "USD", execucoes: 2, tokens_entrada: 8_000, tokens_saida: 500, custo_micros: 10_000, sem_uso_medido: 0 },
    { workspace_id: "w1", conta: "Agência", brand_id: "b", marca: "Sony", provider: "google", model: "g", currency: "USD", execucoes: 5, tokens_entrada: 40_000, tokens_saida: 2_000, custo_micros: 277_698, sem_uso_medido: 0 },
    { workspace_id: "w2", conta: "Outra", brand_id: "c", marca: "C", provider: "google", model: "g", currency: "USD", execucoes: 1, tokens_entrada: 1, tokens_saida: 1, custo_micros: 5, sem_uso_medido: 0 },
  ];
  const arm: LinhaDeArmazenamento[] = [
    { workspace_id: "w1", conta: "Agência", brand_id: "a", marca: "Bradesco", bucket_id: "brand-assets", dia: "2026-09-28", objetos: 50, bytes: 10_000_000 },
    { workspace_id: "w1", conta: "Agência", brand_id: "a", marca: "Bradesco", bucket_id: "brand-imports", dia: "2026-09-28", objetos: 1, bytes: 5_000_000 },
    { workspace_id: "w1", conta: "Agência", brand_id: null, marca: null, bucket_id: "brand-imports", dia: "2026-09-28", objetos: 1, bytes: 1_000 },
  ];
  const [primeira, segunda] = totaisPorConta(ia, arm);
  assert.equal(primeira.conta, "Agência");
  assert.equal(primeira.execucoes, 47);
  assert.equal(primeira.custo_micros, 1_787_698);
  assert.equal(primeira.sem_uso_medido, 1);
  assert.equal(primeira.bytes, 15_001_000);
  assert.deepEqual(primeira.marcas.map((m) => [m.marca, m.execucoes, m.custo_micros, m.bytes]), [
    ["Bradesco", 42, 1_510_000, 15_000_000], ["Sony", 5, 277_698, 0], ["Sem marca", 0, 0, 1_000],
  ]);
  assert.equal(segunda.conta, "Outra");
});

test("dinheiro, reais pela cotação digitada, e tamanho", () => {
  assert.equal(dinheiro(1_787_698), "US$ 1,79");
  assert.equal(dinheiro(38_000), "US$ 0,04");
  assert.equal(dinheiro(40), "US$ 0,0000");
  assert.equal(dinheiro(400), "US$ 0,0004");
  assert.equal(emReais(1_787_698, 5.4), "≈ R$ 9,65");
  assert.equal(emReais(1_787_698, null), null);
  assert.equal(emReais(1_787_698, 0), null);
  assert.equal(tamanho(512), "512 B");
  assert.equal(tamanho(15_001_000), "14,3 MB");
});

test("o limite do dia: alerta a partir de 80%, esgotado em 100%, e desligado quando a trava está puxada", () => {
  assert.deepEqual(usoDoLimite({ limit_micros: 1_000_000, gasto_hoje_micros: 500_000, kill_switch: false }), { pct: 50, estado: "ok" });
  assert.deepEqual(usoDoLimite({ limit_micros: 1_000_000, gasto_hoje_micros: 800_000, kill_switch: false }), { pct: 80, estado: "alerta" });
  assert.deepEqual(usoDoLimite({ limit_micros: 1_000_000, gasto_hoje_micros: 1_100_000, kill_switch: false }), { pct: 110, estado: "esgotado" });
  assert.deepEqual(usoDoLimite({ limit_micros: 1_000_000, gasto_hoje_micros: 0, kill_switch: true }), { pct: 0, estado: "desligado" });
});
