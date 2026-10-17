import { expect, test } from "@playwright/test";

/**
 * As ferramentas gratuitas no site (17/10/2026): a entrada no menu do topo e o
 * convite à assinatura no fim de cada ferramenta.
 */
test("o menu do topo leva ao capítulo das ferramentas", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  const link = page.locator(".site-nav").getByRole("link", { name: "Ferramentas" });
  await expect(link).toHaveAttribute("href", "/#ferramentas");
  await expect(page.locator("#ferramentas")).toBeAttached();
});

for (const ferramenta of ["kit", "cores", "grids"]) {
  test(`o ${ferramenta} termina com o convite à assinatura`, async ({ page }) => {
    await page.goto(`/ferramentas/${ferramenta}`, { waitUntil: "commit" });
    const convite = page.locator("[data-convite-assinatura]");
    await expect(convite).toBeAttached();
    await expect(convite.getByRole("link", { name: "Ver os planos" })).toHaveAttribute("href", "/assinar");
  });
}
