import { expect, test, type Page } from "@playwright/test";

/**
 * O pedido de exportação na aba Plano (08/10/2026). As APIs são fingidas; o
 * papel (só o dono pede), o pedido aberto único e o isolamento entre contas
 * estão provados no banco (`scripts/prova-exportacao.sh`).
 */
const PLANO = {
  assinada: true, plano: "Básico", acesso: "so_leitura", marcas: { usadas: 1, maximo: 5 },
  pagoAte: "2026-11-01T12:00:00Z", cancelaNoFim: false, soLeituraAPartirDe: null, titular: "dona@agencia.com",
};

async function fingir(page: Page, pedido: unknown) {
  await page.route("**/api/configuracoes/consumo**", (r) => r.fulfill({ status: 500, json: { message: "fora do teste" } }));
  await page.route("**/api/configuracoes/plano**", (r) => r.fulfill({ json: PLANO }));
  let pedidos = 0;
  await page.route("**/api/configuracoes/exportacao**", (r) => {
    if (r.request().method() === "POST") {
      pedidos += 1;
      return r.fulfill({ json: { pedido: { pedidoEm: "2026-10-08T15:00:00Z", prazo: "2026-10-23T15:00:00Z", entregueEm: null } } });
    }
    return r.fulfill({ json: { pedido } });
  });
  return () => pedidos;
}

test("na conta só para leitura, o dono pede a exportação e vê o prazo de 15 dias", async ({ page }) => {
  const pedidos = await fingir(page, null);
  await page.goto("/dev/configuracoes?parte=plano");
  const secao = page.locator("[data-exportacao]");
  await expect(secao).toContainText("arquivos originais e um índice do conteúdo");
  await secao.locator("[data-pedir-exportacao]").click();
  await expect(secao.locator("[data-exportacao-pedida]")).toHaveText("Pedido em 8 de outubro de 2026. Entregamos até 23 de outubro de 2026.");
  await expect(secao.locator("[data-pedir-exportacao]")).toHaveCount(0);
  expect(pedidos()).toBe(1);
});

test("com pedido aberto, a aba mostra o pedido e não oferece outro", async ({ page }) => {
  await fingir(page, { pedidoEm: "2026-10-01T12:00:00Z", prazo: "2026-10-16T12:00:00Z", entregueEm: null });
  await page.goto("/dev/configuracoes?parte=plano");
  await expect(page.locator("[data-exportacao-pedida]")).toContainText("Entregamos até 16 de outubro de 2026");
  await expect(page.locator("[data-pedir-exportacao]")).toHaveCount(0);
});

test("depois de entregue, diz quando foi e deixa pedir de novo", async ({ page }) => {
  await fingir(page, { pedidoEm: "2026-09-01T12:00:00Z", prazo: "2026-09-16T12:00:00Z", entregueEm: "2026-09-10T12:00:00Z" });
  await page.goto("/dev/configuracoes?parte=plano");
  await expect(page.locator("[data-exportacao-entregue]")).toContainText("entregue em 10 de setembro de 2026");
  await expect(page.locator("[data-pedir-exportacao]")).toBeEnabled();
});
