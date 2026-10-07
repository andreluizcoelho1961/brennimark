import assert from "node:assert/strict";
import test from "node:test";
import {
  PRAZO_DA_SENHA_NA_VOLTA_HORAS, gerarProva, loginDaCompra, mesmoTexto, momentoDaVolta, resumoDaProva, sessaoValida,
  type LoginDaCompra, type SessaoDaCompra,
} from "./senha-na-volta";

const AGORA = Date.UTC(2026, 9, 2, 18, 0, 0);
const SESSAO: SessaoDaCompra = { paga: true, criadaEm: AGORA - 60_000, email: "fulana@agencia.com", idAssinatura: "sub_1", resumoDaProva: "r", comprador: "Fulana", empresa: "Agência", termosVersao: "2026-10-08", privacidadeVersao: "2026-10-08" };
const LOGIN_NOVO: LoginDaCompra = { criadoPelaCobranca: true, assinaturaDeOrigem: "sub_1", jaEntrou: false, senhaJaCriada: false };
const BASE = { provaConfere: true, sessao: SESSAO, contaExiste: true, login: LOGIN_NOVO, agora: AGORA };

test("o caminho feliz: pago, conta aberta, login nascido da compra que nunca entrou → criar senha", () => {
  assert.equal(momentoDaVolta(BASE), "criar-senha");
});

test("sem a prova do navegador, nada se revela — nem que a compra existe", () => {
  assert.equal(momentoDaVolta({ ...BASE, provaConfere: false }), "sem-prova");
  assert.equal(momentoDaVolta({ ...BASE, sessao: null }), "sem-prova");
  // Mesmo com tudo pronto do outro lado, e mesmo vencido: a prova vem primeiro.
  assert.equal(momentoDaVolta({ ...BASE, provaConfere: false, agora: AGORA + 48 * 3_600_000 }), "sem-prova");
});

test("pago mas a conta ainda não nasceu (o webhook não chegou), ou ainda não pago → aguardando", () => {
  assert.equal(momentoDaVolta({ ...BASE, contaExiste: false }), "aguardando");
  assert.equal(momentoDaVolta({ ...BASE, login: null }), "aguardando");
  assert.equal(momentoDaVolta({ ...BASE, sessao: { ...SESSAO, paga: false } }), "aguardando");
});

test("o prazo: dentro dele vale, depois dele não", () => {
  const limite = PRAZO_DA_SENHA_NA_VOLTA_HORAS * 3_600_000;
  assert.equal(momentoDaVolta({ ...BASE, agora: SESSAO.criadaEm + limite }), "criar-senha");
  assert.equal(momentoDaVolta({ ...BASE, agora: SESSAO.criadaEm + limite + 1 }), "expirado");
});

test("login que já existia, que já entrou, ou que já criou a senha NUNCA tem a senha trocada por aqui", () => {
  assert.equal(momentoDaVolta({ ...BASE, login: { ...LOGIN_NOVO, criadoPelaCobranca: false } }), "ja-tem-acesso");
  assert.equal(momentoDaVolta({ ...BASE, login: { ...LOGIN_NOVO, jaEntrou: true } }), "ja-tem-acesso");
  assert.equal(momentoDaVolta({ ...BASE, login: { ...LOGIN_NOVO, senhaJaCriada: true } }), "ja-tem-acesso");
});

test("só a compra que CRIOU o login cria a senha dele — uma segunda compra com o mesmo e-mail não", () => {
  // O ataque: alguém compra com o e-mail de um cliente que ainda não criou a senha.
  assert.equal(momentoDaVolta({ ...BASE, sessao: { ...SESSAO, idAssinatura: "sub_2" } }), "ja-tem-acesso");
  // Login nascido de compra antes desta marca existir: sem origem, sem senha por aqui.
  assert.equal(momentoDaVolta({ ...BASE, login: { ...LOGIN_NOVO, assinaturaDeOrigem: null } }), "ja-tem-acesso");
  assert.equal(momentoDaVolta({ ...BASE, sessao: { ...SESSAO, idAssinatura: null }, login: { ...LOGIN_NOVO, assinaturaDeOrigem: null } }), "ja-tem-acesso");
});

test("o login é lido de forma defensiva: só `true` conta como nascido da compra", () => {
  assert.deepEqual(loginDaCompra({ app_metadata: { criado_pela_cobranca: true, criado_pela_assinatura: "sub_1" }, last_sign_in_at: null }), LOGIN_NOVO);
  assert.equal(loginDaCompra({ app_metadata: { criado_pela_cobranca: true } }).assinaturaDeOrigem, null);
  assert.equal(loginDaCompra({ app_metadata: { criado_pela_assinatura: 7 } }).assinaturaDeOrigem, null);
  assert.equal(loginDaCompra({ app_metadata: { criado_pela_cobranca: "true" } }).criadoPelaCobranca, false);
  assert.equal(loginDaCompra({ app_metadata: null }).criadoPelaCobranca, false);
  assert.equal(loginDaCompra({ last_sign_in_at: "2026-10-02T18:00:00Z" }).jaEntrou, true);
  assert.equal(loginDaCompra({ app_metadata: { senha_criada_na_compra: "2026-10-02T18:00:00Z" } }).senhaJaCriada, true);
});

test("a prova: 64 caracteres hexadecimais, resumo determinístico e diferente da prova", async () => {
  const prova = gerarProva();
  assert.match(prova, /^[0-9a-f]{64}$/);
  assert.notEqual(gerarProva(), prova);
  const resumo = await resumoDaProva(prova);
  assert.match(resumo, /^[0-9a-f]{64}$/);
  assert.equal(await resumoDaProva(prova), resumo);
  assert.notEqual(resumo, prova);
  // Vetor conhecido do sha-256.
  assert.equal(await resumoDaProva("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("comparação de texto e identificador de sessão", () => {
  assert.equal(mesmoTexto("abc", "abc"), true);
  assert.equal(mesmoTexto("abc", "abd"), false);
  assert.equal(mesmoTexto("abc", "abcd"), false);
  assert.equal(sessaoValida("cs_test_a1eNK1SDCZHePJDbofUqmnMxVvrWim0F5WKAUYllFzNtO6rOVmhNLwiaqw"), true);
  assert.equal(sessaoValida("cs_live_abcdefghij"), true);
  assert.equal(sessaoValida("cs_test_qualquer"), false);
  assert.equal(sessaoValida("{CHECKOUT_SESSION_ID}"), false);
  assert.equal(sessaoValida("cs_test_../../x"), false);
  assert.equal(sessaoValida(undefined), false);
});
