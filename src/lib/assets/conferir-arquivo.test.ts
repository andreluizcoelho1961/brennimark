import assert from "node:assert/strict";
import test from "node:test";
import { conteudoConfere, TIPOS_ACEITOS } from "./conferir-arquivo";

const bytes = (hex: string) => Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)));
const texto = (t: string) => new TextEncoder().encode(t);

test("cada formato é reconhecido pelos bytes, não pelo nome", () => {
  assert.equal(conteudoConfere(bytes("89504e470d0a1a0a"), "image/png"), true);
  assert.equal(conteudoConfere(bytes("255044462d312e37"), "application/pdf"), true);
  assert.equal(conteudoConfere(bytes("252150532d41646f"), "application/postscript"), true);
  assert.equal(conteudoConfere(texto("  <?xml version='1.0'?><svg/>"), "image/svg+xml"), true);
  assert.equal(conteudoConfere(texto("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml"), true);
});

test("tipo declarado que não bate com o conteúdo é recusado", () => {
  assert.equal(conteudoConfere(bytes("89504e470d0a1a0a"), "application/pdf"), false);
  assert.equal(conteudoConfere(texto("<html><script>"), "image/svg+xml"), false);
  assert.equal(conteudoConfere(bytes("52494646000000004156492"), "image/webp"), false);
  assert.equal(conteudoConfere(bytes("5249464600000000574542505650"), "image/webp"), true);
});

test("octet-stream não é aceito — seria aceitar qualquer coisa", () => {
  assert.equal(TIPOS_ACEITOS.has("application/octet-stream"), false);
  assert.equal(conteudoConfere(bytes("00"), "application/octet-stream"), false);
});
