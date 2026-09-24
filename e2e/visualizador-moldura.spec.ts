import { expect, test, type Page } from "@playwright/test";

/**
 * O manual completo — fatia 3 do plano da interface (23/09/2026).
 *
 * O que só o navegador prova: as ações do PDF na barra de CIMA (por portal, no
 * encaixe da moldura), o fólio no pé, a aba de capítulo na borda, a busca que
 * leva à página, e a página sem a faixa branca que aparecia na Sony Vaio.
 *
 * `?moldura=1` monta na bancada o MESMO encaixe da `PlatformTopBar`. Sem ele o
 * visualizador desenha as ações numa faixa própria — que é o que a tela
 * estreita usa, e o que os casos de celular abaixo medem.
 */

const COM_INDICE = "/dev/visualizador?fixture=indice-com-generico.pdf";
const SEM_MARCADORES = "/dev/visualizador?fixture=manual-de-teste.pdf";

async function abrir(page: Page, url: string, largura = 1400) {
  await page.setViewportSize({ width: largura, height: 900 });
  await page.goto(url);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
}

const barraDeCima = (page: Page) => page.locator("#acoes-da-tela");

test("na moldura, as ações do PDF ficam na barra de cima — e só lá", async ({ page }) => {
  await abrir(page, `${COM_INDICE}&moldura=1`);
  await expect(barraDeCima(page).locator("[data-acoes-do-manual]")).toBeVisible();
  // Uma instância só: dois índices para o mesmo estado seriam dois menus.
  await expect(page.locator("[data-acoes-do-manual]")).toHaveCount(1);
  await expect(barraDeCima(page).getByRole("button", { name: /^(Índice|Contents)$/ })).toBeVisible();
});

test("o índice desce da barra, leva ao capítulo, fecha ao escolher e com Esc", async ({ page }) => {
  await abrir(page, `${COM_INDICE}&moldura=1`);
  const botao = barraDeCima(page).getByRole("button", { name: /^(Índice|Contents)$/ });

  await botao.click();
  await expect(botao).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-indice-item]")).toHaveCount(0);
  await expect(botao).toBeFocused();

  await botao.click();
  await page.locator("[data-indice-item]", { hasText: "Grid" }).click();
  await expect(page.locator("[data-indice-item]")).toHaveCount(0);
  await expect.poll(async () => page.locator("#pagina-atual").inputValue(), { timeout: 10_000 }).toBe("4");
});

test("a aba de capítulo mostra onde a leitura está, e abre o índice", async ({ page }) => {
  await abrir(page, `${COM_INDICE}&moldura=1`);
  const aba = page.locator("[data-aba-de-capitulo]");
  await expect(aba).toContainText("Cores");

  await page.locator("#pagina-atual").fill("4");
  await page.locator("#pagina-atual").press("Enter");
  await expect(aba).toContainText("Grid");

  await aba.click();
  await expect(page.getByRole("navigation", { name: /Índice do manual|Manual contents/ })).toBeVisible();
});

test("sem índice, não há aba — ela não inventa capítulo", async ({ page }) => {
  await abrir(page, `${SEM_MARCADORES}&moldura=1`);
  await expect(page.locator("[data-aba-de-capitulo]")).toHaveCount(0);
});

test("buscar leva à página que tem o termo; termo ausente diz que não achou", async ({ page }) => {
  await abrir(page, `${COM_INDICE}&moldura=1`);
  await page.locator("#pagina-atual").fill("4");
  await page.locator("#pagina-atual").press("Enter");
  await expect.poll(async () => page.locator("#pagina-atual").inputValue()).toBe("4");

  const campo = barraDeCima(page).getByPlaceholder(/^(Buscar|Search)$/);
  // Da página 4, dando a volta no manual, até a 1 — a única com "vermelho".
  await campo.fill("vermelho");
  await campo.press("Enter");
  await expect.poll(async () => page.locator("#pagina-atual").inputValue(), { timeout: 10_000 }).toBe("1");

  await campo.fill("palavra que nao existe");
  await campo.press("Enter");
  await expect(page.locator("[data-busca-aviso]")).toHaveText(/Não encontrado|Not found/, { timeout: 10_000 });
});

test("o fólio mostra página, zoom e arquivo — e o zoom troca 'ajustado' pela porcentagem", async ({ page }) => {
  await abrir(page, `${COM_INDICE}&moldura=1`);
  const folio = page.locator("[data-folio]");
  await expect(folio).toContainText(/de 4|of 4/);
  await expect(folio).toContainText(/ajustado|fit/);
  await expect(page.locator("[data-folio-arquivo]")).toHaveText("indice-com-generico.pdf");

  await barraDeCima(page).getByRole("button", { name: /Aumentar zoom|Zoom in/ }).click();
  await expect(folio).toContainText(/\d+%/);
  await expect(folio).not.toContainText(/ajustado|fit/);
});

test("a página não tem faixa branca: a moldura tem a largura do desenho", async ({ page }) => {
  /*
   * Ensaio de 18/09, medido em 23/09: a seção esticava à largura da coluna com
   * o recuo, o canvas tinha a largura sem ele, e sobravam 24 px de branco à
   * direita de toda página — invisível em página clara, uma faixa na Sony
   * Vaio, de fundo azul-marinho.
   */
  await abrir(page, "/dev/visualizador?fixture=manual-visual.pdf&moldura=1");
  await expect.poll(async () => page.locator("section[data-pagina='1'] .textLayer").evaluate(
    (el) => (el as HTMLElement).style.getPropertyValue("--scale-factor"),
  ), { timeout: 15_000 }).not.toBe("");
  const sobra = await page.locator("section[data-pagina='1']").evaluate((secao) => {
    const canvas = secao.querySelector("canvas")!.getBoundingClientRect();
    const moldura = secao.getBoundingClientRect();
    return Math.abs(moldura.width - canvas.width);
  });
  expect(sobra).toBeLessThan(1);
});

test("na bancada, sem marca, o ••• não oferece baixar", async ({ page }) => {
  // O download precisa de marca para ser registrado; sem ela, não há botão.
  await abrir(page, `${COM_INDICE}&moldura=1`);
  await barraDeCima(page).getByRole("button", { name: /Mais ações do manual|More manual actions/ }).click();
  await expect(page.getByRole("button", { name: /Mostrar miniaturas|Show thumbnails/ }).first()).toBeVisible();
  await expect(page.locator("[data-baixar-manual]")).toHaveCount(0);
});

test("no celular, as ações descem para uma faixa e todas cabem na tela", async ({ page }) => {
  await abrir(page, `${COM_INDICE}&moldura=1`, 390);
  await expect(barraDeCima(page).locator("[data-acoes-do-manual]")).toHaveCount(0);
  const acoes = page.locator("[data-acoes-do-manual]");
  await expect(acoes).toBeVisible();
  const direitas = await acoes.locator("button").evaluateAll((botoes) =>
    botoes.map((b) => b.getBoundingClientRect().right));
  for (const direita of direitas) expect(direita).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
