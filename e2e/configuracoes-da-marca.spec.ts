import { expect, test } from "@playwright/test";

/**
 * Nome editável e apagar marca, na administração (ensaio de 25/09/2026).
 *
 * As APIs são interceptadas, como em `recuperacao-de-pagina.spec.ts`: a
 * permissão de apagar está provada em SQL (`delete_brand_with_files` exige
 * `administrar` na marca). O que se prova aqui é o caminho pela interface —
 * em especial, que apagar NÃO acontece sem digitar o nome.
 */

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
  await confirmar.click();

  await expect.poll(() => pedidos).toBe(1);
  expect(corpo).toEqual({ brandId: "00000000-0000-4000-8000-000000000001" });
  // Sem conta no endereço (bancada), o destino é a entrada do produto.
  await expect(page).not.toHaveURL(/\/dev\/admin-panel/);
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
