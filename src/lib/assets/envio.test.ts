import assert from "node:assert/strict";
import test from "node:test";
import { assinarEnvio, lerEnvio, tamanhoDoContentRange, type DadosDoEnvio } from "./envio";

const CHAVE = "chave-de-teste";
const QUEM = { userId: "u1", workspaceId: "w1", brandId: "b1" };
const dados = (over: Partial<DadosDoEnvio> = {}): DadosDoEnvio => ({
  workspaceId: "w1", brandId: "b1", userId: "u1", itemId: "i1", caminho: "w1/b1/x-logo.eps",
  label: "Logo", description: "", fileName: "logo.eps", mimeType: "application/postscript", sizeBytes: 12_000_000,
  eixos: { hierarquia: "principal" }, substitui: null, expira: 2_000, ...over,
});

test("a autorização assinada volta inteira, dentro do prazo, para a mesma pessoa", () => {
  const r = lerEnvio(assinarEnvio(dados(), CHAVE), CHAVE, QUEM, 1_000);
  assert.deepEqual(r, { ok: true, dados: dados() });
});

test("mudar um byte do conteúdo quebra a assinatura — o caminho não se troca", () => {
  const token = assinarEnvio(dados(), CHAVE);
  const [corpo, sig] = token.split(".");
  const adulterado = Buffer.from(JSON.stringify({ ...dados(), caminho: "outra/marca/x.eps" })).toString("base64url");
  assert.deepEqual(lerEnvio(`${adulterado}.${sig}`, CHAVE, QUEM, 1_000), { ok: false, motivo: "assinatura" });
  assert.deepEqual(lerEnvio(`${corpo}.${sig.slice(0, -2)}xx`, CHAVE, QUEM, 1_000), { ok: false, motivo: "assinatura" });
  assert.deepEqual(lerEnvio(token, "outra-chave", QUEM, 1_000), { ok: false, motivo: "assinatura" });
});

test("vencida não vale", () => {
  assert.deepEqual(lerEnvio(assinarEnvio(dados(), CHAVE), CHAVE, QUEM, 2_001), { ok: false, motivo: "expirado" });
});

test("repassada a outra pessoa, ou usada em outra marca, não vale", () => {
  const token = assinarEnvio(dados(), CHAVE);
  assert.deepEqual(lerEnvio(token, CHAVE, { ...QUEM, userId: "u2" }, 1_000), { ok: false, motivo: "outra-pessoa" });
  assert.deepEqual(lerEnvio(token, CHAVE, { ...QUEM, brandId: "b2" }, 1_000), { ok: false, motivo: "outra-pessoa" });
});

test("lixo não quebra nada", () => {
  for (const lixo of [undefined, 42, "", "a", "a.b.c", "x".repeat(9_000)]) {
    assert.equal(lerEnvio(lixo, CHAVE, QUEM, 1_000).ok, false);
  }
});

test("o tamanho total vem do Content-Range", () => {
  assert.equal(tamanhoDoContentRange("bytes 0-511/12345678"), 12_345_678);
  assert.equal(tamanhoDoContentRange(null), null);
  assert.equal(tamanhoDoContentRange("bytes 0-511/*"), null);
});
