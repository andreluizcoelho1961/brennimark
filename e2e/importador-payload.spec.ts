import { expect, test } from "@playwright/test";
import path from "node:path";

/**
 * O que a tela ENVIA quando ninguém marca nada.
 *
 * A investigação do primeiro ciclo autenticado ficou aberta por falta
 * exatamente disto: a marca nasceu com as quatro utilidades apesar das caixas
 * desmarcadas, e o laboratório não conseguia provar o contrário porque o envio
 * ao Storage falha antes da RPC — sem sessão, não há para onde subir o PDF.
 *
 * A saída é fingir a REDE, não o componente. O `page.route` responde ao
 * Storage como se o arquivo tivesse subido, e o código segue por conta própria
 * até a RPC. Nada em `src/` muda: o caminho exercitado é o mesmo que produção
 * executa, do clique ao corpo da requisição.
 *
 * A alternativa — um modo de teste no importador — provaria o comportamento de
 * um componente que produção não monta.
 */
const FIXTURE = path.join(process.cwd(), "e2e/fixtures/manual-de-teste.pdf");

test("com as caixas desmarcadas, o payload leva utilityLinks vazio", async ({ page }) => {
  const rpc: string[] = [];

  // O Storage responde como se tivesse aceitado o arquivo.
  await page.route("**/storage/v1/object/**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: '{"Key":"ok"}' }),
  );
  // A RPC é capturada e respondida, para o teste não depender de banco.
  await page.route("**/rest/v1/rpc/publish_brand_import", (rota) => {
    rpc.push(rota.request().postData() ?? "");
    return rota.fulfill({
      status: 200,
      contentType: "application/json",
      body: '"00000000-0000-4000-8000-000000000001"',
    });
  });

  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();

  // Ninguém toca nas caixas. É esse o cenário.
  const marcadas = await page
    .getByRole("checkbox")
    .evaluateAll((els) => els.map((e) => (e as HTMLInputElement).checked));
  expect(marcadas, "alguma caixa nasceu marcada").toEqual([false, false, false, false]);

  await page.getByRole("button", { name: /Criar a marca/ }).click();
  await expect.poll(() => rpc.length, { timeout: 15_000 }).toBeGreaterThan(0);

  const payload = JSON.parse(rpc[0]);
  const links = payload.p_navigation?.utilityLinks;

  /*
   * As três formas de errar isto são diferentes, e só uma é aceitável:
   *
   *   []          escolha explícita de nenhuma — o que a tela mostrava
   *   undefined   o campo existe e não foi preenchido; quem lê decide sozinho
   *   omitido     o campo some do JSON, e um `?? TODAS` do outro lado passa
   *
   * As duas últimas são como uma lista vazia vira "todas" sem ninguém mentir.
   */
  expect("utilityLinks" in (payload.p_navigation ?? {}), "o campo foi omitido").toBe(true);
  expect(links, "utilityLinks veio undefined").not.toBe(undefined);
  expect(Array.isArray(links), "utilityLinks não é array").toBe(true);
  expect(links).toEqual([]);
});

test("marcar duas envia exatamente as duas", async ({ page }) => {
  // O contraponto: sem ele, o teste acima passaria com um campo que sempre
  // sai vazio, e a escolha de quem importa não chegaria ao banco nunca.
  const rpc: string[] = [];
  await page.route("**/storage/v1/object/**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: '{"Key":"ok"}' }),
  );
  await page.route("**/rest/v1/rpc/publish_brand_import", (rota) => {
    rpc.push(rota.request().postData() ?? "");
    return rota.fulfill({ status: 200, contentType: "application/json", body: '"id"' });
  });

  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();

  const caixas = page.getByRole("checkbox");
  await caixas.nth(0).check();
  await caixas.nth(2).check();

  await page.getByRole("button", { name: /Criar a marca/ }).click();
  await expect.poll(() => rpc.length, { timeout: 15_000 }).toBeGreaterThan(0);

  const links = JSON.parse(rpc[0]).p_navigation.utilityLinks;
  expect(links).toHaveLength(2);
  expect(links).not.toContain("analysis");
});


test("a tela afirma o que será gravado, em vez de só não marcar", async ({ page }) => {
  /*
   * Quatro caixas desmarcadas e uma frase dizendo "nenhuma" são a mesma
   * informação, e não são: a caixa exige que a pessoa perceba a AUSÊNCIA de
   * marca em quatro controles pequenos; a frase afirma.
   *
   * E o rótulo inteiro é clicável — tocar perto do texto alterna sem que o
   * gesto pareça um clique. A frase é o que torna esse acidente visível antes
   * de publicar.
   */
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();

  const resumo = page.locator("[data-resumo-de-utilidades]");
  await expect(resumo).toHaveText(/Nenhuma funcionalidade|No AI feature/);

  await page.getByRole("checkbox").first().check();
  await expect(resumo).toHaveText(/Serão habilitadas|Will be enabled/);
  await expect(resumo).toContainText(/Chat/i);

  await page.getByRole("checkbox").first().uncheck();
  await expect(resumo).toHaveText(/Nenhuma funcionalidade|No AI feature/);
});
