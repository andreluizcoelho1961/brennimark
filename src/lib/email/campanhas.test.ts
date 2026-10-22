import assert from "node:assert/strict";
import test from "node:test";
import { CAMPANHAS, campanhaDe, personalizar, primeiroNome } from "./campanhas";

test("todo id de campanha cabe na constraint do banco e não se repete", () => {
  const ids = CAMPANHAS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9][a-z0-9-]{2,59}$/, `id fora da forma do banco: ${id}`);
});

test("toda campanha tem assunto e texto, e o botão aponta para um caminho do site", () => {
  for (const c of CAMPANHAS) {
    assert.ok(c.assunto.length >= 5 && c.assunto.length <= 120, `assunto de ${c.id}`);
    assert.ok(c.paragrafos.length >= 1);
    if (c.botao) assert.match(c.botao.caminho, /^\/[a-z0-9/-]*$/);
  }
});

test("campanhaDe só devolve o que existe", () => {
  assert.equal(campanhaDe("convite-fonts-beta")?.id, "convite-fonts-beta");
  assert.equal(campanhaDe("nao-existe"), null);
  assert.equal(campanhaDe(undefined), null);
  assert.equal(campanhaDe({}), null);
});

test("o primeiro nome vem limpo e nunca vira undefined", () => {
  assert.equal(primeiroNome("  Ana   Maria Souza "), "Ana");
  assert.equal(primeiroNome(""), "");
  assert.equal(primeiroNome(null), "");
  assert.equal(personalizar("Olá, {nome}.", "Ana Maria"), "Olá, Ana.");
  assert.equal(personalizar("Olá, {nome}.", ""), "Olá.");
  assert.equal(personalizar("Sem variável", "Ana"), "Sem variável");
});

test("nenhuma campanha promete o que o Fonts ainda não faz (relatório do app, 22/10/2026)", () => {
  // Leitura automática das fontes de dentro do documento, Missing Fonts, plugin Adobe,
  // Google Fonts e sincronização NÃO existem; a abertura é orientada por kit.
  const proibidos = [/automatica|automática|automaticamente|sozinhas?/i, /missing fonts/i, /plugin/i, /google fonts/i, /sincroniza/i, /instala(ção|r) permanente/i, /nuvem/i];
  for (const c of CAMPANHAS) {
    const texto = [c.assunto, ...c.paragrafos].join(" ");
    for (const p of proibidos) assert.doesNotMatch(texto, p, `${c.id} promete algo que ainda não existe: ${p}`);
  }
});
