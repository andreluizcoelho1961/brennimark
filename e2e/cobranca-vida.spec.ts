import { expect, test, type Page } from "@playwright/test";

/**
 * A vida da assinatura na tela (cobrança, fatia 3, 01/10/2026): a aba Plano
 * de Configurações, o Portal do Stripe e o aviso de atraso na moldura. As APIs
 * são fingidas; a regra (tolerância de 7 dias, só leitura, limite de marcas)
 * está provada no banco.
 */
const PLANO = {
  assinada: true, plano: "Básico", acesso: "ativa", marcas: { usadas: 5, maximo: 5 },
  pagoAte: "2026-11-01T12:00:00Z", cancelaNoFim: false, soLeituraAPartirDe: null, titular: "dona@agencia.com",
};

async function fingirPlano(page: Page, plano: unknown, portal: { status: number; json: unknown } = { status: 200, json: { url: "https://billing.stripe.test/p/sessao" } }) {
  await page.route("**/api/configuracoes/consumo**", (r) => r.fulfill({ status: 500, json: { message: "fora do teste" } }));
  await page.route("**/api/configuracoes/plano**", (r) => r.fulfill({ json: plano }));
  await page.route("**/api/cobranca/portal**", (r) => r.fulfill(portal));
  await page.route("https://billing.stripe.test/**", (r) => r.fulfill({ contentType: "text/html", body: "<h1>Portal de mentira</h1>" }));
}

test("a aba Plano mostra o plano, as marcas do limite e leva ao Portal do Stripe", async ({ page }) => {
  await fingirPlano(page, PLANO);
  await page.goto("/dev/configuracoes?parte=plano");
  await expect(page.locator('[data-parte="plano"]')).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-nome-do-plano]")).toHaveText("Básico");
  await expect(page.locator("[data-marcas-do-plano]")).toHaveText("5 de 5");
  await expect(page.locator("[data-limite-de-marcas]")).toContainText("chegou ao limite de marcas");
  await expect(page.locator("[data-aviso-de-atraso]")).toHaveCount(0);
  await page.locator("[data-gerenciar-assinatura]").click();
  await expect(page).toHaveURL("https://billing.stripe.test/p/sessao");
});

test("na tolerância, a aba diz até quando tudo funciona; em só leitura, o que parou e que nada foi apagado", async ({ page }) => {
  await fingirPlano(page, { ...PLANO, acesso: "tolerancia", soLeituraAPartirDe: "2026-10-08T12:00:00Z" });
  await page.goto("/dev/configuracoes?parte=plano");
  await expect(page.locator("[data-aviso-de-atraso]")).toContainText("Tudo continua funcionando até 8 de outubro de 2026");

  await page.unroute("**/api/configuracoes/plano**");
  await page.route("**/api/configuracoes/plano**", (r) => r.fulfill({ json: { ...PLANO, acesso: "so_leitura" } }));
  await page.reload();
  await expect(page.locator("[data-aviso-de-atraso]")).toContainText("Nada foi apagado");
});

test("conta sem assinatura online diz quem cuida do plano; o Portal sem chaves responde com frase", async ({ page }) => {
  await fingirPlano(page, { assinada: false });
  await page.goto("/dev/configuracoes?parte=plano");
  await expect(page.locator("[data-sem-assinatura]")).toContainText("aberta pela equipe da Brennimark");

  await page.unroute("**/api/configuracoes/plano**");
  await page.unroute("**/api/cobranca/portal**");
  await page.route("**/api/configuracoes/plano**", (r) => r.fulfill({ json: PLANO }));
  await page.route("**/api/cobranca/portal**", (r) => r.fulfill({ status: 503, json: { message: "A gestão da assinatura ainda não está disponível. Fale com a equipe da Brennimark." } }));
  await page.reload();
  await page.locator("[data-gerenciar-assinatura]").click();
  await expect(page.locator("[data-plano-da-conta] [role=alert]")).toContainText("ainda não está disponível");
});

for (const [acesso, administra, texto, link] of [
  ["tolerancia", true, "Tudo funciona até", true],
  ["so_leitura", true, "só para leitura", true],
  ["so_leitura", false, "Quem administra a conta pode regularizar", false],
] as const) {
  test(`o aviso da moldura: ${acesso}, ${administra ? "quem administra" : "quem não administra"}`, async ({ page }) => {
    const pedidos: string[] = [];
    await page.route("**/api/cobranca/situacao**", (r) => {
      pedidos.push(r.request().url());
      return r.fulfill({ json: { acesso, soLeituraAPartirDe: "2026-10-08T12:00:00Z", administra, conta: "agencia-exemplo" } });
    });
    await page.goto("/dev/aviso-da-cobranca/agencia-exemplo");
    const aviso = page.locator(`[data-aviso-da-cobranca="${acesso}"]`);
    await expect(aviso).toContainText(texto);
    await expect(aviso.getByRole("link", { name: "Regularizar o pagamento" })).toHaveCount(link ? 1 : 0);
    if (link) await expect(aviso.getByRole("link")).toHaveAttribute("href", "/w/agencia-exemplo/configuracoes?parte=plano");
    expect(new URL(pedidos[0]).searchParams.get("w")).toBe("agencia-exemplo");
  });
}

test("com a assinatura em dia, ou sem assinatura, o aviso não aparece", async ({ page }) => {
  await page.route("**/api/cobranca/situacao**", (r) => r.fulfill({ json: { acesso: "ativa", soLeituraAPartirDe: null, administra: true, conta: "x" } }));
  await page.goto("/dev/aviso-da-cobranca/agencia-exemplo");
  await expect(page.getByText("Conteúdo da conta")).toBeVisible();
  await expect(page.locator("[data-aviso-da-cobranca]")).toHaveCount(0);
});
