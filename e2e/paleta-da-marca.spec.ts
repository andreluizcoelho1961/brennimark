import { expect, test, type Page } from "@playwright/test";

/**
 * A ficha da paleta da marca, na administração (27/09/2026).
 *
 * As APIs são interceptadas, como em `configuracoes-da-marca.spec.ts`: quem
 * pode editar e aprovar está provado em SQL (`prova-paleta-da-marca.sh`). O
 * que se prova aqui é o caminho pela interface — que a tela mostra a cada
 * papel só o que ele pode (ADR-0002), que salvar devolve a cor a rascunho, e
 * que a recusa do servidor aparece.
 */

function secaoDaPaleta(page: Page) {
  return page.getByRole("region", { name: "Paleta da marca" });
}

test("a ficha mostra as cores, a contagem e o status de cada uma", async ({ page }) => {
  await page.goto("/dev/admin-panel");
  const secao = secaoDaPaleta(page);

  await expect(secao.locator("[data-resumo-da-paleta]")).toHaveText(
    "4 cores · 2 principais, 2 de apoio · 2 aprovadas, 2 em rascunho",
  );
  const linhas = secao.locator("[data-cor-da-paleta]");
  await expect(linhas).toHaveCount(4);
  // Principais primeiro.
  await expect(linhas.nth(0)).toContainText("Vermelho Bancada");
  await expect(linhas.nth(0)).toContainText("HEX #C8102E · RGB 200 16 46 · CMYK 0 100 80 5 · PMS 186 C");
  await expect(linhas.nth(0).locator("[data-status-da-cor]")).toHaveText("Aprovada");
  await expect(linhas.nth(2).locator("[data-status-da-cor]")).toHaveText("Rascunho");
  // A página de origem leva ao manual (na bancada não há conta no endereço).
  await expect(linhas.nth(0)).toContainText("p. 12");
});

test("quem edita e não aprova não vê Aprovar", async ({ page }) => {
  await page.goto("/dev/admin-panel?papel=editora");
  const secao = secaoDaPaleta(page);
  await expect(secao.locator("[data-adicionar-cor]")).toBeVisible();
  await expect(secao.locator("[data-editar-cor]").first()).toBeVisible();
  await expect(secao.locator("[data-aprovar-cor]")).toHaveCount(0);
  await expect(secao.locator("[data-aprovar-todas]")).toHaveCount(0);
});

test("quem aprova e não edita só aprova", async ({ page }) => {
  let corpo: unknown = null;
  await page.route("**/api/admin/paleta/aprovar**", async (rota) => {
    corpo = rota.request().postDataJSON();
    await rota.fulfill({
      status: 200,
      json: {
        aprovadas: [{
          id: "c0000000-0000-4000-8000-000000000003", nome: "Azul Noite", papel: "apoio", segmento: "Varejo",
          hex: "#0B1F3A", rgb: null, cmyk: "100 80 30 60", pms: null, pagina: 13, ordem: 2,
          status: "ready", aprovadoEm: "2026-09-27T13:00:00.000Z",
        }],
      },
    });
  });

  await page.goto("/dev/admin-panel?papel=aprovadora");
  const secao = secaoDaPaleta(page);
  await expect(secao.locator("[data-adicionar-cor]")).toHaveCount(0);
  await expect(secao.locator("[data-editar-cor]")).toHaveCount(0);
  await expect(secao.locator("[data-remover-cor]")).toHaveCount(0);
  await expect(secao.locator("[data-aprovar-cor]")).toHaveCount(2);

  const azul = secao.locator('[data-cor-da-paleta="c0000000-0000-4000-8000-000000000003"]');
  await azul.locator("[data-aprovar-cor]").click();

  expect(corpo).toEqual({ ids: ["c0000000-0000-4000-8000-000000000003"] });
  await expect(azul.locator("[data-status-da-cor]")).toHaveText("Aprovada");
  await expect(secao.getByRole("status")).toHaveText("1 cor aprovada.");
  await expect(secao.locator("[data-resumo-da-paleta]")).toContainText("3 aprovadas, 1 em rascunho");
});

test("adicionar uma cor manda os campos e ela entra como rascunho", async ({ page }) => {
  let corpo: Record<string, unknown> | null = null;
  await page.route("**/api/admin/paleta**", async (rota) => {
    if (rota.request().method() !== "POST") return rota.fallback();
    corpo = rota.request().postDataJSON();
    await rota.fulfill({
      status: 201,
      json: {
        cor: {
          id: "c0000000-0000-4000-8000-000000000009", nome: "Verde Mata", papel: "apoio", segmento: "",
          hex: "#1B5E20", rgb: null, cmyk: null, pms: "356 C", pagina: 14, ordem: 4, status: "draft", aprovadoEm: null,
        },
      },
    });
  });

  await page.goto("/dev/admin-panel");
  const secao = secaoDaPaleta(page);
  await secao.locator("[data-adicionar-cor]").click();
  const formulario = secao.locator("[data-formulario-da-cor]");
  await formulario.getByLabel("Nome").fill("Verde Mata");
  await formulario.getByLabel("HEX").fill("1b5e20");
  await formulario.getByLabel("PMS").fill("356 C");
  await formulario.getByLabel("Página do manual").fill("14");
  await formulario.locator("[data-salvar-cor]").click();

  await expect(secao.getByRole("status")).toHaveText("Cor guardada como rascunho.");
  expect(corpo).toMatchObject({ nome: "Verde Mata", papel: "apoio", hex: "1b5e20", pms: "356 C", pagina: "14", ordem: "4" });
  const nova = secao.locator('[data-cor-da-paleta="c0000000-0000-4000-8000-000000000009"]');
  await expect(nova.locator("[data-status-da-cor]")).toHaveText("Rascunho");
  await expect(formulario).toHaveCount(0);
});

test("a recusa do servidor aparece e o formulário continua aberto", async ({ page }) => {
  await page.route("**/api/admin/paleta**", async (rota) => {
    if (rota.request().method() !== "PATCH") return rota.fallback();
    await rota.fulfill({ status: 400, json: { message: "O HEX tem seis dígitos, como #CC092F." } });
  });

  await page.goto("/dev/admin-panel");
  const secao = secaoDaPaleta(page);
  await secao.locator("[data-editar-cor]").first().click();
  const formulario = secao.locator("[data-formulario-da-cor]");
  await expect(formulario.getByLabel("Nome")).toHaveValue("Vermelho Bancada");
  await formulario.getByLabel("HEX").fill("vermelho");
  await formulario.locator("[data-salvar-cor]").click();

  await expect(secao.getByRole("status")).toHaveText("O HEX tem seis dígitos, como #CC092F.");
  await expect(formulario).toBeVisible();
});
