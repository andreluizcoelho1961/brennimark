import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { FAIXAS_DA_VITRINE, precoDaVitrine } from "./vitrine-de-planos";

const RAIZ = process.cwd();
const MIGRATION_DA_VENDA = readFileSync(path.join(RAIZ, "supabase/migrations/20261108200726_planos_da_escada_nomes_e_venda.sql"), "utf8");

test("a vitrine mostra os 8 planos que a migration de 08/11 abriu à venda, e só eles", () => {
  const codigos = FAIXAS_DA_VITRINE.flatMap((f) => [f.comIa.codigo, f.propria.codigo]);
  assert.equal(codigos.length, 8);
  assert.equal(new Set(codigos).size, 8);
  for (const codigo of codigos) {
    assert.ok(MIGRATION_DA_VENDA.includes(`'${codigo}'`), `${codigo} não está na migration que abre a venda`);
  }
  assert.ok(!codigos.some((c) => ["basico", "medio", "premium"].includes(c)), "os planos antigos saíram da vitrine");
});

test("a escada de preços aprovada em 07/11: sem IA 79/150/400/690, com IA 119/199/520/890", () => {
  assert.deepEqual(FAIXAS_DA_VITRINE.map((f) => f.propria.reais), [79, 150, 400, 690]);
  assert.deepEqual(FAIXAS_DA_VITRINE.map((f) => f.comIa.reais), [119, 199, 520, 890]);
  assert.deepEqual(FAIXAS_DA_VITRINE.map((f) => f.marcas), [1, 5, 15, 30]);
});

test("com IA custa mais que traga a sua IA na mesma faixa, e cada faixa custa mais que a anterior", () => {
  FAIXAS_DA_VITRINE.forEach((f, i) => {
    assert.ok(f.comIa.reais > f.propria.reais, f.id);
    if (i > 0) {
      assert.ok(f.propria.reais > FAIXAS_DA_VITRINE[i - 1].propria.reais, f.id);
      assert.ok(f.comIa.reais > FAIXAS_DA_VITRINE[i - 1].comIa.reais, f.id);
    }
  });
});

test("a tabela em dólar de 11/11: sem IA 19/35/89/149, com IA 29/45/115/189, sempre acima da conversão simples dos reais", () => {
  assert.deepEqual(FAIXAS_DA_VITRINE.map((f) => f.propria.dolares), [19, 35, 89, 149]);
  assert.deepEqual(FAIXAS_DA_VITRINE.map((f) => f.comIa.dolares), [29, 45, 115, 189]);
  for (const f of FAIXAS_DA_VITRINE) {
    for (const plano of [f.comIa, f.propria]) assert.ok(plano.dolares * 5.3 > plano.reais, plano.codigo);
    assert.ok(f.comIa.dolares > f.propria.dolares, f.id);
  }
});

test("o preço sai com o símbolo da moeda", () => {
  const ferro = FAIXAS_DA_VITRINE[1];
  assert.equal(precoDaVitrine(ferro.comIa, "BRL"), "R$ 199");
  assert.equal(precoDaVitrine(ferro.comIa, "USD"), "US$ 45");
});
