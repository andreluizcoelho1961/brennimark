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
  await expect(page.locator("[data-form-senha-na-volta]")).toHaveCount(0);
});

test("a compra sem chaves do Stripe responde com frase, nunca com redirecionamento ao login", async ({ request }) => {
  const r = await request.post("/api/cobranca/checkout", {
    data: { plano: "basico", moeda: "BRL", nome: "A", email: "a@b.co", empresa: "E" }, maxRedirects: 0,
  });
  // A suíte tem chave do Stripe falsa mas não tem chave de serviço: 503, com frase.
  expect(r.status()).toBe(503);
  expect((await r.json()).message).toMatch(/ainda não está aberta/);
});

/*
 * A senha criada na volta do pagamento (02/10/2026). A rota real só é
 * chamada no teste da prova; o resto finge `/api/cobranca/senha` para provar
 * o caminho da tela: esperar a conta nascer, criar a senha, e cada recusa.
 */
const SESSAO = "cs_test_a1eNK1SDCZHePJDbofUqmnMxVvrWim0F5WKAUYllFzNtO6rOVmhNLwiaqw";

test("sem a prova do navegador, a rota real não diz nada da compra — e nem consulta o Stripe", async ({ request }) => {
  const r = await request.post("/api/cobranca/senha", { data: { sessao: SESSAO, acao: "criar", senha: "uma-senha-longa-o-bastante", confirmacao: "uma-senha-longa-o-bastante" }, maxRedirects: 0 });
  // A suíte tem chave do Stripe FALSA: se a rota a usasse, responderia 502.
  expect(r.status()).toBe(200);
  expect(await r.json()).toEqual({ momento: "sem-prova" });
  const ruim = await request.post("/api/cobranca/senha", { data: { sessao: "../../x" }, maxRedirects: 0 });
  expect(ruim.status()).toBe(400);
});

test("o checkout real não deixa cookie quando não abre o pagamento", async ({ request }) => {
  const r = await request.post("/api/cobranca/checkout", {
    data: { plano: "basico", moeda: "BRL", nome: "A", email: "a@b.co", empresa: "E" }, maxRedirects: 0,
  });
  expect(r.status()).toBe(503);
  expect(r.headers()["set-cookie"] ?? "").not.toContain("bm_prova_da_compra");
});

test("pagou: espera a conta nascer, cria a senha conferida antes de enviar, e tenta entrar", async ({ page }) => {
  const pedidos: Pedido[] = [];
  let vezes = 0;
  await page.route("**/api/cobranca/senha", async (rota) => {
    const corpo = rota.request().postDataJSON() as Pedido;
    pedidos.push(corpo);
    if (corpo.acao === "ver") {
      vezes += 1;
      return rota.fulfill({ json: vezes < 4 ? { momento: "aguardando", email: null } : { momento: "criar-senha", email: "fulana@agencia.com" } });
    }
    return rota.fulfill({ json: { momento: "ja-tem-acesso", email: "fulana@agencia.com", destino: "/docs" } });
  });
  // A entrada automática falha de propósito: a tela precisa mandar ao login, não travar.
  await page.route("**/auth/v1/token**", (rota) => rota.fulfill({ status: 400, json: { error: "invalid_grant" } }));

  await page.goto(`/assinar/obrigado?sessao=${SESSAO}`);
  await expect(page.locator("[data-volta-do-pagamento]")).toHaveAttribute("data-momento", "aguardando");
  await expect(page.locator("[data-form-senha-na-volta]")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel("E-mail")).toHaveValue("fulana@agencia.com");

  await page.getByLabel("Senha", { exact: true }).fill("curta");
  await page.getByLabel("Repita a senha").fill("curta");
  await page.getByRole("button", { name: "Criar senha e entrar" }).click();
  await expect(page.locator("[data-erro-da-senha]")).toHaveText("A senha precisa de ao menos 12 caracteres.");
  expect(pedidos.filter((p) => p.acao === "criar")).toHaveLength(0);

  await page.getByLabel("Senha", { exact: true }).fill("uma-senha-longa-o-bastante");
  await page.getByLabel("Repita a senha").fill("outra-senha-longa-demais");
  await page.getByRole("button", { name: "Criar senha e entrar" }).click();
  await expect(page.locator("[data-erro-da-senha]")).toHaveText("As duas senhas não são iguais.");

  await page.getByLabel("Repita a senha").fill("uma-senha-longa-o-bastante");
  await page.getByRole("button", { name: "Criar senha e entrar" }).click();
  await expect(page.locator("[data-volta-do-pagamento]")).toHaveAttribute("data-momento", "ja-tem-acesso");
  await expect(page.getByRole("link", { name: "Entrar" }).first()).toHaveAttribute("href", "/login");
  expect(pedidos.filter((p) => p.acao === "criar")).toEqual([
    { sessao: SESSAO, acao: "criar", senha: "uma-senha-longa-o-bastante", confirmacao: "uma-senha-longa-o-bastante" },
  ]);
});

test("e-mail que já tinha login: a tela manda entrar, sem formulário de senha", async ({ page }) => {
  await page.route("**/api/cobranca/senha", (rota) => rota.fulfill({ json: { momento: "ja-tem-acesso", email: "fulana@agencia.com" } }));
  await page.goto(`/assinar/obrigado?sessao=${SESSAO}`);
  await expect(page.locator("[data-volta-do-pagamento]")).toHaveAttribute("data-momento", "ja-tem-acesso");
  await expect(page.locator("[data-volta-do-pagamento]")).toContainText("fulana@agencia.com");
  await expect(page.locator("[data-form-senha-na-volta]")).toHaveCount(0);
});

test("prazo vencido e falha de rede dizem o que fazer", async ({ page }) => {
  await page.route("**/api/cobranca/senha", (rota) => rota.fulfill({ json: { momento: "expirado", email: null } }));
  await page.goto(`/assinar/obrigado?sessao=${SESSAO}`);
  await expect(page.locator("[data-volta-sem-senha]")).toContainText("O prazo para criar a senha por esta página passou");

  await page.unroute("**/api/cobranca/senha");
  await page.route("**/api/cobranca/senha", (rota) => rota.fulfill({ status: 500, json: { message: "x" } }));
  await page.reload();
  await expect(page.locator("[data-volta-sem-senha]")).toContainText("Recarregue esta página");
});
