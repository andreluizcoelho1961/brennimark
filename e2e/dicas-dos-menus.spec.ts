import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * As dicas dos menus (15/10/2026, pedido do André): passar o mouse ou chegar
 * pelo teclado mostra o que a ferramenta faz. `toPass` repete até a página
 * ligar — passar o mouse antes disso não abre nada, e é só o teste adiantado.
 */
async function dicaAoPassar(page: Page, alvo: Locator) {
  await expect(async () => {
    await page.mouse.move(900, 450);
    await alvo.hover();
    await expect(page.locator("[data-dica]")).toBeVisible({ timeout: 1500 });
  }).toPass({ timeout: 20_000 });
  return page.locator("[data-dica]");
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/marcas?marca=festival");
});

test("a coluna diz o que cada ferramenta faz, e o leitor de tela ouve a frase", async ({ page }) => {
  const item = page.locator('[data-item-da-coluna="pessoas"]');
  const dica = await dicaAoPassar(page, item);
  await expect(dica).toHaveText("Pessoas e acessoQuem entra em cada marca e o que cada pessoa pode fazer.");
  const id = await dica.getAttribute("id");
  await expect(item).toHaveAttribute("aria-describedby", id!);
  await page.mouse.move(900, 450);
  await expect(page.locator("[data-dica]")).toHaveCount(0);
});

test("as abas, a busca e o Vini também têm dica; Esc fecha", async ({ page }) => {
  await expect(await dicaAoPassar(page, page.locator('[data-parte-do-segmentado="materiais"]'))).toHaveText("Logos, imagens e arquivos da marca, prontos para baixar.");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-dica]")).toHaveCount(0);
  await expect(await dicaAoPassar(page, page.locator("[data-abrir-busca]"))).toHaveText("Procure qualquer regra no manual da marca.");
  const vini = await dicaAoPassar(page, page.locator("[data-botao-do-vini]"));
  await expect(vini).toContainText("o Vini responde citando a página do manual");
  // No canto da tela, a dica não sai pela borda.
  const caixa = (await vini.boundingBox())!;
  expect(caixa.x + caixa.width).toBeLessThanOrEqual(1440 - 7);
});

test("pelo teclado a dica aparece na hora", async ({ page }) => {
  const item = page.locator('[data-item-da-coluna="registros"]');
  await expect(async () => {
    await item.blur();
    await item.focus();
    await expect(page.locator("[data-dica]")).toContainText("Quem acessou, baixou e mudou o quê, e quando.", { timeout: 1500 });
  }).toPass({ timeout: 20_000 });
});

// ─── Etapa 2: os controles dentro das ferramentas (15/10/2026) ──────────────

test("no Grids, os botões dizem o que fazem", async ({ page }) => {
  await page.goto("/ferramentas/grids");
  await expect(await dicaAoPassar(page, page.locator("[data-grids-baixar-pdf]"))).toHaveText("O grid em PDF, para usar em outros programas.");
  await expect(await dicaAoPassar(page, page.locator('[data-grids-tipo="modular"]'))).toHaveText("O tipo de grid, da classificação de Timothy Samara.");
});

test("na administração, adicionar e ler pela IA têm dica", async ({ page }) => {
  await page.goto("/dev/admin-panel");
  await expect(await dicaAoPassar(page, page.locator("[data-adicionar-fonte]"))).toHaveText("Cadastra à mão uma cor ou fonte do manual.");
  await expect(await dicaAoPassar(page, page.locator("[data-ler-tipografia]"))).toHaveText("A IA lê as páginas do manual e preenche o que falta, como rascunho.");
});
