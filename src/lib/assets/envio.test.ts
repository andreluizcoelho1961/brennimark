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

test("registro duplicado não apaga o arquivo de quem registrou primeiro", async () => {
  // Achado da revisão de 30/09/2026: dois pedidos simultâneos, um registra e o
  // outro recebe 23505 — e o segundo apagava o arquivo do primeiro.
  const { caminhosADescartar } = await import("./envio");
  assert.deepEqual(caminhosADescartar("23505", "marca/arquivo.svg", null), []);
  assert.deepEqual(caminhosADescartar("23505", "marca/arquivo.svg", "marca/miniatura.png"), ["marca/miniatura.png"]);
});

test("qualquer outra recusa do registro descarta o arquivo, que ficou sem dono", async () => {
  const { caminhosADescartar } = await import("./envio");
  assert.deepEqual(caminhosADescartar("23514", "marca/arquivo.svg", "marca/miniatura.png"), ["marca/arquivo.svg", "marca/miniatura.png"]);
  assert.deepEqual(caminhosADescartar(undefined, "marca/arquivo.svg", null), ["marca/arquivo.svg"]);
});

test("a rota de envio decide o descarte antes de apagar, quando o registro falha", async () => {
  // A guarda do código-fonte: a função acima só protege se a rota a usar. Sem
  // banco nem Storage na suíte de unidade, confere-se a ordem no texto.
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const fonte = readFileSync(join(process.cwd(), "src/app/api/admin/assets/route.ts"), "utf8");
  const bloco = fonte.slice(fonte.indexOf("if (error) {"), fonte.indexOf('if (error.code === "23505")'));
  assert.ok(bloco.indexOf("caminhosADescartar(") >= 0, "o bloco de falha do registro não usa caminhosADescartar");
  assert.doesNotMatch(bloco, /apagar\(miniaturaPath \? \[path, miniaturaPath\] : \[path\]\)/, "voltou a apagar o arquivo antes de olhar o motivo");
});
