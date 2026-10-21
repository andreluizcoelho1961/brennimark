import { expect, test, type Page } from "@playwright/test";

/**
 * A ferramenta em janela solta (21/10/2026): o botão "Abrir em janela" das
 * páginas do Kit, do Cores e do Grids abre a ferramenta numa janela própria, sem
 * o menu do site, com uma barra fina.
 */
async function abrirPagina(page: Page, ferramenta: string) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/ferramentas/${ferramenta}`, { waitUntil: "commit" });
  await expect(page.locator("[data-abrir-em-janela]")).toBeVisible();
}

/** O clique antes de a página ligar (hidratar) se perde: repete até a janela abrir. */
async function abrirJanela(page: Page) {
  let janela: Page | null = null;
  await expect(async () => {
    const aberta = page.waitForEvent("popup", { timeout: 1_500 });
    await page.locator("[data-abrir-em-janela]").click();
    janela = await aberta;
  }).toPass({ timeout: 30_000 });
  return janela as unknown as Page;
}

for (const ferramenta of ["kit", "cores", "grids"]) {
  test(`o ${ferramenta} abre em janela, sem o menu do site e com a barra fina`, async ({ page }) => {
    await abrirPagina(page, ferramenta);
    const janela = await abrirJanela(page);
    await janela.waitForLoadState("domcontentloaded");
    expect(janela.url()).toContain(`/ferramentas/janela/${ferramenta}`);
    await expect(janela.locator("[data-barra-da-janela]")).toBeVisible();
    await expect(janela.locator("[data-barra-da-janela]")).toContainText(ferramenta === "kit" ? "Kit" : ferramenta === "cores" ? "Cores" : "Grids");
    await expect(janela.locator(".site-head")).toHaveCount(0);
    await expect(janela.locator("[data-topo-do-site]")).toHaveCount(0);
    // A ferramenta de verdade, não uma casca.
    await expect(janela.locator(`[data-${ferramenta === "grids" ? "grids" : ferramenta === "kit" ? "kit" : "cores"}]`).first()).toBeAttached();
  });
}

test("abrir de novo traz a MESMA janela e não recarrega o que estava nela", async ({ page, context }) => {
  await abrirPagina(page, "grids");
  const janela = await abrirJanela(page);
  await janela.waitForLoadState("domcontentloaded");
  await expect(janela.locator("[data-grids-vivo]")).toHaveCount(1, { timeout: 30_000 });
  await janela.evaluate(() => { (window as unknown as { __marca: number }).__marca = 42; });
  const antes = context.pages().length;

  await page.locator("[data-abrir-em-janela]").click();
  await page.waitForTimeout(1_000);
  expect(context.pages().length, "não abriu uma segunda janela").toBe(antes);
  expect(await janela.evaluate(() => (window as unknown as { __marca?: number }).__marca), "a janela não recarregou: o trabalho dela fica").toBe(42);
});

test("'Voltar à aba do site' fecha a janela", async ({ page }) => {
  await abrirPagina(page, "cores");
  const janela = await abrirJanela(page);
  await janela.waitForLoadState("domcontentloaded");
  const fechou = janela.waitForEvent("close");
  await expect(async () => {
    await janela.locator("[data-janela-voltar]").click({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await fechou;
  expect(janela.isClosed()).toBe(true);
});

test("sem a aba de origem, 'Voltar' leva a janela à página normal da ferramenta", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/ferramentas/janela/kit", { waitUntil: "commit" });
  await expect(async () => {
    await page.locator("[data-janela-voltar]").click({ timeout: 1_000 });
    await expect(page).toHaveURL(/\/ferramentas\/kit$/, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator("[data-topo-do-site] .site-head")).toBeVisible();
});

test("o que sobrou no armazenamento, torto, não impede a janela de abrir", async ({ page }) => {
  await abrirPagina(page, "grids");
  await page.evaluate(() => localStorage.setItem("bm-janela:grids", '{"largura":"muito","altura":null}'));
  const janela = await abrirJanela(page);
  await janela.waitForLoadState("domcontentloaded");
  await expect(janela.locator("[data-barra-da-janela]")).toBeVisible();
});

test("no celular não há o botão: uma janela solta não existe lá", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/ferramentas/grids", { waitUntil: "commit" });
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.locator("[data-abrir-em-janela]")).toHaveCount(0);
});

test("só as três ferramentas existem em janela: outro nome é 404", async ({ request }) => {
  for (const ferramenta of ["fonts", "vini", "qualquer-coisa"]) {
    const r = await request.get(`/ferramentas/janela/${ferramenta}`);
    expect(r.status(), ferramenta).toBe(404);
  }
  expect((await request.get("/ferramentas/janela/grids")).status()).toBe(200);
});

test("a janela não é indexada", async ({ page }) => {
  await page.goto("/ferramentas/janela/grids", { waitUntil: "commit" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
