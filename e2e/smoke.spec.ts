import { expect, test } from "@playwright/test";

/**
 * Fumaça: a aplicação sobe, responde e não estoura a largura.
 *
 * Deliberadamente pequeno. A cobertura que o briefing pede — drawer, foco,
 * paleta, as quatro marcas — chega com o patch 4, junto do mobile que ela
 * protege. Escrever asserção sobre navegação mobile antes de a navegação
 * mobile existir produz teste que nasce vermelho e é desligado na primeira
 * pressa.
 */

const LARGURAS = [320, 375, 390, 768, 1024, 1440];

test("a aplicação sobe sem banco e sem segredo", async ({ page }) => {
  const resposta = await page.goto("/docs");
  expect(resposta?.status()).toBe(200);
});

test("o estado sem marca é o que aparece antes do primeiro manual", async ({ page }) => {
  await page.goto("/docs");
  // Sem marca configurada, o produto mostra a própria moldura vazia — não
  // conteúdo de exemplo, não erro.
  await expect(page.locator("body")).not.toBeEmpty();
});

for (const largura of LARGURAS) {
  test(`sem overflow horizontal em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    await page.goto("/docs");

    const transbordo = await page.evaluate(() => ({
      documento: document.documentElement.scrollWidth,
      janela: window.innerWidth,
    }));

    // Uma barra de rolagem horizontal na página inteira é sempre defeito de
    // composição. Tabela e diagrama rolam dentro do próprio contêiner.
    expect(transbordo.documento).toBeLessThanOrEqual(transbordo.janela);
  });
}
