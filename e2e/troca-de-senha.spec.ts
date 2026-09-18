import { expect, test } from "@playwright/test";

/**
 * A troca da senha provisória — o que a TELA faz.
 *
 * O que o banco garante (senha provisória não dá acesso; a ativação é do
 * servidor, depois da troca) está em `scripts/prova-senha-provisoria.sh`. O
 * desvio da moldura está nos testes de unidade de `senha-provisoria.ts`. Aqui
 * se prova o gesto, na bancada `/dev/trocar-senha`, com a rota fingida.
 */

test("a senha nova é conferida antes de sair da tela", async ({ page }) => {
  const enviados: unknown[] = [];
  await page.route("**/api/conta/trocar-senha", async (rota) => {
    enviados.push(rota.request().postDataJSON());
    await rota.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto("/dev/trocar-senha");

  await expect(page.getByRole("heading")).toHaveText(/Crie a sua senha/i);
  await expect(page.locator("[data-form-troca]")).toContainText(/provisória e vale até/);

  await page.getByLabel("Nova senha", { exact: true }).fill("curta");
  await page.getByLabel("Repita a nova senha").fill("curta");
  await page.getByRole("button", { name: "Salvar e entrar" }).click();
  await expect(page.locator("[data-erro-da-troca]")).toContainText(/12 caracteres/);

  await page.getByLabel("Nova senha", { exact: true }).fill("uma-senha-bem-longa");
  await page.getByLabel("Repita a nova senha").fill("uma-senha-bem-longx");
  await page.getByRole("button", { name: "Salvar e entrar" }).click();
  await expect(page.locator("[data-erro-da-troca]")).toContainText(/não são iguais/);

  expect(enviados, "a tela mandou uma senha que o servidor recusaria").toEqual([]);
});

test("com a senha certa, envia as duas e segue para dentro", async ({ page }) => {
  const enviados: unknown[] = [];
  await page.route("**/api/conta/trocar-senha", async (rota) => {
    enviados.push(rota.request().postDataJSON());
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/dev/trocar-senha");

  await page.getByLabel("Nova senha", { exact: true }).fill("uma-senha-bem-longa");
  await page.getByLabel("Repita a nova senha").fill("uma-senha-bem-longa");
  await page.getByRole("button", { name: "Salvar e entrar" }).click();

  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toEqual({ senha: "uma-senha-bem-longa", confirmacao: "uma-senha-bem-longa" });
  await expect(page).not.toHaveURL(/trocar-senha/);
});

test("a recusa do servidor aparece como ele a escreveu", async ({ page }) => {
  await page.route("**/api/conta/trocar-senha", (rota) => rota.fulfill({
    status: 410, contentType: "application/json",
    body: JSON.stringify({ message: "Esta senha provisória venceu. Peça uma nova a quem administra a conta." }),
  }));
  await page.goto("/dev/trocar-senha");

  await page.getByLabel("Nova senha", { exact: true }).fill("uma-senha-bem-longa");
  await page.getByLabel("Repita a nova senha").fill("uma-senha-bem-longa");
  await page.getByRole("button", { name: "Salvar e entrar" }).click();

  await expect(page.locator("[data-erro-da-troca]")).toContainText(/venceu/);
  await expect(page).toHaveURL(/trocar-senha/);
});

test("senha vencida não oferece formulário — diz a quem pedir outra", async ({ page }) => {
  await page.goto("/dev/trocar-senha?vencida=1");

  await expect(page.getByRole("heading")).toHaveText(/venceu/i);
  await expect(page.locator("[data-senha-vencida]")).toContainText(/Pessoas e acesso/);
  await expect(page.locator("[data-form-troca]")).toHaveCount(0);
});
