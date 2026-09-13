import { expect, test } from "@playwright/test";

/**
 * A tela inicial — a porta do produto depois do login.
 *
 * Ela passou a aparecer SEMPRE em 12/09/2026, por decisão do André. Antes,
 * quem tinha uma marca só nunca a via: o login caía direto dentro do manual, e
 * o produto ficava sem uma tela que dissesse onde a pessoa está.
 *
 * A bancada `/dev/inicio?marcas=N` monta a tela sem banco e sem sessão — a
 * suíte é hermética, e a tela real depende das duas coisas.
 */

test("uma marca também vê a tela, com um card", async ({ page }) => {
  await page.goto("/dev/inicio?marcas=1");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Bem-vindo");
  const cards = page.locator("[data-card-de-marca]");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Marca 1");
  // Singular: "Sua marca", não "Suas marcas".
  await expect(page.getByRole("list", { name: /1 marca dispon/ })).toBeVisible();
});

test("dez marcas viram dez cards", async ({ page }) => {
  await page.goto("/dev/inicio?marcas=10");
  await expect(page.locator("[data-card-de-marca]")).toHaveCount(10);
  await expect(page.getByRole("list", { name: /10 marcas dispon/ })).toBeVisible();
});

test("o card leva ao endereço da marca", async ({ page }) => {
  await page.goto("/dev/inicio?marcas=3");
  const primeiro = page.locator("[data-card-de-marca]").first();
  // O endereço é o canônico da marca: conta e marca no caminho. Sem isso, o
  // card levaria a lugar nenhum e a tela viraria enfeite.
  await expect(primeiro).toHaveAttribute("href", /\/w\/conta-de-teste\/b\/marca-1/);
});

test("a apresentação diz as quatro frentes do produto", async ({ page }) => {
  await page.goto("/dev/inicio?marcas=2");
  /*
   * O texto descreve o produto PRONTO, por decisão do André em 13/09 — três
   * das quatro frentes ainda não estão inteiras. O que este caso tranca não é
   * a redação, é que a tela não volte a ser só uma lista de cards: sem
   * apresentação, ninguém que chega pela primeira vez sabe onde está.
   */
  const apresentacao = page.getByRole("list").first();
  await expect(apresentacao.getByText(/Ler/)).toBeVisible();
  await expect(apresentacao.getByText(/Baixar/)).toBeVisible();
  await expect(apresentacao.getByText(/citando a página/)).toBeVisible();
  await expect(apresentacao.getByText(/DNA da marca/)).toBeVisible();
});
