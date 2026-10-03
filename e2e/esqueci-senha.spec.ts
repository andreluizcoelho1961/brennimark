import { expect, test } from "@playwright/test";

/**
 * "Esqueci a senha" (03/10/2026). A suíte não tem serviço de e-mail nem chave
 * de serviço: o que se prova aqui é o caminho da tela e as travas da rota —
 * as regras do segredo têm teste de unidade (`recuperacao.test.ts`).
 */
test("o login oferece o Esqueci a senha, e a página abre sem sessão", async ({ page }) => {
  await page.goto("/login");
  await page.locator("[data-esqueci-a-senha]").click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
  await expect(page.getByRole("heading", { name: "Esqueci a senha" })).toBeVisible();
});

test("sem serviço de e-mail, a rota diz que a recuperação não está ligada — igual para qualquer e-mail", async ({ request }) => {
  for (const email of ["existe@agencia.com", "ninguem@lugar-nenhum.test"]) {
    const r = await request.post("/api/conta/esqueci-senha", { data: { email }, maxRedirects: 0 });
    expect(r.status()).toBe(503);
    expect((await r.json()).message).toMatch(/ainda não está ligada/);
  }
  const ruim = await request.post("/api/conta/esqueci-senha", { data: { email: "sem-arroba" }, maxRedirects: 0 });
  expect(ruim.status()).toBe(400);
});

test("a tela repete a resposta do servidor: enviado, ou a recusa", async ({ page }) => {
  await page.route("**/api/conta/esqueci-senha", (rota) => rota.fulfill({
    json: { ok: true, message: "Se este e-mail tiver acesso ao Brennimark, enviamos um link para criar uma nova senha." },
  }));
  await page.goto("/esqueci-senha");
  await page.getByPlaceholder("voce@empresa.com").fill("fulana@agencia.com");
  await page.getByRole("button", { name: "Enviar o link" }).click();
  await expect(page.locator("[data-resposta-do-pedido]")).toContainText("Se este e-mail tiver acesso");
  await expect(page.getByRole("button", { name: "Enviar o link" })).toHaveCount(0);
});

test("a troca sem sessão não acontece: página e rota", async ({ page, request }) => {
  await page.goto("/nova-senha?r=" + "a".repeat(64));
  await expect(page).not.toHaveURL(/\/nova-senha/);
  const r = await request.post("/api/conta/nova-senha", {
    data: { segredo: "a".repeat(64), senha: "uma-senha-longa-o-bastante", confirmacao: "uma-senha-longa-o-bastante" }, maxRedirects: 0,
  });
  expect([401, 307]).toContain(r.status());
});
