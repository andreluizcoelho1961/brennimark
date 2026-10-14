import { expect, test } from "@playwright/test";

/**
 * As ferramentas gratuitas no rodapé do site (10/10/2026): o da página inicial
 * e o das páginas internas levam ao Kit, ao Cores e ao Grids.
 */
for (const pagina of ["/", "/termos"]) {
  test(`o rodapé de ${pagina} leva ao Kit, ao Cores e ao Grids`, async ({ page }) => {
    // `commit`, não `load`: sob a suíte inteira, a home leva mais de 30 s para
    // terminar de chegar no servidor de desenvolvimento (ver `abrir`, em site.spec).
    await page.goto(pagina, { waitUntil: "commit" });
    const ferramentas = page.locator("[data-ferramentas-gratuitas]");
    await expect(ferramentas.getByRole("link", { name: "Kit: todos os tamanhos do logo" })).toHaveAttribute("href", "/ferramentas/kit");
    await expect(ferramentas.getByRole("link", { name: "Cores: que cor é essa?" })).toHaveAttribute("href", "/ferramentas/cores");
    await expect(ferramentas.getByRole("link", { name: "Grids: o grid pronto para o InDesign" })).toHaveAttribute("href", "/ferramentas/grids");
  });
}
