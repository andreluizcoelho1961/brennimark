import { expect, test, type Page } from "@playwright/test";

/**
 * A compra pelo site (cobrança, fatia 2, 01/10/2026). `/api/cobranca/checkout`
 * é fingido: o que se prova aqui é o caminho da tela — escolher plano e moeda,
 * dizer quem assina, ir ao Stripe, e a recusa com a frase do servidor.
 */
type Pedido = Record<string, unknown>;

async function fingir(page: Page, pedidos: Pedido[], resposta: { status: number; json: unknown }) {
  await page.route("**/api/cobranca/checkout", async (rota) => {
    pedidos.push(rota.request().postDataJSON());
    await rota.fulfill(resposta);
  });
  // O "Stripe" da suíte: uma página qualquer, só para provar o redirecionamento.
  await page.route("https://checkout.stripe.test/**", (rota) => rota.fulfill({ contentType: "text/html", body: "<h1>Stripe de mentira</h1>" }));
}

async function preencher(page: Page) {
  await page.getByLabel("Seu nome").fill("Fulana de Tal");
  await page.getByLabel("E-mail").fill("fulana@agencia.com");
  await page.getByLabel("Empresa").fill("Agência Exemplo");
}

test("escolher plano e moeda e ir ao pagamento manda o pedido sem preço nenhum", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos, { status: 200, json: { url: "https://checkout.stripe.test/c/pay/x" } });
  await page.goto("/dev/assinar?plano=medio");
  await expect(page.locator('[data-plano="medio"]')).toHaveClass(/border-platform-signal/);
  await page.locator('[data-plano="premium"]').click();
  await page.locator('[data-moeda="USD"]').click();
  await preencher(page);
  await page.locator("[data-ir-ao-pagamento]").click();
  await expect(page).toHaveURL("https://checkout.stripe.test/c/pay/x");
  expect(pedidos).toEqual([{ plano: "premium", moeda: "USD", nome: "Fulana de Tal", email: "fulana@agencia.com", empresa: "Agência Exemplo" }]);
});

test("a recusa do servidor aparece com a frase dele, e o botão volta", async ({ page }) => {
  await fingir(page, [], { status: 409, json: { message: "Este plano ainda não está à venda nesta moeda." } });
  await page.goto("/dev/assinar");
  await preencher(page);
  await page.locator("[data-ir-ao-pagamento]").click();
  await expect(page.locator("[data-erro-da-assinatura]")).toHaveText("Este plano ainda não está à venda nesta moeda.");
  await expect(page.locator("[data-ir-ao-pagamento]")).toBeEnabled();
});

test("sem plano à venda, a página diz que a compra ainda não abriu", async ({ page }) => {
  await page.goto("/dev/assinar?vazio=1");
  await expect(page.locator("[data-assinatura-fechada]")).toContainText("ainda não está aberta");
  await expect(page.locator("[data-formulario-de-assinatura]")).toHaveCount(0);
});

test("a página real e a volta do pagamento abrem sem sessão; a volta não afirma que a conta existe", async ({ page }) => {
  const r = await page.goto("/assinar");
  expect(r?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Assinar" })).toBeVisible();
  await page.goto("/assinar/obrigado?sessao=cs_test_qualquer");
  await expect(page.locator("[data-volta-do-pagamento]")).toContainText("Assim que o Stripe confirmar o pagamento");
});

test("a compra sem chaves do Stripe responde com frase, nunca com redirecionamento ao login", async ({ request }) => {
  const r = await request.post("/api/cobranca/checkout", {
    data: { plano: "basico", moeda: "BRL", nome: "A", email: "a@b.co", empresa: "E" }, maxRedirects: 0,
  });
  // A suíte tem chave do Stripe falsa mas não tem chave de serviço: 503, com frase.
  expect(r.status()).toBe(503);
  expect((await r.json()).message).toMatch(/ainda não está aberta/);
});
