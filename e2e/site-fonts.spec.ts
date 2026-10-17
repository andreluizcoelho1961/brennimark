import { expect, test } from "@playwright/test";

/**
 * A página do Brennimark Fonts (`/fonts`, 16/10/2026).
 *
 * O que se guarda aqui é a honestidade da página: ela avisa do beta, do aviso
 * do sistema por instalador sem assinatura, não promete Linux nem o que está
 * "em desenvolvimento", e o pedido de acesso é um e-mail (sem banco).
 */
test("a página do Fonts avisa do beta e do instalador sem assinatura", async ({ page }) => {
  await page.goto("/fonts", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("gerenciador de fontes");
  await expect(page.getByText("Beta fechado, gratuito, por convite")).toBeVisible();
  await expect(page.getByText("90 dias").first()).toBeVisible();
  await expect(page.locator(".fx-beta")).toContainText("só os 50 primeiros");
  await expect(page.getByText("E se as 50 vagas acabarem?")).toBeAttached();
  await expect(page.getByText("Executar assim mesmo")).toBeAttached();
  await expect(page.getByText("Abrir mesmo assim")).toBeAttached();
  await expect(page.getByText("lançamento oficial", { exact: false }).first()).toBeAttached();
});

test("o pedido de acesso e o aviso de lançamento são e-mails para o contato", async ({ page }) => {
  await page.goto("/fonts", { waitUntil: "commit" });
  const pedir = page.getByRole("link", { name: /Pedir acesso ao beta/ });
  await expect(pedir).toHaveAttribute("href", /^mailto:contato@brennimark\.com\?subject=/);
  await expect(page.getByRole("link", { name: /Avisar-me do lançamento/ })).toHaveAttribute("href", /^mailto:contato@brennimark\.com/);
});

test("Linux e o que está em desenvolvimento não aparecem como pronto", async ({ page }) => {
  await page.goto("/fonts", { waitUntil: "commit" });
  const hero = page.locator(".pg-hero");
  await expect(hero).toContainText("Linux em preparação");
  // Os recursos prontos não incluem nada do roteiro.
  const prontos = page.locator(".fx-grid");
  for (const futuro of ["Google Fonts", "Adobe", "Sincronização"]) {
    await expect(prontos).not.toContainText(futuro);
  }
  await expect(page.locator(".fx-next li")).toHaveCount(6);
});

test("a comparação cita a data e a origem dos dados do concorrente", async ({ page }) => {
  await page.goto("/fonts", { waitUntil: "commit" });
  await expect(page.getByRole("table", { name: /FontBase/ })).toBeVisible();
  await expect(page.locator(".fx-fonte")).toContainText("14/10/2026");
  await expect(page.locator(".fx-fonte")).toContainText("não testamos");
});

test("no celular a página não rola para o lado", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/fonts", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const transborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(transborda).toBe(false);
});
