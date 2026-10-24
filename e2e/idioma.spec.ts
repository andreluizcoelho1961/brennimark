import { expect, test } from "@playwright/test";

/**
 * O botão de idioma (23/10/2026). A suíte não tem sessão: o que se prova é o
 * visitante no login — a escolha vai para o cookie, sobrevive a recarregar, e
 * a rota recusa idioma que o produto não tem. A gravação em `profiles.locale`
 * tem a sua prova no banco (`scripts/prova-idioma-da-interface.sh`).
 */
test("o login segue o idioma do navegador enquanto ninguém escolheu", async ({ browser }) => {
  const ingles = await browser.newContext({ locale: "en-US" });
  const pagina = await ingles.newPage();
  await pagina.goto("/login");
  await expect(pagina.getByRole("button", { name: "Sign in" })).toBeVisible();
  await ingles.close();

  const portugues = await browser.newContext({ locale: "pt-BR" });
  const outra = await portugues.newPage();
  await outra.goto("/login");
  await expect(outra.getByRole("button", { name: "Entrar" })).toBeVisible();
  await portugues.close();
});

test("o botão troca o idioma, lembra a escolha e ela ganha do navegador", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();

  // Espera a gravação e o redesenho do servidor: sob carga, 5 s não bastam.
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/idioma") && r.ok()),
    page.getByRole("button", { name: "English" }).click(),
  ]);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  // Recarregar não desfaz: a escolha está no cookie, e o navegador pede pt-BR.
  await page.reload();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/idioma") && r.ok()),
    page.getByRole("button", { name: "Português" }).click(),
  ]);
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
});

test("a rota recusa idioma que o produto não tem, e não grava cookie", async ({ request }) => {
  const ruim = await request.post("/api/idioma", { data: { locale: "fr" }, maxRedirects: 0 });
  expect(ruim.status()).toBe(400);
  expect(ruim.headers()["set-cookie"]).toBeUndefined();

  const bom = await request.post("/api/idioma", { data: { locale: "en" }, maxRedirects: 0 });
  expect(bom.status()).toBe(200);
  expect(bom.headers()["set-cookie"]).toMatch(/BRENNIMARK_IDIOMA=en/);
});

test("o estado sem marca fala o idioma escolhido, nos dois sentidos", async ({ browser }) => {
  const ingles = await browser.newContext({ locale: "pt-BR" });
  await ingles.addCookies([{ name: "BRENNIMARK_IDIOMA", value: "en", domain: "localhost", path: "/" }]);
  const pagina = await ingles.newPage();
  await pagina.goto("/docs");
  await expect(pagina.getByRole("heading", { name: "No brands here yet" })).toBeVisible();
  await expect(pagina.getByText("Nenhuma marca por aqui ainda")).toHaveCount(0);
  await ingles.close();

  const portugues = await browser.newContext({ locale: "en-US" });
  await portugues.addCookies([{ name: "BRENNIMARK_IDIOMA", value: "pt-BR", domain: "localhost", path: "/" }]);
  const outra = await portugues.newPage();
  await outra.goto("/docs");
  await expect(outra.getByRole("heading", { name: "Nenhuma marca por aqui ainda" })).toBeVisible();
  await portugues.close();
});
