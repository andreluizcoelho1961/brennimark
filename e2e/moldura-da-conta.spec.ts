import { expect, test } from "@playwright/test";

/**
 * A moldura existe desde o primeiro segundo — plano da interface §2 (18/09).
 *
 * "Entrar é cair dentro da plataforma, como abrir o Illustrator": menus e
 * ferramentas estão lá, e o trabalho acontece no centro. Estes casos provam a
 * moldura SEM marca aberta, que é o estado que não existia: até 18/09 a tela
 * inicial e o convite para a primeira marca eram páginas soltas, sem menu.
 */
const desktop = { width: 1440, height: 900 };

test("sem marca aberta, a moldura inteira está lá: coluna, barra e centro", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura");

  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Conteúdo da marca" })).toBeVisible();
  await expect(page.locator("[data-card-de-marca]")).toHaveCount(2);
});

test("a barra de cima aparece APAGADA sem marca, como no Illustrator", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura");

  const barra = page.getByRole("navigation", { name: "Conteúdo da marca" });
  await expect(barra).toHaveAttribute("data-marca-aberta", "nao");
  // Apagado não é link morto: nenhum destino, e o estado é anunciado.
  await expect(barra.getByRole("link")).toHaveCount(0);
  for (const parte of ["manual", "materiais", "complementos"]) {
    await expect(barra.locator(`[data-parte-apagada="${parte}"]`)).toHaveAttribute("aria-disabled", "true");
  }
});

test("passar o mouse na coluna NÃO muda a largura do conteúdo", async ({ page }) => {
  /*
   * A regra técnica que decide se a coluna fica boa ou irritante (spec-menus
   * §9.1): a expansão SOBREPÕE. Se empurrasse, o visualizador de PDF — que
   * ajusta a escala à largura disponível — redesenharia o manual a cada
   * passada do mouse.
   */
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura");
  const conteudo = page.locator("[data-shell-main]");
  const antes = (await conteudo.boundingBox())!;

  const coluna = page.locator("[data-coluna-da-plataforma]");
  await coluna.hover();
  await expect(coluna).toHaveAttribute("data-expandida", "sim");
  // Expandida, os nomes aparecem.
  await expect(coluna.getByText("Pessoas e acesso")).toBeVisible();

  const depois = (await conteudo.boundingBox())!;
  expect(depois.x, "o conteúdo andou para o lado").toBe(antes.x);
  expect(depois.width, "o conteúdo encolheu").toBe(antes.width);
});

test("o mouse que só atravessa não abre a coluna", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura");
  const coluna = page.locator("[data-coluna-da-plataforma]");
  await coluna.hover();
  // Sai antes do atraso de intenção (200ms).
  await page.mouse.move(900, 500);
  await page.waitForTimeout(350);
  await expect(coluna).toHaveAttribute("data-expandida", "nao");
});

test("a coluna abre pelo teclado", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura");
  const coluna = page.locator("[data-coluna-da-plataforma]");
  await coluna.locator('[data-item-da-coluna="marcas"]').focus();
  await expect(coluna).toHaveAttribute("data-expandida", "sim");
  await page.keyboard.press("Escape");
  await expect(coluna).toHaveAttribute("data-expandida", "nao");
});

test("quem administra vê a gestão; o que não existe está 'em breve' e não é link", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura");
  const coluna = page.locator("[data-coluna-da-plataforma]");

  await expect(coluna.locator('[data-item-da-coluna="pessoas"]')).toHaveAttribute("href", "/w/dev/pessoas");
  for (const id of ["links", "registros", "configuracoes"]) {
    const item = coluna.locator(`[data-item-em-breve="${id}"]`);
    await expect(item).toHaveAttribute("aria-disabled", "true");
    await expect(item).not.toHaveAttribute("href", /.*/);
  }
});

test("quem só consulta não vê a gestão nem o cartão de nova marca", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura?papel=consulta");
  await expect(page.locator('[data-grupo-da-coluna="gestao"]')).toHaveCount(0);
  await expect(page.locator("[data-card-nova-marca]")).toHaveCount(0);
});

test("quem administra encontra '+ Nova marca' junto dos cartões", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura");
  await expect(page.locator("[data-card-nova-marca]")).toHaveAttribute("href", "/w/dev/importar");
});

test("conta sem marca mostra o convite DENTRO da moldura, não numa página solta", async ({ page }) => {
  await page.setViewportSize(desktop);
  await page.goto("/dev/moldura?marcas=0");
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Enviar o primeiro manual" })).toBeVisible();
  // A frase que soava como bloqueio para quem tem a permissão (ensaio de 18/09).
  await expect(page.getByText("Só quem administra a conta pode importar")).toHaveCount(0);
});

test("no celular, a gaveta leva aos mesmos lugares, com nome", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/moldura");
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  const gaveta = page.getByRole("dialog");
  await expect(gaveta.getByRole("link", { name: "Marcas" })).toBeVisible();
  await expect(gaveta.getByRole("link", { name: "Pessoas e acesso" })).toBeVisible();
  await expect(gaveta.getByText("Links de entrega")).toBeVisible();
});
