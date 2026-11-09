import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { senhaVazada } from "./senha-vazada";

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();
const resposta = (corpo: string, status = 200) => async () => new Response(corpo, { status });

test("sufixo presente na faixa: a senha é vazada, e só o prefixo de 5 caracteres sai", async () => {
  const h = sha1("senha-vazada-123");
  const pedidos: { url: string; padding: string | null }[] = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, padding: new Headers(init?.headers).get("add-padding") });
    return new Response(`ABCDEF0123456789ABCDEF0123456789ABC:3\r\n${h.slice(5)}:42\r\n`);
  }) as unknown as typeof fetch;
  assert.equal(await senhaVazada("senha-vazada-123", buscar), true);
  assert.equal(pedidos[0].url, `https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`);
  assert.equal(pedidos[0].padding, "true");
  assert.ok(!pedidos[0].url.includes(h.slice(5)));
});

test("sufixo ausente: a senha está limpa", async () => {
  assert.equal(await senhaVazada("uma-senha-bem-unica-9Zq", resposta("0000000000000000000000000000000000A:5\r\n") as unknown as typeof fetch), false);
});

test("linha de preenchimento (contagem 0) não conta como vazamento", async () => {
  const h = sha1("so-preenchimento-1");
  assert.equal(await senhaVazada("so-preenchimento-1", resposta(`${h.slice(5)}:0`) as unknown as typeof fetch), false);
});

test("API fora do ar, com erro HTTP ou lenta: a senha passa, e o log não leva a senha nem o hash", async () => {
  const senha = "segredo-que-nao-pode-vazar-no-log";
  const h = sha1(senha);
  const logs: string[] = [];
  const original = console.warn;
  console.warn = (...a: unknown[]) => { logs.push(a.join(" ")); };
  try {
    assert.equal(await senhaVazada(senha, (async () => { throw new Error("rede"); }) as unknown as typeof fetch), false);
    assert.equal(await senhaVazada(senha, resposta("erro", 503) as unknown as typeof fetch), false);
    const lenta = ((_u: string, init?: RequestInit) => new Promise((_, rej) => init?.signal?.addEventListener("abort", () => rej(new DOMException("t", "TimeoutError"))))) as unknown as typeof fetch;
    assert.equal(await senhaVazada(senha, lenta), false);
  } finally { console.warn = original; }
  assert.equal(logs.length, 3);
  for (const l of logs) { assert.ok(!l.includes(senha)); assert.ok(!l.toUpperCase().includes(h.slice(0, 5))); assert.match(l, /senha_vazada_indisponivel/); }
});
