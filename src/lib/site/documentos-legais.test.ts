import assert from "node:assert/strict";
import test from "node:test";
import { POLITICA_DE_PRIVACIDADE, TERMOS_DE_USO } from "./documentos-legais";

test("cada documento tem versão em data, seções numeradas em ordem e nenhuma seção vazia", () => {
  for (const doc of [TERMOS_DE_USO, POLITICA_DE_PRIVACIDADE]) {
    assert.match(doc.versao, /^\d{4}-\d{2}-\d{2}$/);
    doc.secoes.forEach((s, i) => {
      assert.ok(s.titulo.startsWith(`${i + 1}. `), s.titulo);
      assert.ok(s.paragrafos.length > 0, s.titulo);
    });
  }
});

test("os termos dizem as regras de cobrança que o produto aplica", () => {
  const texto = TERMOS_DE_USO.secoes.flatMap((s) => s.paragrafos).join(" ");
  // A regra do atraso (cobranca_vida): 7 dias com tudo, depois só leitura, nada apagado.
  assert.match(texto, /7 dias/);
  assert.match(texto, /só para leitura/);
  assert.match(texto, /Nada é apagado/);
  // Só cartão (02/10/2026).
  assert.match(texto, /cartão de crédito/);
  assert.doesNotMatch(texto, /\bPix\b/);
});

test("a privacidade não promete o que o produto não faz", () => {
  const texto = POLITICA_DE_PRIVACIDADE.secoes.flatMap((s) => s.paragrafos).join(" ");
  assert.match(texto, /Não guardamos o número do cartão/);
  // Conversas são do autor (migration conversas_por_autor).
  assert.match(texto, /Cada conversa é de quem a fez/);
  assert.doesNotMatch(texto, /cookies? de publicidade(?! nem)/);
});
