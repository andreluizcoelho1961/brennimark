import { expect, test, type Page } from "@playwright/test";

/**
 * A porta do tour de demonstração (25/10/2026). A suíte não tem manual de
 * demonstração ligado nem a Cloudflare: o que se prova é a TELA — o formulário,
 * o Turnstile (trocado por um duplo que entrega o token na hora), o que vai ao
 * servidor e o que a pessoa vê quando ele recusa. As regras do servidor têm
 * teste de unidade e prova de banco.
 */
async function comTurnstileDeMentira(page: Page) {
  await page.route("**/challenges.cloudflare.com/**", (rota) => rota.fulfill({
    contentType: "application/javascript",
    body: `window.turnstile = { render: (alvo, o) => { setTimeout(() => o.callback("token-de-teste"), 50); return "w1"; }, reset: () => {}, remove: () => {} };`,
  }));
}

test("a página abre sem sessão e tem nome, e-mail, a caixa desmarcada e o botão", async ({ page }) => {
  await comTurnstileDeMentira(page);
  await page.goto("/demonstracao");
  await expect(page.getByRole("heading", { name: "Conheça o Brennimark por dentro" })).toBeVisible();
  await expect(page.locator("[data-tour-nome]")).toBeVisible();
  await expect(page.locator("[data-tour-email]")).toBeVisible();
  await expect(page.locator("[data-tour-aceite]")).not.toBeChecked();
  await expect(page.locator("[data-tour-enviar]")).toBeEnabled();
});

test("o pedido leva nome, e-mail, a caixa de marketing, o idioma e o token — e a origem não é do navegador", async ({ page }) => {
  await comTurnstileDeMentira(page);
  let corpo: Record<string, unknown> | null = null;
  await page.route("**/api/demonstracao/entrar", (rota) => {
    corpo = rota.request().postDataJSON();
    return rota.fulfill({ status: 200, json: { ok: true, destino: "/esqueci-senha", expiraEm: "2026-10-28T12:00:00Z" } });
  });
  await page.goto("/demonstracao");
  await page.locator("[data-tour-nome]").fill("Ana da Prova");
  await page.locator("[data-tour-email]").fill("ana@estudio.com");
  await page.locator("[data-tour-aceite]").check();
  await page.waitForTimeout(300);
  await page.locator("[data-tour-enviar]").click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
  expect(corpo).toMatchObject({ nome: "Ana da Prova", email: "ana@estudio.com", aceiteMarketing: true, idioma: "pt-BR", token: "token-de-teste" });
  expect(corpo).not.toHaveProperty("origem");
});

test("a recusa do servidor aparece na tela, com a mensagem dele", async ({ page }) => {
  await comTurnstileDeMentira(page);
  await page.route("**/api/demonstracao/entrar", (rota) => rota.fulfill({
    status: 429, json: { message: "O tour atingiu o limite de visitas de hoje. Volte amanhã ou fale com a gente." },
  }));
  await page.goto("/demonstracao");
  await page.locator("[data-tour-nome]").fill("Ana");
  await page.locator("[data-tour-email]").fill("ana@estudio.com");
  await page.waitForTimeout(300);
  await page.locator("[data-tour-enviar]").click();
  await expect(page.locator("[data-tour-erro]")).toContainText("limite de visitas de hoje");
  await expect(page.locator("[data-tour-enviar]")).toBeEnabled();
});

test("sem o Turnstile resolvido, nada vai ao servidor", async ({ page }) => {
  await page.route("**/challenges.cloudflare.com/**", (rota) => rota.fulfill({
    contentType: "application/javascript", body: `window.turnstile = { render: () => "w1", reset: () => {}, remove: () => {} };`,
  }));
  let chamou = false;
  await page.route("**/api/demonstracao/entrar", (rota) => { chamou = true; return rota.fulfill({ json: { ok: true } }); });
  await page.goto("/demonstracao");
  await page.locator("[data-tour-nome]").fill("Ana");
  await page.locator("[data-tour-email]").fill("ana@estudio.com");
  await page.locator("[data-tour-enviar]").click();
  await expect(page.locator("[data-tour-erro]")).toContainText("verificação");
  expect(chamou).toBe(false);
});

test("em inglês, a tela e o pedido saem em inglês", async ({ browser }) => {
  const contexto = await browser.newContext();
  await contexto.addCookies([{ name: "BRENNIMARK_IDIOMA", value: "en", domain: "localhost", path: "/" }]);
  const page = await contexto.newPage();
  await comTurnstileDeMentira(page);
  let corpo: Record<string, unknown> | null = null;
  await page.route("**/api/demonstracao/entrar", (rota) => {
    corpo = rota.request().postDataJSON();
    return rota.fulfill({ status: 200, json: { ok: true, destino: "/esqueci-senha", expiraEm: "2026-10-28T12:00:00Z" } });
  });
  await page.goto("/demonstracao");
  await expect(page.getByRole("heading", { name: "See Brennimark from the inside" })).toBeVisible();
  await page.locator("[data-tour-nome]").fill("Ann");
  await page.locator("[data-tour-email]").fill("ann@studio.com");
  await page.waitForTimeout(300);
  await page.locator("[data-tour-enviar]").click();
  await expect(page).toHaveURL(/\/esqueci-senha$/);
  expect(corpo).toMatchObject({ idioma: "en" });
  await contexto.close();
});

test("a rota de estado não entrega nada a quem não é visitante do tour", async ({ request }) => {
  const r = await request.get("/api/demonstracao/estado");
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ visitante: false });
});

test("o site oferece o tour: botão na home, nos dois idiomas, levando à porta", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator('[data-tour-botao="hero"]');
  await expect(hero).toContainText("Faça um tour");
  await expect(hero).toHaveAttribute("href", "/demonstracao");
  await page.goto("/en");
  await expect(page.locator('[data-tour-botao="hero"]')).toContainText("Take a tour");
  await expect(page.locator('[data-tour-botao="fecho"]')).toHaveAttribute("href", "/demonstracao");
});

test("o visitante do tour sempre tem como voltar ao site: na faixa e no último passo do tour guiado", async ({ page }) => {
  await page.route("**/api/demonstracao/estado", (rota) => rota.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ visitante: true, restantes: 1, feitas: 1, limite: 2, expiraEm: null }),
  }));
  await page.goto("/dev/moldura");
  const faixa = page.locator("[data-faixa-do-tour]");
  await expect(faixa).toBeVisible();
  await expect(faixa.locator("[data-tour-voltar-ao-site]")).toHaveAttribute("href", "/");

  // O tour guiado abre sozinho na primeira visita; no último passo, o link de voltar está ao lado do de assinar.
  const guiado = page.locator("[data-tour-guiado]");
  await expect(guiado).toBeVisible();
  for (let i = 0; i < 20 && (await guiado.getAttribute("data-passo")) !== "fim"; i += 1) {
    await guiado.locator("[data-tour-proximo]").click();
  }
  await expect(guiado).toHaveAttribute("data-passo", "fim");
  await expect(guiado.locator('a[href="/assinar"]')).toBeVisible();
  await expect(guiado.locator("[data-tour-voltar-ao-site]")).toHaveAttribute("href", "/");
});
