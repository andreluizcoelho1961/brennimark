import { expect, test } from "@playwright/test";

/**
 * A barra de cima da moldura em três larguras — 24/09/2026.
 *
 * A busca da plataforma fica só no ícone entre 768 e 1799 px (a barra leva o
 * segmentado e, a partir de 1280, as ações do manual) e volta por extenso a
 * partir de 1800. A primeira versão usava `md:hidden` com `min-[1800px]:inline`,
 * e em produção o `md` venceu a ordem das regras: a busca ficou no ícone até em
 * 1920 px, e nenhum teste viu.
 */
const LAB = "/dev/marcas";
const busca = /^(Buscar|Search)$/;

for (const [largura, porExtenso] of [[1920, true], [1440, false], [800, false]] as const) {
  test(`em ${largura}px a busca da plataforma ${porExtenso ? "aparece por extenso" : "fica no ícone"}`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await page.goto(LAB);
    const botao = page.locator("header").getByRole("button", { name: busca });
    await expect(botao).toBeVisible();
    const texto = botao.locator("span", { hasText: busca });
    if (porExtenso) await expect(texto).toBeVisible();
    else await expect(texto).toBeHidden();
  });
}

test("a zona do Brennimark é separada da marca aberta", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LAB);
  const header = page.locator("header");
  const zona = header.getByText("Brennimark", { exact: true }).locator("xpath=..");
  const borda = await zona.evaluate((el) => getComputedStyle(el).borderRightWidth);
  expect(borda).toBe("1px");
  expect((await zona.boundingBox())!.width).toBeGreaterThanOrEqual(176);
});
