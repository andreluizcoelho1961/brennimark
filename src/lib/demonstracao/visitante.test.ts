import assert from "node:assert/strict";
import test from "node:test";
import {
  homeLevaAoProduto, ehVisitanteDoTour, lerEstadoDoTour, motivoDoContador, statusDoLimite, textoDeAssinante, textoDoLimite, type MotivoDoLimite } from "./visitante";

test("visitante: app_metadata.tour ou login anônimo; user_metadata e conta comum não", () => {
  assert.equal(ehVisitanteDoTour({ app_metadata: { tour: true } }), true);
  assert.equal(ehVisitanteDoTour({ is_anonymous: true }), true);
  assert.equal(ehVisitanteDoTour({ app_metadata: { tour: "true" } }), false);
  assert.equal(ehVisitanteDoTour({ app_metadata: { provider: "email" }, is_anonymous: false }), false);
  assert.equal(ehVisitanteDoTour({ user_metadata: { tour: true } } as never), false);
  for (const v of [null, undefined, {}]) assert.equal(ehVisitanteDoTour(v), false);
});

test("o retorno do contador: só 'ok' libera; o desconhecido é o mais restritivo", () => {
  assert.equal(motivoDoContador("ok"), "ok");
  for (const m of ["esgotado", "expirado", "inativo", "teto_do_dia"] as const) assert.equal(motivoDoContador(m), m);
  for (const ruim of [null, undefined, "OK", "", "desconhecido", true, 1, {}]) assert.equal(motivoDoContador(ruim), "desconhecido", String(ruim));
});

test("todo motivo tem texto nos dois idiomas e um status coerente", () => {
  const todos: MotivoDoLimite[] = ["esgotado", "expirado", "inativo", "teto_do_dia", "desconhecido"];
  for (const m of todos) {
    assert.ok(textoDoLimite(m, false).length > 15, m);
    assert.ok(textoDoLimite(m, true).length > 15, m);
    assert.doesNotMatch(textoDoLimite(m, true), /teto_do_dia|demonstracao|esgotado/);
  }
  assert.equal(statusDoLimite("esgotado"), 429);
  assert.equal(statusDoLimite("teto_do_dia"), 429);
  assert.equal(statusDoLimite("inativo"), 503);
  assert.equal(statusDoLimite("expirado"), 403);
});

test("o estado vira restantes, nunca negativo, e forma estranha vira nulo", () => {
  assert.deepEqual(lerEstadoDoTour([{ feitas: 1, limite: 2, expira_em: "2026-10-28T10:00:00Z" }]), { feitas: 1, limite: 2, restantes: 1, expiraEm: "2026-10-28T10:00:00Z" });
  assert.deepEqual(lerEstadoDoTour({ feitas: 3, limite: 2 }), { feitas: 3, limite: 2, restantes: 0, expiraEm: null });
  for (const ruim of [null, undefined, [], [{}], [{ feitas: "1", limite: 2 }], "x"]) assert.equal(lerEstadoDoTour(ruim), null, JSON.stringify(ruim));
});

test("o texto de assinante existe nos dois idiomas e diz que dá para ver como funciona", () => {
  assert.match(textoDeAssinante(false), /assinantes/);
  assert.match(textoDeAssinante(true), /subscribers/);
  assert.doesNotMatch(textoDeAssinante(true), /tour_sem_ia/);
});

test("a home leva ao produto quem tem conta; o visitante do tour e quem não entrou ficam no site", () => {
  assert.equal(homeLevaAoProduto({ app_metadata: {}, is_anonymous: false }), true);
  assert.equal(homeLevaAoProduto({ app_metadata: { provider: "email" } }), true);
  assert.equal(homeLevaAoProduto({ app_metadata: { tour: true } }), false);
  assert.equal(homeLevaAoProduto({ is_anonymous: true }), false);
  assert.equal(homeLevaAoProduto(null), false);
  assert.equal(homeLevaAoProduto(undefined), false);
  // user_metadata nunca vale: a armadilha de conta real com `tour: true` no cadastro continua levando ao produto.
  assert.equal(homeLevaAoProduto({ app_metadata: {}, ...({ user_metadata: { tour: true } } as object) }), true);
});
