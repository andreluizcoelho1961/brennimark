import assert from "node:assert/strict";
import test from "node:test";
import { emailSinteticoDoVisitante, lerDestino, lerPedidoDeEntrada, motivoDaRecusa, senhaDeUmaVez, textoDaRecusa } from "./entrada";

test("o pedido leva nome e e-mail; a origem é SEMPRE `tour`, mesmo que o navegador mande outra", () => {
  const r = lerPedidoDeEntrada({ nome: "  Ana  Silva ", email: "ANA@Estudio.com", origem: "kit", idioma: "en", aceiteMarketing: true, token: "tk" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.pedido.dados.origem, "tour");
  assert.equal(r.pedido.dados.nome, "Ana Silva");
  assert.equal(r.pedido.dados.email, "ana@estudio.com");
  assert.equal(r.pedido.dados.idioma, "en");
  assert.equal(r.pedido.dados.respostas.idioma, "en");
  assert.equal(r.pedido.token, "tk");
});

test("a caixa de marketing só vale se vier explicitamente verdadeira", () => {
  for (const v of [undefined, "true", 1, "on", null]) {
    const r = lerPedidoDeEntrada({ nome: "Ana", email: "a@b.co", aceiteMarketing: v });
    assert.equal(r.ok && r.pedido.dados.aceiteMarketing, false, String(v));
  }
  const r = lerPedidoDeEntrada({ nome: "Ana", email: "a@b.co", aceiteMarketing: true });
  assert.equal(r.ok && r.pedido.dados.aceiteMarketing, true);
});

test("e-mail ou nome inválidos são recusados com o campo certo", () => {
  const sem = lerPedidoDeEntrada({ nome: "Ana", email: "isso-nao-e-email" });
  assert.deepEqual(sem.ok ? null : sem.campo, "email");
  const semNome = lerPedidoDeEntrada({ nome: "   ", email: "a@b.co" });
  assert.deepEqual(semNome.ok ? null : semNome.campo, "nome");
  assert.equal(lerPedidoDeEntrada(null).ok, false);
});

test("o e-mail sintético é `.invalid` e nunca se repete; a senha é longa e única", () => {
  const a = emailSinteticoDoVisitante();
  const b = emailSinteticoDoVisitante();
  assert.match(a, /^visitante-[0-9a-f]{18}@visitante\.invalid$/);
  assert.notEqual(a, b);
  assert.ok(senhaDeUmaVez().length >= 40);
  assert.notEqual(senhaDeUmaVez(), senhaDeUmaVez());
});

test("o erro do banco vira o motivo que a pessoa vê", () => {
  assert.equal(motivoDaRecusa("demonstracao_inativa"), "inativo");
  assert.equal(motivoDaRecusa("demonstracao_lotada"), "lotado");
  for (const m of [undefined, null, "", "outra coisa", "permission denied"]) assert.equal(motivoDaRecusa(m), "desconhecido");
});

test("todo texto de recusa existe nos dois idiomas, sem vazar o motivo técnico", () => {
  for (const chave of ["inativo", "lotado", "desconhecido", "captcha", "captcha_fora", "indisponivel"] as const) {
    assert.ok(textoDaRecusa(chave, "pt-BR").length > 10, chave);
    assert.ok(textoDaRecusa(chave, "en").length > 10, chave);
    assert.doesNotMatch(textoDaRecusa(chave, "en"), /demonstracao|P0001|uuid/i);
  }
});

test("o destino só vale na forma que o banco devolve", () => {
  assert.deepEqual(lerDestino([{ expira_em: "2026-10-26T10:00:00Z", workspace_id: "w", marca_key: "m" }]), { expiraEm: "2026-10-26T10:00:00Z" });
  assert.deepEqual(lerDestino({ expira_em: "2026-10-26T10:00:00Z" }), { expiraEm: "2026-10-26T10:00:00Z" });
  for (const ruim of [null, undefined, [], {}, [{}], [{ expira_em: 5 }], "x"]) assert.equal(lerDestino(ruim), null, JSON.stringify(ruim));
});
