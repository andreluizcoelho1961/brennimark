import { expect, test, type Page } from "@playwright/test";

/**
 * A cobrança no Console (fatia 2, 01/10/2026). `/api/console/cobranca` é
 * fingido; quem pode ajustar planos e preços está provado no banco.
 */
const PAINEL = {
  planos: [
    { codigo: "piloto", nome: "Piloto", maximo_de_marcas: 5, teto_mensal_do_vini_micros: 60_000_000, armazenamento_bytes: null, a_venda: false, ordem: 0, assinaturas: 1 },
    { codigo: "basico", nome: "Básico", maximo_de_marcas: 5, teto_mensal_do_vini_micros: 30_000_000, armazenamento_bytes: null, a_venda: true, ordem: 1, assinaturas: 0 },
  ],
  precos: [
    { id: "11111111-1111-4111-8111-111111111111", plano: "basico", provedor: "stripe", id_externo: "price_basico_brl", moeda: "BRL", intervalo: "mes", ativo: true, criado_em: "2026-10-01T12:00:00Z" },
    { id: "22222222-2222-4222-8222-222222222222", plano: "basico", provedor: "stripe", id_externo: "price_basico_velho", moeda: "BRL", intervalo: "mes", ativo: false, criado_em: "2026-09-01T12:00:00Z" },
  ],
  assinaturas: [
    { conta: "Agência Piloto", workspace_id: "33333333-3333-4333-8333-333333333333", plano: "piloto", situacao: "em_atraso", em_atraso_desde: "2026-10-01T12:00:00Z",
      periodo_pago_ate: "2026-10-30T12:00:00Z", cancelar_no_fim: false, moeda: "BRL", titular_email: "dona@piloto.com", desde: "2026-09-30T12:00:00Z" },
  ],
};

type Pedido = Record<string, unknown>;
async function fingir(page: Page, pedidos: Pedido[], respostaDoPost: { status: number; json: unknown } = { status: 200, json: { ok: true } }) {
  await page.route("**/api/console/cobranca", async (rota) => {
    if (rota.request().method() === "POST") {
      pedidos.push(rota.request().postDataJSON());
      return rota.fulfill(respostaDoPost);
    }
    return rota.fulfill({ json: PAINEL });
  });
}

test("o painel mostra quem assina, em que situação, e os preços ligados", async ({ page }) => {
  await fingir(page, []);
  await page.goto("/dev/console-cobranca");
  const linha = page.locator('[data-assinatura="33333333-3333-4333-8333-333333333333"]');
  await expect(linha).toContainText("Agência Piloto");
  await expect(linha.locator('[data-situacao="em_atraso"]')).toHaveText("Em atraso desde 01/10/2026");
  await expect(page.locator('[data-preco="price_basico_brl"]')).toBeVisible();
  await expect(page.locator('[data-preco="price_basico_velho"]')).toHaveCount(0);
  await expect(page.locator("[data-precos] details")).toContainText("1 preço inativo");
  await expect(page.locator('[data-editor-de-plano="piloto"]')).toContainText("1 conta assina este plano");
});

test("ajustar um plano manda os valores e o motivo", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/console-cobranca");
  const editor = page.locator('[data-editor-de-plano="basico"]');
  await editor.getByLabel("Máximo de marcas").fill("8");
  await editor.getByLabel("Teto do Vini (US$/mês)").fill("45");
  await editor.getByLabel("Motivo").fill("ajuste do piloto");
  await editor.getByRole("button", { name: "Guardar plano" }).click();
  await expect(editor.getByRole("status")).toContainText("Feito");
  expect(pedidos[0]).toMatchObject({ tipo: "definir_plano", codigo: "basico", maximoDeMarcas: "8", tetoMensalDoViniDolares: "45", aVenda: true, motivo: "ajuste do piloto" });
});

test("ligar um preço do Stripe; a recusa vem com a frase do servidor", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos, { status: 400, json: { message: "Esse preço do Stripe já está registrado." } });
  await page.goto("/dev/console-cobranca");
  const form = page.locator("[data-registrar-preco]");
  await form.getByLabel("Preço no Stripe").fill("price_1Novo");
  await form.getByLabel("Motivo").fill("preço novo");
  await form.getByRole("button", { name: "Ligar preço" }).click();
  await expect(form.getByRole("status")).toHaveText("Esse preço do Stripe já está registrado.");
  expect(pedidos[0]).toMatchObject({ tipo: "registrar_preco", plano: "piloto", idExterno: "price_1Novo", moeda: "BRL" });
});

test("o link de piloto aparece pronto para copiar, com o prazo dito", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos, { status: 200, json: { url: "https://checkout.stripe.com/c/pay/cs_test_piloto" } });
  await page.goto("/dev/console-cobranca");
  const form = page.locator("[data-link-de-piloto]");
  await form.getByLabel("Empresa (nome da conta)").fill("Agência Piloto");
  await form.getByLabel("Nome de quem assina").fill("Dona");
  await form.getByLabel("E-mail de quem assina").fill("dona@piloto.com");
  await form.getByRole("button", { name: "Gerar link" }).click();
  await expect(form.locator("[data-link-gerado]")).toContainText("Vale por 24 horas");
  await expect(form.getByLabel("Link de pagamento")).toHaveValue("https://checkout.stripe.com/c/pay/cs_test_piloto");
  expect(pedidos[0]).toMatchObject({ tipo: "link_de_piloto", plano: "piloto", moeda: "BRL", empresa: "Agência Piloto" });
});

test("o link de primeiro acesso do titular: com motivo, pronto para copiar; a recusa vem com frase", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, pedidos, { status: 200, json: { url: "http://127.0.0.1:54321/auth/v1/verify?token=x&type=magiclink", titular: "dona@piloto.com", validaAte: "2026-10-04T12:00:00Z" } });
  await page.goto("/dev/console-cobranca");
  const linha = page.locator('[data-assinatura="33333333-3333-4333-8333-333333333333"]');
  await linha.getByRole("button", { name: "Link de acesso" }).click();
  await linha.getByLabel("Motivo do link de acesso").fill("piloto pagou");
  await linha.getByRole("button", { name: "Gerar" }).click();
  await expect(linha.getByLabel("Link de primeiro acesso")).toHaveValue(/verify\?token=x/);
  await expect(linha.locator("[data-link-de-acesso]")).toContainText("vale cerca de 1 hora");
  expect(pedidos[0]).toEqual({ tipo: "link_de_acesso", workspaceId: "33333333-3333-4333-8333-333333333333", motivo: "piloto pagou" });
});

test("titular que já entrou não recebe link — a frase do servidor aparece", async ({ page }) => {
  await fingir(page, [], { status: 400, json: { message: "O titular já entrou na conta (ou o login não nasceu da compra): link de primeiro acesso não serve mais." } });
  await page.goto("/dev/console-cobranca");
  const linha = page.locator('[data-assinatura="33333333-3333-4333-8333-333333333333"]');
  await linha.getByRole("button", { name: "Link de acesso" }).click();
  await linha.getByLabel("Motivo do link de acesso").fill("perdeu a senha");
  await linha.getByRole("button", { name: "Gerar" }).click();
  await expect(linha.getByRole("alert")).toContainText("já entrou na conta");
  await expect(linha.getByLabel("Link de primeiro acesso")).toHaveCount(0);
});
