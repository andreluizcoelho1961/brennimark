import assert from "node:assert/strict";
import test from "node:test";
import { CABECALHOS_DE_SEGURANCA } from "./cabecalhos";

const valor = (chave: string) => CABECALHOS_DE_SEGURANCA.find((c) => c.key === chave)?.value;

test("nenhuma página do produto pode ser enquadrada por outro site", () => {
  assert.equal(valor("X-Frame-Options"), "DENY");
});

test("o navegador não adivinha o tipo de um arquivo de assinante", () => {
  assert.equal(valor("X-Content-Type-Options"), "nosniff");
});

test("ao sair para outro site, o caminho com conta e marca não vai junto", () => {
  assert.equal(valor("Referrer-Policy"), "strict-origin-when-cross-origin");
});

test("câmera, microfone e localização ficam desligados", () => {
  const politica = valor("Permissions-Policy") ?? "";
  for (const recurso of ["camera", "microphone", "geolocation"]) {
    assert.match(politica, new RegExp(`${recurso}=\\(\\)`));
  }
});

test("os quatro cabeçalhos existem, sem duplicata", () => {
  const chaves = CABECALHOS_DE_SEGURANCA.map((c) => c.key);
  assert.equal(chaves.length, 4);
  assert.equal(new Set(chaves).size, 4);
});
