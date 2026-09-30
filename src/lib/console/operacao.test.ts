import assert from "node:assert/strict";
import test from "node:test";
import { chamadaDaAcao, lerAcaoDeOperacao } from "./operacao";

const CONTA = "3f2b9c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const MARCA = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";

test("as três alavancas são lidas com o alvo e o sentido", () => {
  assert.deepEqual(lerAcaoDeOperacao({ alvo: "plataforma", pausado: true }), { ok: true, acao: { alvo: "plataforma", pausado: true } });
  assert.deepEqual(lerAcaoDeOperacao({ alvo: "conta", workspaceId: CONTA, pausado: false }), {
    ok: true, acao: { alvo: "conta", workspaceId: CONTA, pausado: false },
  });
  assert.deepEqual(lerAcaoDeOperacao({ alvo: "marca", brandId: MARCA, pausado: true }), {
    ok: true, acao: { alvo: "marca", brandId: MARCA, pausado: true },
  });
});

test("sem dizer se pausa ou retoma, nada acontece", () => {
  // "pausado": "true" (texto) não é sim: um botão com defeito não pode pausar
  // todas as contas por acidente de tipo.
  assert.equal(lerAcaoDeOperacao({ alvo: "plataforma", pausado: "true" }).ok, false);
  assert.equal(lerAcaoDeOperacao({ alvo: "plataforma" }).ok, false);
});

test("identificador que não é UUID é recusado antes do banco", () => {
  assert.deepEqual(lerAcaoDeOperacao({ alvo: "conta", workspaceId: "andre-coelho", pausado: true }), { ok: false, motivo: "Conta inválida." });
  assert.deepEqual(lerAcaoDeOperacao({ alvo: "marca", brandId: "", pausado: true }), { ok: false, motivo: "Marca inválida." });
});

test("alvo desconhecido é recusado", () => {
  assert.deepEqual(lerAcaoDeOperacao({ alvo: "tudo", pausado: true }), { ok: false, motivo: "Ação desconhecida." });
  assert.equal(lerAcaoDeOperacao(null).ok, false);
});

test("cada ação chama a sua função do banco, com o motivo", () => {
  assert.deepEqual(chamadaDaAcao({ alvo: "plataforma", pausado: true }, "chave vazada"), {
    funcao: "console_pausar_plataforma", parametros: { p_pausado: true, p_motivo: "chave vazada" },
  });
  assert.equal(chamadaDaAcao({ alvo: "conta", workspaceId: CONTA, pausado: false }, "ok").funcao, "console_pausar_conta");
  assert.equal(chamadaDaAcao({ alvo: "marca", brandId: MARCA, pausado: true }, "ok").funcao, "console_pausar_marca");
});
