import { expect, test } from "@playwright/test";

/**
 * As ferramentas gratuitas no site (17/10/2026): a entrada no menu do topo e o
 * convite à assinatura no fim de cada ferramenta.
 */
test("o menu do topo leva ao capítulo das ferramentas", async ({ page }) => {
  await page.goto("/", { waitUntil: "commit" });
  const link = page.locator(".site-nav").getByRole("link", { name: "Ferramentas" });
  await expect(link).toHaveAttribute("href", "/#ferramentas");
  await expect(page.locator("#ferramentas")).toBeAttached();
});

for (const ferramenta of ["kit", "cores", "grids"]) {
  test(`o ${ferramenta} termina com o convite à assinatura`, async ({ page }) => {
    await page.goto(`/ferramentas/${ferramenta}`, { waitUntil: "commit" });
    const convite = page.locator("[data-convite-assinatura]");
    await expect(convite).toBeAttached();
    await expect(convite.getByRole("link", { name: "Ver os planos" })).toHaveAttribute("href", "/assinar");
  });
}

test("o capítulo tem quatro cartões do mesmo tamanho, e o primeiro é o Fonts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/", { waitUntil: "commit" });
  const cartoes = page.locator("#ferramentas .ferr");
  await expect(cartoes).toHaveCount(4);
  await expect(cartoes.first().getByRole("heading", { level: 3 })).toHaveText("Fonts");
  await expect(cartoes.first()).toHaveClass(/ferr--destaque/);
  await expect(cartoes.first().getByRole("link", { name: /Pedir convite/ })).toHaveAttribute("href", "/fonts");
  const alturas = await cartoes.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  expect(new Set(alturas).size, "os quatro cartões têm a mesma altura").toBe(1);
});

test("no /fonts, o botão de pedir acesso aparece na primeira tela", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/fonts", { waitUntil: "commit" });
  const botao = page.locator("[data-fonts-pedir]");
  await expect(botao).toBeVisible();
  const caixa = await botao.boundingBox();
  expect(caixa!.y + caixa!.height, "o botão inteiro cabe em 720 px de altura").toBeLessThanOrEqual(720);
});

/*
 * O cabeçalho do site no topo das ferramentas (21/10/2026): quem abre o Kit, o
 * Cores ou o Grids por um link direto não perde o menu do site.
 */
for (const ferramenta of ["kit", "cores", "grids"]) {
  test(`o ${ferramenta} leva o cabeçalho do site: menu à vista e fixo ao rolar`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/ferramentas/${ferramenta}`, { waitUntil: "commit" });
    const topo = page.locator("[data-topo-do-site] .site-head");
    await expect(topo).toBeVisible();
    for (const rotulo of ["Plataforma", "Para quem", "Ferramentas", "Planos", "Recursos"]) {
      await expect(topo.getByText(rotulo, { exact: false }).first()).toBeVisible();
    }
    await expect(topo.getByRole("link", { name: "Planos" })).toHaveAttribute("href", "/#planos");
    await expect(topo.getByRole("button", { name: /Agendar demonstração/ })).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 700));
    const caixa = await topo.boundingBox();
    expect(caixa!.y, "o cabeçalho fica no topo mesmo depois de rolar").toBe(0);
    expect(Math.round(caixa!.height), "72 px, a altura do cabeçalho do site").toBe(72);
  });
}

test("o menu do site abre por cima da ferramenta e o botão de demonstração abre o diálogo", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/ferramentas/grids", { waitUntil: "commit" });
  const topo = page.locator("[data-topo-do-site] .site-head");
  // O clique antes de a página ligar (hidratar) se perde: repete até abrir.
  const menu = topo.locator(".nav-btn").first();
  await expect(async () => {
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  const aberto = page.locator(`#${await menu.getAttribute("aria-controls")}`);
  await expect(aberto.getByRole("link", { name: /Materiais da marca/ })).toBeVisible();

  await page.keyboard.press("Escape");
  await topo.getByRole("button", { name: /Agendar demonstração/ }).click();
  await expect(page.locator("#dlg-demo")).toBeVisible();
});

test("o Planos do topo leva à home no capítulo dos planos", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/ferramentas/kit", { waitUntil: "commit" });
  const planos = page.locator("[data-topo-do-site] .site-head").getByRole("link", { name: "Planos" });
  await expect(async () => {
    await planos.click();
    await expect(page).toHaveURL(/\/#planos$/, { timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
});

test("no celular, o cabeçalho continua fixo e o menu abre com as ferramentas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/ferramentas/kit", { waitUntil: "commit" });
  const topo = page.locator("[data-topo-do-site] .site-head");
  await expect(topo).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 700));
  expect((await topo.boundingBox())!.y).toBe(0);
  const alternador = topo.locator(".menu-toggle");
  await expect(async () => {
    await alternador.click();
    await expect(page.locator("#mnav")).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator("#mnav").getByRole("link", { name: /Ferramentas gratuitas/ })).toBeVisible();
  const transborda = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(transborda, "a página não rola para o lado").toBe(false);
});

test("o conteúdo da ferramenta não fica escondido atrás do cabeçalho", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/ferramentas/cores", { waitUntil: "commit" });
  const titulo = page.getByRole("heading", { level: 1 });
  await expect(titulo).toBeVisible();
  expect((await titulo.boundingBox())!.y, "o título começa abaixo dos 72 px do cabeçalho").toBeGreaterThanOrEqual(72);
});
