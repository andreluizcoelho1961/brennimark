import assert from "node:assert/strict";
import test from "node:test";
import {
  descreverAcao, descreverAcesso, intervalo, lerFiltros, mesclarPorData, proximoCursor, quandoCurto,
} from "./registros";

const q = (s: string) => new URLSearchParams(s);
const MARCA = "d87b93f3-81d8-49f1-a8ef-9371ba05464c";

test("os filtros chegam conferidos; o que não passa vira 'sem filtro', nunca erro", () => {
  assert.deepEqual(lerFiltros(q(`aba=acessos&marca=${MARCA}&pessoa=Ana@Agencia.com&de=2026-09-01&ate=2026-09-28`)), {
    aba: "acessos", marca: MARCA, pessoa: "ana@agencia.com", de: "2026-09-01", ate: "2026-09-28", antes: null,
  });
  const torto = lerFiltros(q("aba=tudo&marca=bradesco&pessoa=a,b)&de=ontem&ate=2026-13&antes=nunca"));
  assert.deepEqual(torto, { aba: "downloads", marca: null, pessoa: null, de: null, ate: null, antes: null });
});

test("o trecho de pessoa não carrega sintaxe do PostgREST", () => {
  // Vírgula, parêntese e asterisco mudariam o sentido de um .or()/ilike.
  for (const bruto of ["a,b", "a)", "*", "50%", "x".repeat(81), "'; drop", "a\\b"]) {
    assert.equal(lerFiltros(q(`pessoa=${encodeURIComponent(bruto)}`)).pessoa, null, bruto);
  }
  assert.equal(lerFiltros(q("pessoa=conta-removida-7f3a2c")).pessoa, "conta-removida-7f3a2c");
  // O histórico de conteúdo guarda o NOME: acento e espaço passam.
  assert.equal(lerFiltros(q(`pessoa=${encodeURIComponent("  André   Coelho ")}`)).pessoa, "andré coelho");
});

test("o intervalo usa o horário de Brasília, e o topo é o menor entre o fim do dia e o cursor", () => {
  assert.deepEqual(intervalo({ de: "2026-09-28", ate: "2026-09-28", antes: null }), {
    desde: "2026-09-28T03:00:00.000Z", ate: "2026-09-29T03:00:00.000Z",
  });
  // Cursor dentro do dia: vale o cursor.
  assert.deepEqual(intervalo({ de: null, ate: "2026-09-28", antes: "2026-09-28T12:00:00.000Z" }), {
    desde: null, ate: "2026-09-28T12:00:00.000Z",
  });
  assert.deepEqual(intervalo({ de: null, ate: null, antes: null }), { desde: null, ate: null });
});

test("materiais e manual numa lista só, do mais recente, cortada na página", () => {
  const materiais = [{ quando: "2026-09-28T10:00:00Z", id: "m1" }, { quando: "2026-09-26T10:00:00Z", id: "m2" }];
  const manual = [{ quando: "2026-09-27T10:00:00Z", id: "p1" }];
  assert.deepEqual(mesclarPorData([materiais, manual]).map((l) => l.id), ["m1", "p1", "m2"]);
  assert.deepEqual(mesclarPorData([materiais, manual], 2).map((l) => l.id), ["m1", "p1"]);
  // Próxima página só quando a atual veio cheia.
  assert.equal(proximoCursor(mesclarPorData([materiais, manual], 2), 2), "2026-09-27T10:00:00Z");
  assert.equal(proximoCursor(mesclarPorData([materiais, manual], 5), 5), null);
});

test("a mudança de acesso em uma frase, com as capacidades pelo nome da tela", () => {
  assert.equal(descreverAcesso({ acao: "concedido", antes: [], depois: ["consultar"] }), "concedido: consultar");
  assert.equal(descreverAcesso({ acao: "alterado", antes: ["consultar"], depois: ["consultar", "editar"] }), "consultar → consultar, editar");
  assert.equal(descreverAcesso({ acao: "revogado", antes: ["consultar", "aprovar"], depois: [] }), "revogado (tinha: consultar, aprovar)");
  assert.equal(descreverAcesso({ acao: "concedido", antes: [], depois: ["administrar"] }, true), "granted: manage");
  assert.equal(descreverAcao("published"), "publicou");
  assert.equal(descreverAcao("restored_to_matrix"), "recuperou uma versão");
});

test("data e hora de Brasília, curtas; o ano só aparece quando não é o corrente", () => {
  const agora = new Date("2026-09-28T15:00:00Z");
  assert.equal(quandoCurto("2026-09-28T12:13:10Z", agora), "28/09 09:13");
  assert.equal(quandoCurto("2025-12-31T23:30:00Z", agora), "31/12/2025 20:30");
});
