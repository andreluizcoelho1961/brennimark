import { expect, test, type Page } from "@playwright/test";

/**
 * Campo de texto em tela de toque não pode ter letra abaixo de 16 px.
 *
 * Abaixo disso o Safari do iPhone dá zoom sozinho na página ao tocar no campo,
 * e a página fica ampliada e cortada (ensaio de 26/09/2026: o campo do Vini
 * tinha 14 px). A regra vive em `globals.css`, para `(pointer: coarse)`.
 *
 * `isMobile` só existe no Chromium; os outros navegadores pulam.
 */

async function menorLetraDosCampos(page: Page) {
  return page.evaluate(() => {
    const campos = [...document.querySelectorAll<HTMLElement>("input, textarea, select")].filter((c) => {
      const tipo = c.getAttribute("type");
      if (tipo && ["checkbox", "radio", "range", "file", "hidden"].includes(tipo)) return false;
      const caixa = c.getBoundingClientRect();
      return caixa.width > 0 && caixa.height > 0;
    });
    return {
      quantos: campos.length,
      menor: Math.min(...campos.map((c) => parseFloat(getComputedStyle(c).fontSize))),
    };
  });
}

test.describe("no celular", () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

  for (const caminho of ["/login", "/dev/pessoas", "/dev/materiais?gerencia=1", "/dev/admin-panel"]) {
    test(`nenhum campo abaixo de 16 px em ${caminho}`, async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "isMobile só no Chromium");
      await page.goto(caminho);
      await expect(page.locator("input, textarea, select").first()).toBeVisible();
      const { quantos, menor } = await menorLetraDosCampos(page);
      expect(quantos).toBeGreaterThan(0);
      expect(menor).toBeGreaterThanOrEqual(16);
    });
  }
});

test("no computador, a regra não mexe: o campo continua com a letra da própria classe", async ({ page }) => {
  await page.goto("/dev/admin-panel");
  await expect(page.locator("input, textarea, select").first()).toBeVisible();
  const { menor } = await menorLetraDosCampos(page);
  expect(menor).toBeLessThan(16);
});
