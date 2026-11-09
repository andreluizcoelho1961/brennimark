import { expect, test, type Page } from "@playwright/test";

/**
 * Nome editável e apagar marca, na administração (ensaio de 25/09/2026).
 *
 * As APIs são interceptadas, como em `recuperacao-de-pagina.spec.ts`: a
 * permissão de apagar está provada em SQL (`delete_brand_with_files` exige
 * `administrar` na marca). O que se prova aqui é o caminho pela interface —
 * em especial, que apagar NÃO acontece sem digitar o nome.
 */

/**
 * A tela PEDIU para ir à página inicial — o pedido de navegação do Next (com
 * o cabeçalho `RSC`) para `/`. Medido em 14/10/2026 no rastro de uma falha: o
 * envio levava 0,3 s e o pedido saía na hora; o que passava dos 5 s era o
 * servidor de DESENVOLVIMENTO montar a home a frio (3,1 s só para responder,
 * ~5,5 s com scripts, estilo e o `router.refresh()`). Em produção a home é
 * estática. Esperar a URL mudar media o servidor de teste, não a tela.
 */
function pedidoParaAInicial(page: Page) {
  return page.waitForRequest((r) => new URL(r.url()).pathname === "/" && r.headers()["rsc"] === "1", { timeout: 10_000 });
}

test("o nome da marca é editável e vai ao servidor já normalizado", async ({ page }) => {
  let corpo: unknown = null;
  await page.route("**/api/admin/brand**", async (rota) => {
    if (rota.request().method() === "PATCH") {
      corpo = rota.request().postDataJSON();
      await rota.fulfill({ status: 200, json: { ok: true, name: "Grupo HEINEKEN" } });
      return;
    }
    await rota.fallback();
  });

  await page.goto("/dev/admin-panel");
  const secao = page.getByRole("region", { name: "Nome da marca" });
  const campo = secao.getByRole("textbox");
  const salvar = secao.getByRole("button", { name: "Salvar nome" });

  await expect(campo).toHaveValue("Marca de Bancada");
  await expect(salvar).toBeDisabled();

  await campo.fill("  Grupo   HEINEKEN ");
  await salvar.click();

  await expect(secao.getByRole("status")).toHaveText("Nome salvo.");
  expect(corpo).toEqual({ name: "Grupo HEINEKEN" });
  await expect(campo).toHaveValue("Grupo HEINEKEN");
  await expect(salvar).toBeDisabled();
});

test("apagar a marca exige digitar o nome, e só então chama o servidor", async ({ page }) => {
  let pedidos = 0;
  let corpo: unknown = null;
  await page.route("**/api/admin/brand**", async (rota) => {
    if (rota.request().method() === "DELETE") {
      pedidos += 1;
      corpo = rota.request().postDataJSON();
      await rota.fulfill({ status: 200, json: { ok: true } });
      return;
    }
    await rota.fallback();
  });

  await page.goto("/dev/admin-panel");
  const secao = page.getByRole("region", { name: "Apagar marca" });
  await secao.getByRole("button", { name: "Apagar esta marca…" }).click();

  const confirmar = secao.getByRole("button", { name: "Apagar de vez" });
  const campo = secao.getByRole("textbox");
  await expect(confirmar).toBeDisabled();

  await campo.fill("Marca");
  await expect(confirmar).toBeDisabled();

  // Cancelar fecha sem pedir nada.
  await secao.getByRole("button", { name: "Cancelar" }).click();
  await expect(secao.getByRole("button", { name: "Apagar esta marca…" })).toBeVisible();
  expect(pedidos).toBe(0);

  await secao.getByRole("button", { name: "Apagar esta marca…" }).click();
  await secao.getByRole("textbox").fill("marca de bancada");
  await expect(confirmar).toBeEnabled();
  const indoParaAEntrada = pedidoParaAInicial(page);
  await confirmar.click();

  await expect.poll(() => pedidos).toBe(1);
  expect(corpo).toEqual({ brandId: "00000000-0000-4000-8000-000000000001" });
  // Sem conta no endereço (bancada), o destino é a entrada do produto.
  await indoParaAEntrada;
});

test("a recusa do servidor aparece e a marca continua", async ({ page }) => {
  await page.route("**/api/admin/brand**", async (rota) => {
    if (rota.request().method() === "DELETE") {
      await rota.fulfill({ status: 403, json: { message: "Não foi possível excluir a marca." } });
      return;
    }
    await rota.fallback();
  });

  await page.goto("/dev/admin-panel");
  const secao = page.getByRole("region", { name: "Apagar marca" });
  await secao.getByRole("button", { name: "Apagar esta marca…" }).click();
  await secao.getByRole("textbox").fill("Marca de Bancada");
  await secao.getByRole("button", { name: "Apagar de vez" }).click();

  await expect(secao.getByRole("alert")).toHaveText("Não foi possível excluir a marca.");
  await expect(page).toHaveURL(/\/dev\/admin-panel/);
});

test("apagar a marca avisa o que acontece com os links de entrega e com os registros", async ({ page }) => {
  await page.goto("/dev/admin-panel");
  const secao = page.getByRole("region", { name: "Apagar marca" });
  const aviso = secao.locator("[data-aviso-do-que-fica]");
  await expect(aviso).toContainText("links de entrega desta marca deixam de funcionar");
  await expect(aviso).toContainText("continuam guardados, mas deixam de aparecer em Registros");
});
