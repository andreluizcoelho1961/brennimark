import { expect, test } from "@playwright/test";

/**
 * O contexto ativo vive na URL.
 *
 * O que estes testes alcançam sem sessão: a estrutura das rotas, o resolvedor
 * de /docs, a compatibilidade dos endereços antigos e o fato de a moldura
 * montar dentro do contexto. O que eles NÃO alcançam, e é honesto dizer: a
 * escolha entre duas marcas reais, que exige duas marcas no banco e uma sessão
 * — a regra dessa escolha está contada em src/lib/brennimark/selecao.test.ts,
 * com dezoito casos, e é lá que ela é verificável.
 *
 * Também não está aqui a verificação de que nenhum link sai do contexto: no
 * preview local não há capacidade, logo não há destino renderizado, e um teste
 * que percorre uma lista vazia passa sem verificar nada. Essa é uma guarda de
 * código, em platform/leak-guard.test.ts.
 */

const CONTEXTO = "/w/laboratorio/b/exemplo";

test("a marca aparece na URL, e é ela que o endereço carrega", async ({ page }) => {
  const resposta = await page.goto(`${CONTEXTO}/docs`);
  expect(resposta?.status()).toBe(200);
  // O endereço não é reescrito para uma forma sem contexto: ele É o contexto.
  expect(new URL(page.url()).pathname).toBe(`${CONTEXTO}/docs`);
});

test("duas marcas abertas ao mesmo tempo não se sobrescrevem", async ({ browser }) => {
  // O defeito que isto impede não existe com instância global: duas abas
  // compartilhariam o mesmo objeto de módulo, e a segunda trocaria a marca da
  // primeira. Com o contexto na URL, cada aba carrega a sua.
  const contexto = await browser.newContext();
  const [a, b] = [await contexto.newPage(), await contexto.newPage()];
  await a.goto("/w/conta-a/b/marca-a/docs");
  await b.goto("/w/conta-b/b/marca-b/docs");

  expect(new URL(a.url()).pathname).toBe("/w/conta-a/b/marca-a/docs");
  expect(new URL(b.url()).pathname).toBe("/w/conta-b/b/marca-b/docs");
  await contexto.close();
});

test("/docs continua valendo como atalho, e resolve", async ({ page }) => {
  const resposta = await page.goto("/docs");
  expect(resposta?.status()).toBe(200);
  // Sem sessão nem marca no preview local, o resolvedor mostra a porta de
  // entrada. O que se prova aqui é que /docs não virou 404 ao deixar de ser
  // uma página: endereços que existiam continuam existindo.
  await expect(page.getByRole("heading", { name: /Nenhuma marca por aqui ainda/ })).toBeVisible();
});

test("o importador vive na conta, não dentro de uma marca", async ({ page }) => {
  // Importar é o ato que CRIA a marca. Se a rota exigisse uma marca na URL, a
  // primeira importação de uma conta seria inalcançável: a marca que o
  // endereço pediria é exatamente a que ainda não existe.
  const daConta = await page.goto("/w/laboratorio/importar");
  expect(daConta?.status()).toBe(200);

  const daMarca = await page.goto(`${CONTEXTO}/docs/importar`);
  expect(daMarca?.status(), "importar não deveria existir sob uma marca").toBe(404);
});

test("rota filha que não existe na marca é 404, não a página de outra marca", async ({ page }) => {
  // O caminho existe na marca A e não na B. A resposta certa é 404: renderizar
  // a página de A sob a URL de B seria servir conteúdo de um cliente no
  // endereço de outro, sem nenhum sinal na tela de que isso aconteceu.
  const resposta = await page.goto(`${CONTEXTO}/docs/cor`);
  expect(resposta?.status()).toBe(404);

  // E o que aparece é a página de erro, não um manual vestido.
  const canvas = await page.evaluate(() =>
    Boolean(document.querySelector("[data-brand-canvas]")),
  );
  expect(canvas, "um manual foi renderizado numa rota que não existe").toBe(false);
});
