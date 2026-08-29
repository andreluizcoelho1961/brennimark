import { expect, test, type Page } from "@playwright/test";

/**
 * O ciclo que faltava: excluir uma página, chegar ao histórico dela, e
 * recuperá-la inteira.
 *
 * Este caminho quebrou duas vezes, e nas duas o código parecia certo na
 * leitura — a rota respondia 404 para página excluída, e a lista de excluídas
 * só existia na navegação de desktop. Nenhum teste de unidade pegaria: o
 * defeito estava em qual elemento aparece em qual largura.
 *
 * As APIs são interceptadas. A integridade do banco — cascata, chave composta,
 * blocos no instantâneo — já está provada em SQL; o que falta provar é a
 * interface, e ela não precisa de banco para ser exercida.
 */

const PAGINA_RECUPERADA = {
  slug: "tipografia",
  group: "Sistema",
  title: "Tipografia",
  status: "ready",
  body: ["Uma família, quatro pesos."],
  blocks: [{ kind: "swatches", items: [{ name: "Vermelho", hex: "#E1251B" }] }],
};

async function interceptarApis(page: Page) {
  let excluida = false;

  await page.route("**/api/admin/content", async (rota) => {
    if (rota.request().method() === "DELETE") {
      excluida = true;
      await rota.fulfill({ status: 200, json: { ok: true } });
      return;
    }
    await rota.fulfill({ status: 200, json: { ok: true, updatedAt: new Date(0).toISOString() } });
  });

  await page.route("**/api/admin/content/history**", async (rota) => {
    if (rota.request().method() === "POST") {
      excluida = false;
      await rota.fulfill({
        status: 200,
        json: { ok: true, updatedAt: new Date(0).toISOString(), document: PAGINA_RECUPERADA },
      });
      return;
    }
    // O ponto do teste: o histórico responde mesmo com a página excluída.
    await rota.fulfill({
      status: 200,
      json: {
        pageDeleted: excluida,
        versions: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            action: "published",
            actionLabel: "Publicada",
            actorLabel: "Alguém",
            createdAt: "2026-08-29T12:00:00.000Z",
            title: "Tipografia",
            status: "ready",
            preview: "Uma família, quatro pesos.",
            changedFields: ["Texto"],
            isCurrent: false,
          },
        ],
      },
    });
  });
}

/** O seletor visível nesta largura — lista lateral no desktop, campo no resto. */
async function escolherPagina(page: Page, rotulo: string | RegExp, largura: number) {
  if (largura >= 1280) {
    await page.getByRole("button", { name: rotulo }).click();
    return;
  }
  const campo = page.getByLabel(/^(Página|Page)$/);
  const opcao = await campo
    .locator("option")
    .filter({ hasText: rotulo })
    .first()
    .getAttribute("value");
  await campo.selectOption(opcao!);
}

for (const largura of [375, 1440]) {
  test(`ciclo completo de exclusão e recuperação em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await interceptarApis(page);
    page.on("dialog", (dialogo) => dialogo.accept());

    await page.goto("/dev/admin-panel");
    await expect(page.getByRole("heading", { name: "Conteúdo e assets" })).toBeVisible();

    await escolherPagina(page, "Tipografia", largura);
    await page.getByRole("button", { name: "Excluir página" }).click();

    // A página some do guia e continua alcançável — este é o defeito que o
    // patch 2.1 corrigiu e que ninguém tinha exercido pela tela.
    // Nível 1: o título da tela. O histórico abaixo repete o título em h3.
    await expect(page.getByRole("heading", { name: "Tipografia", level: 1 })).toBeVisible();
    await expect(page.getByText("Página excluída").first()).toBeVisible();

    // E o histórico dela responde, em vez de 404.
    await expect(page.getByRole("heading", { name: "Histórico de versões" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recuperar versão" })).toBeVisible();

    await page.getByRole("button", { name: "Recuperar versão" }).click();

    // De volta ao editor: a página voltou para o guia.
    await expect(page.getByLabel(/^(Título|Title)$/)).toHaveValue("Tipografia");
    await expect(page.getByRole("button", { name: "Excluir página" })).toBeVisible();
  });

  test(`página excluída continua alcançável depois de recarregar em ${largura}px`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 900 });
    await interceptarApis(page);

    // O servidor devolve uma página viva e outra já excluída: é o estado de
    // quem fecha a aba depois de excluir e volta no dia seguinte.
    await page.goto("/dev/admin-panel?estado=com-excluida");
    await expect(page.getByLabel(/^(Título|Title)$/)).toHaveValue("Cores");

    // A regressão que isto impede: a excluída aparecer só na navegação de
    // desktop, que está escondida abaixo de 1280px.
    await escolherPagina(page, /Tipografia/, largura);
    await expect(page.getByText("Página excluída").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Recuperar versão" })).toBeVisible();
  });
}
