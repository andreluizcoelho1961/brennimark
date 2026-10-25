import { expect, test } from "@playwright/test";

/**
 * A confirmação do e-mail na lista (18/10/2026, double opt-in): a página do
 * botão do e-mail. A rota é fingida: a regra da função está provada em
 * `scripts/prova-cadastros-gratuitos.sh`.
 */
const TOKEN = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test("abrir a página não confirma nada: só o clique confirma", async ({ page }) => {
  let chamadas = 0;
  await page.route("**/api/cadastro/confirmar", (r) => { chamadas += 1; return r.fulfill({ json: { ok: true, achou: true } }); });
  await page.goto(`/confirmar/${TOKEN}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Confirme o seu e-mail");
  await page.waitForTimeout(800);
  expect(chamadas, "abrir o link (como faz um antivírus) não pode confirmar ninguém").toBe(0);
});

test("o clique manda o token e mostra que o e-mail está confirmado", async ({ page }) => {
  const corpos: unknown[] = [];
  await page.route("**/api/cadastro/confirmar", (r) => { corpos.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true, achou: true } }); });
  await page.goto(`/confirmar/${TOKEN}`);
  await page.locator("[data-confirmacao-confirmar]").click();
  await expect(page.locator("[data-confirmacao-resultado=feito]")).toContainText("está confirmado");
  expect(corpos).toEqual([{ token: TOKEN }]);
});

test("cadastro que saiu da lista ou não existe é dito com clareza", async ({ page }) => {
  await page.route("**/api/cadastro/confirmar", (r) => r.fulfill({ json: { ok: true, achou: false } }));
  await page.goto(`/confirmar/${TOKEN}`);
  await page.locator("[data-confirmacao-confirmar]").click();
  await expect(page.locator("[data-confirmacao-resultado=sem-cadastro]")).toContainText("Não foi possível confirmar");
});

test("falha do servidor deixa tentar de novo", async ({ page }) => {
  await page.route("**/api/cadastro/confirmar", (r) => r.fulfill({ status: 500, json: { message: "x" } }));
  await page.goto(`/confirmar/${TOKEN}`);
  await page.locator("[data-confirmacao-confirmar]").click();
  await expect(page.locator("[data-confirmacao-erro]")).toBeVisible();
  await expect(page.locator("[data-confirmacao-confirmar]")).toBeEnabled();
});

test("link torto mostra 'não é válido' e não oferece ação", async ({ page }) => {
  await page.goto("/confirmar/isto-nao-e-um-token");
  await expect(page.locator("[data-confirmacao-invalida]")).toContainText("não é válido");
  await expect(page.locator("[data-confirmacao-confirmar]")).toHaveCount(0);
});

test("a página não é indexada e não vaza o token pelo Referer", async ({ page }) => {
  await page.goto(`/confirmar/${TOKEN}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});
