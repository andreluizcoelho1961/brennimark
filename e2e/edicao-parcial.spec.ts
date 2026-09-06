import { expect, test, type Page } from "@playwright/test";

/**
 * Prova o contrato na fronteira que o teste de unidade não alcança: o objeto
 * que sai do navegador. O laboratório contém corpo grande, imagem e bloco;
 * mudar o título não pode mandar nenhum deles por conveniência.
 */

async function interceptarAdministracao(page: Page, pedidos: Record<string, unknown>[]) {
  await page.route("**/api/admin/content**", async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname.endsWith("/history")) {
      await rota.fulfill({ status: 200, json: { pageDeleted: false, versions: [] } });
      return;
    }
    if (rota.request().method() === "PUT") {
      pedidos.push(rota.request().postDataJSON());
      await rota.fulfill({ status: 200, json: { ok: true, updatedAt: new Date(0).toISOString() } });
      return;
    }
    await rota.fallback();
  });
}

async function esperarEditorHidratado(page: Page) {
  // Visível não basta: o HTML do servidor já está na tela antes de o React
  // instalar os handlers. Digitar nessa janela curta é perdido pela
  // hidratação e fez o CI concatenar o valor novo ao corpo inicial.
  await expect(page.locator("[data-admin-editor-ready]"))
    .toHaveAttribute("data-admin-editor-ready", "true");
}

test("alterar o título envia somente slug e título", async ({ page }) => {
  const pedidos: Record<string, unknown>[] = [];
  await interceptarAdministracao(page, pedidos);
  await page.goto("/dev/admin-panel");
  await esperarEditorHidratado(page);

  const salvar = page.getByRole("button", { name: "Salvar página" });
  await expect(salvar).toBeDisabled();
  await page.getByRole("textbox", { name: "Título", exact: true }).fill("Cores institucionais");
  await salvar.click();

  await expect(page.getByText("Página salva. O guia e a IA já usam esta versão.")).toBeVisible();
  expect(pedidos).toEqual([{ slug: "cores", title: "Cores institucionais" }]);
  expect(pedidos[0]).not.toHaveProperty("body");
  expect(pedidos[0]).not.toHaveProperty("images");
  expect(pedidos[0]).not.toHaveProperty("blocks");
});

test("alterar texto envia o corpo integral e nenhum campo visual", async ({ page }) => {
  const pedidos: Record<string, unknown>[] = [];
  await interceptarAdministracao(page, pedidos);
  await page.goto("/dev/admin-panel");
  await esperarEditorHidratado(page);

  await page.getByRole("textbox", { name: "Texto — separe os parágrafos com uma linha em branco" })
    .fill("Primeiro parágrafo.\n\nSegundo parágrafo.");
  await page.getByRole("button", { name: "Salvar página" }).click();

  expect(pedidos).toEqual([{
    slug: "cores",
    body: ["Primeiro parágrafo.", "Segundo parágrafo."],
  }]);
  expect(pedidos[0]).not.toHaveProperty("images");
  expect(pedidos[0]).not.toHaveProperty("blocks");
});
