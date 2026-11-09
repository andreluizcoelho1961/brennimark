import { expect, test } from "@playwright/test";

/**
 * As páginas que a pessoa abre por um link de e-mail ou de entrega, sem conta:
 * confirmar e sair da lista, o link de entrega e o endereço que não existe. Elas
 * leem o idioma da PESSOA (cookie, perfil ou navegador), como a plataforma.
 */
const TOKEN = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test.describe("em inglês", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: "BRENNIMARK_IDIOMA", value: "en", url: "http://localhost:3210" }]);
  });

  test("confirmar o e-mail da lista", async ({ page }) => {
    await page.goto(`/confirmar/${TOKEN}`);
    await expect(page).toHaveTitle("Confirm your email");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirm your email");
    await expect(page.locator("[data-confirmacao-confirmar]")).toHaveText("Confirm my email");
    await page.goto("/confirmar/invalido");
    await expect(page.locator("[data-confirmacao-invalida] h1")).toHaveText("This link isn't valid.");
  });

  test("sair da lista", async ({ page }) => {
    await page.goto(`/sair/${TOKEN}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Leave Brennimark's list");
    await expect(page.locator("[data-saida-sair]")).toHaveText("Stop receiving");
    await page.locator("[data-saida-apagar]").click();
    await expect(page.locator("[data-saida-apagar-confirmar]")).toHaveText("Delete for good");
  });

  test("o link de entrega que não existe, e o endereço que não existe", async ({ page }) => {
    await page.goto("/receber/codigo-invalido");
    await expect(page.locator("html")).toContainText("This link doesn't exist");
    await page.goto("/esqueci-senha");
    await expect(page).toHaveTitle("Forgot your password? · Brennimark");
    const r = await page.goto("/rota-que-nao-existe-de-jeito-nenhum");
    expect(r?.status()).toBe(404);
  });
});

test("em português, as mesmas páginas seguem iguais", async ({ page }) => {
  await page.goto(`/sair/${TOKEN}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sair da lista do Brennimark");
  await page.goto("/esqueci-senha");
  await expect(page).toHaveTitle("Esqueci a senha · Brennimark");
});
