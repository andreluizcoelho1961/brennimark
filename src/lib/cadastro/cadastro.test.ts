import assert from "node:assert/strict";
import test from "node:test";
import { BIBLIOTECAS, COMO_CONHECEU, EQUIPES, MARCAS, SISTEMAS, VERSAO_DO_ACEITE, comMarcaDoConvite, validarCadastro } from "./cadastro";

const valido = { email: "Ana@Agencia.test ", nome: "  Ana   Souza ", origem: "kit" };

test("o cadastro mínimo: e-mail em minúsculas, nome sem espaço sobrando, caixa de marketing desmarcada", () => {
  const r = validarCadastro(valido);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.dados.email, "ana@agencia.test");
    assert.equal(r.dados.nome, "Ana Souza");
    assert.equal(r.dados.aceiteMarketing, false, "o aceite nasce desmarcado");
    assert.equal(r.dados.agencia, null);
    assert.equal(r.dados.cargo, null);
    assert.deepEqual(r.dados.respostas, {});
  }
});

test("só o valor exatamente true marca o aceite de marketing", () => {
  for (const v of ["true", 1, "on", null, undefined]) {
    const r = validarCadastro({ ...valido, aceiteMarketing: v });
    assert.equal(r.ok && r.dados.aceiteMarketing, false, `${String(v)} não é aceite`);
  }
  const r = validarCadastro({ ...valido, aceiteMarketing: true });
  assert.equal(r.ok && r.dados.aceiteMarketing, true);
});

test("cada recusa diz qual campo corrigir", () => {
  const caso = (m: object) => { const r = validarCadastro({ ...valido, ...m }); return r.ok ? "ok" : r.campo; };
  assert.equal(caso({ email: "sem-arroba" }), "email");
  assert.equal(caso({ email: "a@b" }), "email");
  assert.equal(caso({ email: `${"a".repeat(250)}@b.co` }), "email");
  assert.equal(caso({ nome: "   " }), "nome");
  assert.equal(caso({ nome: "x".repeat(121) }), "nome");
  assert.equal(caso({ origem: "mockups" }), "origem");
  assert.equal(caso({ agencia: "x".repeat(121) }), "agencia");
  assert.equal(caso({ cargo: "ceo" }), "cargo");
  assert.equal(caso({ respostas: { equipe: "quase-mil" } }), "equipe");
  assert.equal(caso({ respostas: { marcas: 7 } }), "marcas");
  assert.equal(caso({ respostas: { comoConheceu: "sonho" } }), "comoConheceu");
});

test("lixo no corpo não derruba a validação", () => {
  for (const entrada of [null, undefined, "texto", 42, [], {}]) {
    assert.equal(validarCadastro(entrada).ok, false);
  }
});

test("as respostas válidas passam, e chaves desconhecidas são descartadas", () => {
  const r = validarCadastro({
    ...valido, agencia: "Estúdio Z", cargo: "designer",
    respostas: { equipe: EQUIPES[1].id, marcas: MARCAS[0].id, comoConheceu: COMO_CONHECEU[0].id, intruso: "x" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.deepEqual(r.dados.respostas, { equipe: "2-5", marcas: "1-3", comoConheceu: "indicacao" });
    assert.equal(r.dados.agencia, "Estúdio Z");
  }
});

test("a versão do aceite tem o formato que o banco exige", () => {
  assert.match(VERSAO_DO_ACEITE, /^\d{4}-\d{2}-\d{2}$/);
});

test("o pedido do Fonts traz o sistema e a biblioteca, e valor fora da lista é recusado", () => {
  const ok = validarCadastro({ ...valido, origem: "fonts", respostas: { sistema: SISTEMAS[0].id, biblioteca: BIBLIOTECAS[1].id } });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.deepEqual(ok.dados.respostas, { sistema: "mac-apple", biblioteca: "500-5000" });
  const r = validarCadastro({ ...valido, origem: "fonts", respostas: { sistema: "linux" } });
  assert.equal(r.ok ? "ok" : r.campo, "sistema");
});

test("só o servidor marca o convite do Fonts, e só quando a origem é o Fonts", () => {
  const agora = new Date("2026-10-18T12:00:00.000Z");
  const dados = (origem: string) => { const r = validarCadastro({ ...valido, origem }); assert.ok(r.ok); return r.ok ? r.dados : (null as never); };

  const fonts = comMarcaDoConvite(dados("fonts"), agora);
  assert.equal(fonts.respostas.fontsBeta, "pedido");
  assert.equal(fonts.respostas.fontsBetaEm, "2026-10-18T12:00:00.000Z");

  for (const origem of ["kit", "cores", "grids"]) {
    assert.equal(comMarcaDoConvite(dados(origem), agora).respostas.fontsBeta, undefined, `${origem} não pede convite`);
  }
  // O navegador não consegue forjar a marca: chaves desconhecidas já caem na validação.
  const forjado = validarCadastro({ ...valido, origem: "kit", respostas: { fontsBeta: "pedido" } });
  assert.ok(forjado.ok && forjado.dados.respostas.fontsBeta === undefined);
});
