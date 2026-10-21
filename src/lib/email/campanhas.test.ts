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
