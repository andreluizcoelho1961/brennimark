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

test("o capítulo tem quatro cartões do mesmo tamanho, e o primeiro é o Fonts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "commit" });
  const cartoes = page.locator("#ferramentas .ferr");
  await expect(cartoes).toHaveCount(4);
  await expect(cartoes.first().getByRole("heading", { level: 3 })).toHaveText("Fonts");
  await expect(cartoes.first()).toHaveClass(/ferr--destaque/);
  await expect(cartoes.first().getByRole("link", { name: /Pedir convite/ })).toHaveAttribute("href", "/fonts");
  const alturas = await cartoes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(alturas).size, "os quatro cartões têm a mesma altura").toBe(1);
});

test("no /fonts, o botão de pedir acesso aparece na primeira tela", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/fonts", { waitUntil: "commit" });
  const botao = page.locator("[data-fonts-pedir]");
  await expect(botao).toBeVisible();
  const caixa = await botao.boundingBox();
  expect(caixa!.y + caixa!.height, "o botão inteiro cabe em 720 px de altura").toBeLessThanOrEqual(720);
});
