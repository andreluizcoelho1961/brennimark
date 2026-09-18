import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMINHO_DA_TROCA, PRAZO_DA_SENHA_PROVISORIA_HORAS, conferirSenhaNova, desvioDaSenhaProvisoria,
  gerarSenhaProvisoria, prazoDaSenhaProvisoria, senhaProvisoriaAte, senhaProvisoriaVencida,
} from "./senha-provisoria";

/**
 * A senha provisória, do lado do servidor e da moldura.
 *
 * O banco garante que senha provisória não dá acesso
 * (`scripts/prova-senha-provisoria.sh`). Estes testes trancam o resto: a
 * senha gerada, o prazo, e quem a moldura deixa passar.
 */

test("a senha tem quatro grupos de quatro, sem caracteres que se confundem", () => {
  for (let i = 0; i < 200; i++) {
    const senha = gerarSenhaProvisoria();
    assert.match(senha, /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/);
    assert.doesNotMatch(senha, /[01OlI]/, `símbolo ambíguo em ${senha}`);
  }
});

test("duas senhas seguidas não se repetem", () => {
  const vistas = new Set(Array.from({ length: 500 }, () => gerarSenhaProvisoria()));
  assert.equal(vistas.size, 500);
});

test("bytes acima do maior múltiplo do alfabeto são descartados, não dobrados", () => {
  // Um gerador que só devolve 255 — acima do limite — seguido de zeros: se o
  // descarte não existisse, 255 % 56 = 31 apareceria na senha.
  let chamada = 0;
  const viciado = (b: Uint8Array) => { b.fill(chamada++ === 0 ? 255 : 0); return b; };
  assert.equal(gerarSenhaProvisoria(viciado), "AAAA-AAAA-AAAA-AAAA");
});

test("o prazo é de 72 horas a partir de agora", () => {
  const agora = new Date("2026-09-18T12:00:00Z");
  assert.equal(PRAZO_DA_SENHA_PROVISORIA_HORAS, 72);
  assert.equal(prazoDaSenhaProvisoria(agora), "2026-09-21T12:00:00.000Z");
});

test("sem a marca, a senha não é provisória", () => {
  assert.equal(senhaProvisoriaAte({}), null);
  assert.equal(senhaProvisoriaAte({ senha_provisoria_ate: null }), null);
  assert.equal(senhaProvisoriaAte(undefined), null);
});

test("valor estranho conta como vencida, nunca como livre", () => {
  // "Sem prazo" liberaria a pessoa da troca; vencida a manda pedir outra.
  const ate = senhaProvisoriaAte({ senha_provisoria_ate: "amanhã" });
  assert.ok(ate);
  assert.equal(senhaProvisoriaVencida(ate), true);
  assert.ok(senhaProvisoriaAte({ senha_provisoria_ate: 12345 }));
});

test("vence no instante do prazo", () => {
  const ate = new Date("2026-09-21T12:00:00Z");
  assert.equal(senhaProvisoriaVencida(ate, new Date("2026-09-21T11:59:59Z")), false);
  assert.equal(senhaProvisoriaVencida(ate, new Date("2026-09-21T12:00:00Z")), true);
});

test("com senha provisória, a moldura só deixa chegar à troca", () => {
  const provisoria = { senha_provisoria_ate: "2026-09-21T12:00:00Z" };
  assert.equal(desvioDaSenhaProvisoria("/w/conta/pessoas", provisoria), "trocar");
  assert.equal(desvioDaSenhaProvisoria("/", provisoria), "trocar");
  assert.equal(desvioDaSenhaProvisoria(CAMINHO_DA_TROCA, provisoria), "seguir");
  assert.equal(desvioDaSenhaProvisoria("/api/conta/trocar-senha", provisoria), "seguir");
  // Na API, recusa: um desvio para HTML seria lido como resposta.
  assert.equal(desvioDaSenhaProvisoria("/api/admin/pessoas", provisoria), "recusar");
  // Prefixo parecido não é o caminho livre.
  assert.equal(desvioDaSenhaProvisoria("/trocar-senha-falsa", provisoria), "trocar");
});

test("sem senha provisória, a moldura não interfere", () => {
  assert.equal(desvioDaSenhaProvisoria("/w/conta/pessoas", {}), "seguir");
  assert.equal(desvioDaSenhaProvisoria("/api/admin/pessoas", { outra: 1 }), "seguir");
});

test("a senha nova tem de 12 a 72 bytes e é digitada duas vezes igual", () => {
  assert.equal(conferirSenhaNova("curtinha", "curtinha"), "curta");
  assert.equal(conferirSenhaNova(undefined, undefined), "curta");
  assert.equal(conferirSenhaNova("a".repeat(73), "a".repeat(73)), "longa");
  // 72 bytes são o teto do bcrypt: acentos contam dois.
  assert.equal(conferirSenhaNova("é".repeat(37), "é".repeat(37)), "longa");
  assert.equal(conferirSenhaNova("senha-boa-de-doze", "senha-boa-de-dozx"), "diferentes");
  assert.equal(conferirSenhaNova("senha-boa-de-doze", "senha-boa-de-doze"), null);
});
