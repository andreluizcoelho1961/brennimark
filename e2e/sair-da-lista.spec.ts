import { expect, test } from "@playwright/test";

/**
 * A saída da lista de cadastros (17/10/2026): a página do link de todo e-mail
 * de marketing. A rota é fingida: a regra das funções de saída está provada em
 * `scripts/prova-cadastros-gratuitos.sh`.
 */
const TOKEN = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

test("abrir a página não faz nada: só os clicos fazem", async ({ page }) => {
  let chamadas = 0;
  await page.route("**/api/cadastro/saida", (r) => { chamadas += 1; return r.fulfill({ json: { ok: true, achou: true } }); });
  await page.goto(`/sair/${TOKEN}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sair da lista do Brennimark");
  await page.waitForTimeout(800);
  expect(chamadas, "abrir o link (como faz um antivírus) não pode apagar nem descadastrar ninguém").toBe(0);
});

test("parar de receber: um clique, o token e a ação certa", async ({ page }) => {
  const corpos: unknown[] = [];
  await page.route("**/api/cadastro/saida", (r) => { corpos.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true, achou: true, acao: "sair" } }); });
  await page.goto(`/sair/${TOKEN}`);
  await page.locator("[data-saida-sair]").click();
  await expect(page.locator("[data-saida-resultado=feito-sair]")).toContainText("não vai mais receber e-mails");
  expect(corpos).toEqual([{ token: TOKEN, acao: "sair" }]);
});

test("apagar pede um segundo clique, e Cancelar volta sem apagar", async ({ page }) => {
  let chamadas = 0;
  await page.route("**/api/cadastro/saida", (r) => { chamadas += 1; return r.fulfill({ json: { ok: true, achou: true } }); });
  await page.goto(`/sair/${TOKEN}`);
  await page.locator("[data-saida-apagar]").click();
  await expect(page.locator("[data-saida-apagar-confirmar]")).toBeVisible();
  await page.locator("[data-saida-apagar-cancelar]").click();
  await expect(page.locator("[data-saida-apagar]")).toBeVisible();
  expect(chamadas).toBe(0);
});

test("apagar de vez manda a ação apagar e diz que o cadastro foi apagado", async ({ page }) => {
  const corpos: unknown[] = [];
  await page.route("**/api/cadastro/saida", (r) => { corpos.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true, achou: true, acao: "apagar" } }); });
  await page.goto(`/sair/${TOKEN}`);
  await page.locator("[data-saida-apagar]").click();
  await page.locator("[data-saida-apagar-confirmar]").click();
  await expect(page.locator("[data-saida-resultado=feito-apagar]")).toContainText("foi apagado");
  expect(corpos).toEqual([{ token: TOKEN, acao: "apagar" }]);
});

test("cadastro que já não existe é dito com clareza, e falha do servidor deixa tentar de novo", async ({ page }) => {
  await page.route("**/api/cadastro/saida", (r) => r.fulfill({ json: { ok: true, achou: false } }));
  await page.goto(`/sair/${TOKEN}`);
  await page.locator("[data-saida-sair]").click();
  await expect(page.locator("[data-saida-resultado=nao-achou]")).toBeVisible();

  await page.unroute("**/api/cadastro/saida");
  await page.route("**/api/cadastro/saida", (r) => r.fulfill({ status: 500, json: { message: "x" } }));
  await page.goto(`/sair/${TOKEN}`);
  await page.locator("[data-saida-sair]").click();
  await expect(page.locator("[data-saida-erro]")).toBeVisible();
  await expect(page.locator("[data-saida-sair]")).toBeEnabled();
});

test("link torto mostra 'não é válido' e não oferece ação nenhuma", async ({ page }) => {
  await page.goto("/sair/isto-nao-e-um-token");
  await expect(page.locator("[data-saida-invalida]")).toContainText("não é válido");
  await expect(page.locator("[data-saida-sair]")).toHaveCount(0);
  await expect(page.locator("[data-saida-apagar]")).toHaveCount(0);
});

test("a página não é indexada e não vaza o token pelo Referer", async ({ page }) => {
  await page.goto(`/sair/${TOKEN}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});
