import assert from "node:assert/strict";
import test from "node:test";
import { registrarOQueLevou } from "./registrar-o-que-levou";

const ok = { ok: true, json: async () => ({}) };
const opcoes = { endereco: "/api/assets/kit", padrao: "padrão" };

function espiao(resposta: () => Promise<{ ok: boolean; json: () => Promise<unknown> }>) {
  const chamadas: { endereco: string; init: RequestInit }[] = [];
  const buscar = async (endereco: string, init: RequestInit) => {
    chamadas.push({ endereco, init });
    return resposta() as Promise<Pick<Response, "ok" | "json">>;
  };
  return { buscar, chamadas };
}

test("pede `download`, um pedido por item, sem repetir versão", async () => {
  const { buscar, chamadas } = espiao(async () => ok);
  const r = await registrarOQueLevou(
    [{ id: "a", itemId: "i1" }, { id: "a", itemId: "i1" }, { id: "b", itemId: "i1" }, { id: "c", itemId: "i2" }],
    { ...opcoes, buscar },
  );
  assert.equal(r, "");
  assert.equal(chamadas.length, 2);
  assert.deepEqual(JSON.parse(String(chamadas[0].init.body)), { itemId: "i1", ids: ["a", "b"], finalidade: "download" });
  assert.deepEqual(JSON.parse(String(chamadas[1].init.body)), { itemId: "i2", ids: ["c"], finalidade: "download" });
});

test("devolve a mensagem do servidor e para no primeiro pedido que falha", async () => {
  const { buscar, chamadas } = espiao(async () => ({ ok: false, json: async () => ({ message: "não registrou" }) }));
  const r = await registrarOQueLevou([{ id: "a", itemId: "i1" }, { id: "c", itemId: "i2" }], { ...opcoes, buscar });
  assert.equal(r, "não registrou");
  assert.equal(chamadas.length, 1);
});

test("cai na mensagem padrão quando a rede falha ou o corpo não é legível", async () => {
  const rede = espiao(async () => { throw new Error("offline"); });
  assert.equal(await registrarOQueLevou([{ id: "a", itemId: "i1" }], { ...opcoes, buscar: rede.buscar }), "padrão");
  const torto = espiao(async () => ({ ok: false, json: async () => { throw new Error("x"); } }));
  assert.equal(await registrarOQueLevou([{ id: "a", itemId: "i1" }], { ...opcoes, buscar: torto.buscar }), "padrão");
});

test("sem versões, não pede nada", async () => {
  const { buscar, chamadas } = espiao(async () => ok);
  assert.equal(await registrarOQueLevou([], { ...opcoes, buscar }), "");
  assert.equal(chamadas.length, 0);
});
