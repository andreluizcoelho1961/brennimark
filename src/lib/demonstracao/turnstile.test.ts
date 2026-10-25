import assert from "node:assert/strict";
import test from "node:test";
import { conferirTurnstile, SEGREDO_DE_TESTE, URL_DE_CONFERENCIA } from "./turnstile";

const resposta = (corpo: unknown, ok = true) => (async () => ({ ok, json: async () => corpo })) as unknown as typeof fetch;

test("em produção, sem segredo, o captcha falha FECHADO", async () => {
  assert.equal(await conferirTurnstile({ token: "t", ip: null, segredo: undefined, producao: true }, resposta({ success: true })), "indisponivel");
  assert.equal(await conferirTurnstile({ token: "t", ip: null, segredo: "   ", producao: true }, resposta({ success: true })), "indisponivel");
});

test("fora de produção, sem segredo, usa a chave de teste da Cloudflare", async () => {
  let enviado = "";
  const buscar = (async (_u: string, init: RequestInit) => { enviado = String(init.body); return { ok: true, json: async () => ({ success: true }) }; }) as unknown as typeof fetch;
  assert.equal(await conferirTurnstile({ token: "t", ip: null, segredo: undefined, producao: false }, buscar), "ok");
  assert.match(enviado, new RegExp(`secret=${SEGREDO_DE_TESTE}`));
});

test("token ausente, vazio ou enorme é recusado sem chamar a Cloudflare", async () => {
  let chamou = false;
  const buscar = (async () => { chamou = true; return { ok: true, json: async () => ({ success: true }) }; }) as unknown as typeof fetch;
  for (const token of [undefined, null, "", 42, "x".repeat(2049)]) {
    assert.equal(await conferirTurnstile({ token, ip: null, segredo: "s", producao: true }, buscar), "recusado", String(token));
  }
  assert.equal(chamou, false);
});

test("success verdadeiro passa; qualquer outra coisa é recusa", async () => {
  assert.equal(await conferirTurnstile({ token: "t", ip: "1.2.3.4", segredo: "s", producao: true }, resposta({ success: true })), "ok");
  for (const corpo of [{ success: false }, { success: "true" }, {}, null]) {
    assert.equal(await conferirTurnstile({ token: "t", ip: null, segredo: "s", producao: true }, resposta(corpo)), "recusado", JSON.stringify(corpo));
  }
});

test("Cloudflare fora do ar (erro, resposta não ok, rede) é indisponível, nunca aprovação", async () => {
  assert.equal(await conferirTurnstile({ token: "t", ip: null, segredo: "s", producao: true }, resposta({ success: true }, false)), "indisponivel");
  const quebrada = (async () => { throw new Error("rede"); }) as unknown as typeof fetch;
  assert.equal(await conferirTurnstile({ token: "t", ip: null, segredo: "s", producao: true }, quebrada), "indisponivel");
});

test("o IP vai à Cloudflare; a URL é a oficial", async () => {
  let url = ""; let corpo = "";
  const buscar = (async (u: string, init: RequestInit) => { url = u; corpo = String(init.body); return { ok: true, json: async () => ({ success: true }) }; }) as unknown as typeof fetch;
  await conferirTurnstile({ token: "tk", ip: "9.9.9.9", segredo: "seg", producao: true }, buscar);
  assert.equal(url, URL_DE_CONFERENCIA);
  assert.match(corpo, /remoteip=9\.9\.9\.9/);
  assert.match(corpo, /response=tk/);
});
