import assert from "node:assert/strict";
import test from "node:test";
import * as config from "./config";

/**
 * A instância global não existe mais.
 *
 * Este arquivo testava um REGISTRO de instâncias em código: `brennimarkInstance`
 * era resolvida por `NEXT_PUBLIC_BRENNIMARK_INSTANCE` na inicialização do
 * processo, e o produto inteiro lia dali qual marca mostrar. Era global por
 * processo — duas contas servidas pelo mesmo processo veriam a mesma marca.
 *
 * O M1 tirou a resolução de marca dali, o M2 tirou os caminhos de conteúdo, e o
 * V1 removeu o que restava, junto do registro e das instâncias de código.
 *
 * O que ficou aqui é a guarda de que nada disso volta. Um teste que valida um
 * registro vazio passa sem afirmar nada; um que exige a ausência do registro
 * fica vermelho no dia em que alguém o recria.
 */
test("o módulo não expõe instância global de marca", () => {
  const exportado = Object.keys(config);
  assert.deepEqual(exportado, ["platformThemeStyle"]);
});

test("nenhum export carrega marca, documento ou instância", () => {
  for (const nome of Object.keys(config)) {
    assert.doesNotMatch(
      nome,
      /instance|docs|registry|brand/i,
      `${nome} devolveu a instância global por outro nome`,
    );
  }
});

test("o tema exportado é da PLATAFORMA, e só dela", () => {
  // Se um token de marca escapasse por aqui, ele seria aplicado no <html> e
  // valeria para a moldura inteira — inclusive nas telas de outra marca.
  for (const chave of Object.keys(config.platformThemeStyle)) {
    assert.match(chave, /^--(platform|color-platform)-/, `token fora da plataforma: ${chave}`);
  }
});
