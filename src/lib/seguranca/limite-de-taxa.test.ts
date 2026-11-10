import assert from "node:assert/strict";
import test from "node:test";
import { chaveDeLimite, dentroDoLimite, ipDoPedido } from "./limite-de-taxa";

const cab = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

test("o IP vem do x-real-ip, depois do primeiro do x-forwarded-for", () => {
  assert.equal(ipDoPedido(cab({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" })), "1.2.3.4");
  assert.equal(ipDoPedido(cab({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" })), "5.6.7.8");
  assert.equal(ipDoPedido(cab({})), null);
});

test("a chave é um resumo: o IP não aparece e rotas diferentes não se misturam", () => {
  const a = chaveDeLimite("cadastro", "1.2.3.4");
  assert.ok(!a.includes("1.2.3.4"));
  assert.ok(a.startsWith("cadastro:"));
  assert.notEqual(a, chaveDeLimite("receber", "1.2.3.4"));
  assert.notEqual(a, chaveDeLimite("cadastro", "1.2.3.5"));
});

test("dentro do limite segue; a função dizendo false barra", async () => {
  const chamadas: unknown[] = [];
  const fala = (data: unknown) => ({ rpc: async (n: string, a: Record<string, unknown>) => { chamadas.push([n, a]); return { data, error: null }; } });
  assert.equal(await dentroDoLimite(fala(true), { rota: "cadastro", ip: "1.1.1.1", limite: 20, janelaSegundos: 3600 }), true);
  assert.equal(await dentroDoLimite(fala(false), { rota: "cadastro", ip: "1.1.1.1", limite: 20, janelaSegundos: 3600 }), false);
  assert.equal((chamadas[0] as [string, Record<string, unknown>])[0], "limite_de_taxa_tentar");
  assert.equal((chamadas[0] as [string, Record<string, unknown>])[1].p_limite, 20);
});

test("falha aberta: erro do banco, exceção ou IP ausente deixam passar", async () => {
  const quebrado = { rpc: async () => ({ data: null, error: { code: "XX000" } }) };
  const joga = { rpc: async () => { throw new Error("rede"); } };
  assert.equal(await dentroDoLimite(quebrado, { rota: "x", ip: "1.1.1.1", limite: 1, janelaSegundos: 60 }), true);
  assert.equal(await dentroDoLimite(joga, { rota: "x", ip: "1.1.1.1", limite: 1, janelaSegundos: 60 }), true);
  assert.equal(await dentroDoLimite(quebrado, { rota: "x", ip: null, limite: 1, janelaSegundos: 60 }), true);
});
