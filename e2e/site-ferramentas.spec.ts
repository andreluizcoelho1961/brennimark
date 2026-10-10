import { expect, test } from "@playwright/test";

/**
 * As ferramentas gratuitas no rodapé do site (10/10/2026): o da página inicial
 * e o das páginas internas levam ao Kit e ao Cores.
 */
for (const pagina of ["/", "/termos"]) {
  test(`o rodapé de ${pagina} leva ao Kit e ao Cores`, async ({ page }) => {
    await page.goto(pagina);
    const ferramentas = page.locator("[data-ferramentas-gratuitas]");
    await expect(ferramentas.getByRole("link", { name: "Kit: todos os tamanhos do logo" })).toHaveAttribute("href", "/ferramentas/kit");
    await expect(ferramentas.getByRole("link", { name: "Cores: que cor é essa?" })).toHaveAttribute("href", "/ferramentas/cores");
  });
}
