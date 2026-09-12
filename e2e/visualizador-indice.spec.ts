import { expect, test, type Page } from "@playwright/test";

/**
 * O índice do manual, nos três motores.
 *
 * ─── O que estes casos guardam, e por quê ───────────────────────────────────
 *
 * Medido em 12/09/2026 sobre 30 manuais de marca reais: **só 7 trazem
 * marcadores**, e ter marcador não é ter índice bom. O manual da Shell tem
 * quatro, chamados "SECTION 1" a "SECTION 4", para 37 páginas — um índice desses
 * é pior que nenhum, porque parece ser do estúdio e não diz nada.
 *
 * A fixture `indice-com-generico.pdf` reproduz exatamente isso em miniatura:
 * quatro marcadores, um deles "SECTION 2". O índice tem de mostrar os três
 * úteis e descartar o genérico.
 *
 * A regra vive em `src/lib/documento-fonte/indice.ts`, com teste de unidade;
 * o que só o navegador prova é a ponte — PDF.js lendo a árvore, resolvendo
 * destino em número de página, e o clique levando à página certa.
 */

const COM_INDICE = "/dev/visualizador?fixture=indice-com-generico.pdf";
const SEM_MARCADORES = "/dev/visualizador?fixture=manual-de-teste.pdf";

async function abrir(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
}

test("o índice vem dos marcadores do PDF, e o genérico fica de fora", async ({ page }) => {
  await abrir(page, COM_INDICE);

  await page.getByRole("button", { name: /^(Índice|Contents)$/ }).click();
  const indice = page.getByRole("navigation", { name: /Índice do manual|Manual contents/ });
  await expect(indice).toBeVisible();

  const itens = indice.locator("[data-indice-item]");
  await expect(itens).toHaveCount(3);
  await expect(itens.nth(0)).toContainText("Cores");
  await expect(itens.nth(1)).toContainText("Tipografia");
  await expect(itens.nth(2)).toContainText("Grid");
  // O genérico é o caso da Shell: se ele voltar, o índice volta a mentir.
  await expect(indice).not.toContainText("SECTION");
});

test("o índice diz que veio do próprio documento", async ({ page }) => {
  await abrir(page, COM_INDICE);
  await page.getByRole("button", { name: /^(Índice|Contents)$/ }).click();
  /*
   * Sumário do estúdio e índice proposto pela máquina não podem ser
   * apresentados com o mesmo silêncio — é a honestidade editorial do projeto,
   * e o mesmo princípio que tirou as páginas remontadas do caminho de leitura
   * no ADR-0006.
   */
  await expect(page.locator("[data-indice-fonte]")).toHaveAttribute("data-indice-fonte", "marcadores");
});

test("clicar num item leva à página daquele item", async ({ page }) => {
  await abrir(page, COM_INDICE);
  await page.getByRole("button", { name: /^(Índice|Contents)$/ }).click();

  await page.locator("[data-indice-item]", { hasText: "Grid" }).click();

  // O campo da barra é o que a pessoa lê para saber onde está.
  await expect.poll(async () => page.locator("#pagina-atual").inputValue(), { timeout: 10_000 })
    .toBe("4");
});

test("PDF sem marcadores e sem seções não mostra o botão de índice", async ({ page }) => {
  await abrir(page, SEM_MARCADORES);
  /*
   * Um botão que abre coluna vazia promete um sumário que o documento não tem.
   * São 23 dos 30 manuais medidos que caem aqui quando não há seções extraídas
   * — na bancada não há banco, então não há plano B.
   */
  await expect(page.getByRole("button", { name: /^(Índice|Contents)$/ })).toHaveCount(0);
});
