import { expect, test, type Page } from "@playwright/test";

/**
 * O download passa pelo servidor, que registra antes de o arquivo sair.
 *
 * Até 14/09/2026 a listagem entregava um link assinado de 1 hora para cada
 * asset, e o clique ia direto ao Storage: o servidor não sabia quem baixou, e
 * quem abria a página levava o acervo inteiro em links repassáveis. Ver
 * ADR-0007 §2.4, item 18.
 *
 * Rede fingida, como no resto da suíte: estes testes provam o que a TELA faz. O
 * que o BANCO garante — ninguém registra em nome de outro, ninguém apaga — está
 * em `scripts/prova-registro-de-download.sh`.
 */
const ASSET = {
  id: "asset-fonte", label: "Fonte da marca", description: "", category: "Fontes",
  file_name: "marca-regular.otf", mime_type: "font/otf", size_bytes: 40960,
  status: "ready", created_at: "2026-09-14T10:00:00Z", baixavel: true,
  descontinuadoEm: null, substituidoPor: null,
};

async function comAcervo(page: Page, assets: unknown[]) {
  await page.route("**/api/assets?**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ assets }) }),
  );
  await page.route("**/api/assets", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ assets }) }),
  );
}

test("o botão Baixar aponta para a rota que registra, e não para o Storage", async ({ page }) => {
  await comAcervo(page, [ASSET]);
  await page.goto("/dev/biblioteca");

  const baixar = page.getByRole("link", { name: "Baixar" });
  await expect(baixar).toBeVisible();
  const href = await baixar.getAttribute("href");
  expect(href, "o link precisa passar pela rota de download").toContain("/api/assets/asset-fonte/download");
  expect(href, "link assinado do Storage na tela é o link repassável que saiu").not.toMatch(/token=|\/storage\/v1\//);
});

test("abrir a biblioteca não registra download nenhum", async ({ page }) => {
  /*
   * A armadilha que este teste tranca: a prévia de imagem usava o endereço de
   * download como `src`. Apontada para a rota nova, cada abertura da página
   * registraria um download por imagem — o registro encheria de downloads que
   * ninguém fez, e deixaria de responder quem iniciou o download de quê.
   */
  const imagem = { ...ASSET, id: "asset-imagem", label: "Foto", file_name: "foto.png", mime_type: "image/png" };
  await comAcervo(page, [ASSET, imagem]);
  const downloads: string[] = [];
  page.on("request", (pedido) => {
    if (pedido.url().includes("/download")) downloads.push(pedido.url());
  });

  await page.goto("/dev/biblioteca");
  await expect(page.getByRole("link", { name: "Baixar" })).toHaveCount(2);
  // Tempo para qualquer prévia ou pré-carregamento acontecer.
  await page.waitForTimeout(500);

  expect(downloads, "a página pediu a rota de download sem ninguém clicar").toEqual([]);
});

test("asset com caminho fora da marca não oferece botão", async ({ page }) => {
  await comAcervo(page, [{ ...ASSET, baixavel: false }]);
  await page.goto("/dev/biblioteca");
  await expect(page.getByRole("heading", { name: "Fonte da marca" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar" })).toHaveCount(0);
});

test("quem gerencia vê os downloads iniciados — inclusive de arquivo apagado depois", async ({ page }) => {
  await comAcervo(page, [ASSET]);
  await page.route("**/api/assets/downloads**", (rota) =>
    rota.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        limite: 100,
        downloads: [
          { id: "d1", assetId: "asset-fonte", pessoa: "fornecedor@agencia.test", rotulo: "Fonte da marca", arquivo: "marca-regular.otf", quando: "2026-09-14T10:05:00Z" },
          { id: "d2", assetId: null, pessoa: "grafica@job.test", rotulo: "Logo antigo", arquivo: "logo-2019.eps", quando: "2026-09-13T09:00:00Z" },
        ],
      }),
    }),
  );

  await page.goto("/dev/biblioteca");
  await page.getByRole("button", { name: "Ver o registro" }).click();

  const tabela = page.locator("[data-registro-de-downloads]");
  await expect(tabela).toBeVisible();
  await expect(tabela).toContainText("fornecedor@agencia.test");
  await expect(tabela).toContainText("marca-regular.otf");
  // O arquivo sumiu; quem o recebeu, não.
  const apagado = tabela.locator("tr").filter({ hasText: "logo-2019.eps" });
  await expect(apagado).toContainText("grafica@job.test");
  await expect(apagado).toContainText("(arquivo apagado depois)");
});

test("quem só consulta não vê o registro", async ({ page }) => {
  await comAcervo(page, [ASSET]);
  await page.goto("/dev/biblioteca?gerencia=0");
  await expect(page.getByRole("link", { name: "Baixar" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Downloads iniciados" })).toHaveCount(0);
});
