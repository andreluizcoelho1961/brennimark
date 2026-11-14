import { expect, test } from "@playwright/test";
import { CABECALHOS_DE_SEGURANCA } from "../src/lib/seguranca/cabecalhos";

/**
 * Os cabeçalhos chegam de verdade, e não só existem no módulo.
 *
 * `next.config.ts` pode perder a chamada a `headers()` numa refatoração e
 * nenhum teste de unidade perceberia: o módulo continuaria certo e a resposta
 * continuaria sem nada. Aqui a resposta é lida pela rede, em dois tipos de
 * rota — uma página e um route handler — porque o Next trata cada um por um
 * caminho de envio diferente.
 */
for (const caminho of ["/docs", "/previa-do-site.png"]) {
  test(`${caminho} responde com os cabeçalhos de segurança`, async ({ request }) => {
    const resposta = await request.get(caminho);
    expect(resposta.status()).toBeLessThan(400);
    for (const { key, value } of CABECALHOS_DE_SEGURANCA) {
      expect(resposta.headers()[key.toLowerCase()], key).toBe(value);
    }
  });
}
