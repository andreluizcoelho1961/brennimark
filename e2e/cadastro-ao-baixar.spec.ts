import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

/**
 * O cadastro na hora de baixar (17/10/2026), no Grids gratuito (as três
 * ferramentas usam o mesmo gancho). Aqui a pessoa começa do zero, sem o cookie
 * que os outros testes trazem. A rota é fingida: a gravação no banco está
 * provada em `scripts/prova-cadastros-gratuitos.sh`.
 */
test.use({ storageState: { cookies: [], origins: [] } });

async function abrir(page: Page) {
  await page.goto("/ferramentas/grids");
  await expect(page.locator("[data-grids-vivo]")).toHaveCount(1, { timeout: 30_000 });
}

async function preencher(page: Page) {
  await page.locator("[data-cadastro-nome]").fill("Ana Souza");
  await page.locator("[data-cadastro-email]").fill("Ana@Agencia.test");
}

test("o primeiro download pede o cadastro, grava a origem e solta o arquivo; o segundo não pergunta", async ({ page }) => {
  const corpos: Record<string, unknown>[] = [];
  await page.route("**/api/cadastro", (r) => {
    corpos.push(r.request().postDataJSON() as Record<string, unknown>);
    return r.fulfill({ json: { ok: true }, headers: { "set-cookie": "bm_cadastro=1; Path=/; SameSite=Lax" } });
  });
  await abrir(page);

  await page.locator("[data-grids-baixar-idml]").click();
  await expect(page.locator("[data-cadastro]")).toBeVisible();
  await preencher(page);
  await page.locator("[data-cadastro-aceite]").check();
  const baixando = page.waitForEvent("download");
  await page.locator("[data-cadastro-enviar]").click();
  const download = await baixando;
  expect(download.suggestedFilename()).toBe("grid-a4-colunas.idml");
  const z = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(strFromU8(z.mimetype)).toBe("application/vnd.adobe.indesign-idml-package");
  expect(corpos).toHaveLength(1);
  expect(corpos[0]).toMatchObject({ origem: "grids", nome: "Ana Souza", aceiteMarketing: true });
  await expect(page.locator("[data-cadastro]")).toHaveCount(0);

  // De novo, no mesmo aparelho: baixa direto.
  const outro = page.waitForEvent("download");
  await page.locator("[data-grids-baixar-pdf]").click();
  expect((await outro).suggestedFilename()).toBe("grid-a4-colunas.pdf");
  await expect(page.locator("[data-cadastro]")).toHaveCount(0);
  expect(corpos).toHaveLength(1);
});

test("a caixa de marketing nasce desmarcada", async ({ page }) => {
  await abrir(page);
  await page.locator("[data-grids-baixar-idml]").click();
  await expect(page.locator("[data-cadastro-aceite]")).not.toBeChecked();
});

test("recusa de campo mostra a mensagem e não solta o arquivo", async ({ page }) => {
  await page.route("**/api/cadastro", (r) => r.fulfill({ status: 400, json: { message: "Confira o e-mail.", campo: "email" } }));
  await abrir(page);
  let baixou = false;
  page.on("download", () => { baixou = true; });
  await page.locator("[data-grids-baixar-idml]").click();
  await preencher(page);
  await page.locator("[data-cadastro-enviar]").click();
  await expect(page.locator("[data-cadastro-erro]")).toHaveText("Confira o e-mail.");
  await expect(page.locator("[data-cadastro]")).toBeVisible();
  await page.waitForTimeout(500);
  expect(baixou).toBe(false);
});

test("falha do servidor NÃO trava o download", async ({ page }) => {
  await page.route("**/api/cadastro", (r) => r.fulfill({ status: 503, json: { message: "indisponível" } }));
  await abrir(page);
  await page.locator("[data-grids-baixar-idml]").click();
  await preencher(page);
  const baixando = page.waitForEvent("download");
  await page.locator("[data-cadastro-enviar]").click();
  expect((await baixando).suggestedFilename()).toBe("grid-a4-colunas.idml");
});

test("'Agora não' fecha o formulário e não baixa nada", async ({ page }) => {
  await abrir(page);
  let baixou = false;
  page.on("download", () => { baixou = true; });
  await page.locator("[data-grids-baixar-idml]").click();
  await expect(page.locator("[data-cadastro]")).toBeVisible();
  await page.locator("[data-cadastro-fechar]").click();
  await expect(page.locator("[data-cadastro]")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(baixou).toBe(false);
});

test("o formulário funciona só com o teclado: Esc fecha", async ({ page }) => {
  await abrir(page);
  await page.locator("[data-grids-baixar-idml]").click();
  await expect(page.locator("[data-cadastro-nome]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-cadastro]")).toHaveCount(0);
});
