import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

/**
 * O Brennimark Grids gratuito (13/10/2026): formato + tipo de grid, prévia ao
 * vivo, IDML e PDF de referência. As contas estão em `grids.test.ts`; que o
 * IDML abre no InDesign foi provado no InDesign 2026 do André (13/10).
 */
async function abrir(page: Page) {
  await page.goto("/ferramentas/grids");
  await expect(page.locator("[data-grids-vivo]")).toHaveCount(1, { timeout: 30_000 });
}

async function baixar(page: Page, botao: string) {
  const baixando = page.waitForEvent("download");
  await page.locator(botao).click();
  const download = await baixando;
  return { nome: download.suggestedFilename(), bytes: new Uint8Array(await readFile((await download.path())!)) };
}

test("abre no A4 em colunas, com a proposta do Brennimark, e o IDML sai certo", async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("O grid pronto para o InDesign");
  await expect(page.locator("[data-grids-proposta]")).toHaveText("proposta do Brennimark");
  await expect(page.locator("[data-grids-tipo=colunas]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-grids-fonte]")).toContainText("ISO 216");

  const { nome, bytes } = await baixar(page, "[data-grids-baixar-idml]");
  expect(nome).toBe("grid-a4-colunas.idml");
  const z = unzipSync(bytes);
  expect(strFromU8(z.mimetype)).toBe("application/vnd.adobe.indesign-idml-package");
  const prefs = strFromU8(z["Resources/Preferences.xml"]);
  expect(prefs).toContain('ColumnCount="12"');
  expect(prefs).toContain('BaselineDivision="12"');
  expect(prefs).toContain('HorizontalMeasurementUnits="Millimeters"');
});

test("o tipo muda a prévia: modular desenha os módulos; hierárquico, as zonas", async ({ page }) => {
  await abrir(page);
  await page.locator("[data-grids-formato]").selectOption("post-4x5");
  await expect(page.locator("[data-grids-tipo=modular]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-grids-previa] rect[fill^='rgba(0, 158']")).toHaveCount(6 * 8);
  await expect(page.locator("[data-grids-aviso]")).toContainText("para os módulos fecharem na linha de base");

  await page.locator("[data-grids-tipo=hierarquico]").click();
  await page.locator("[data-grids-zonas]").selectOption("1 : 3 : 1,2 (logo · mensagem · chamada)");
  await expect(page.locator("[data-grids-previa] text")).toHaveCount(3);

  await page.locator("[data-grids-tipo=manuscrito]").click();
  await page.locator("[data-grids-proporcao]").selectOption("van-de-graaf");
  await expect(page.locator("[data-grids-previa] rect[fill^='rgba(0, 158']")).toHaveCount(1);
});

test("Stories traz a área segura do Meta; mudar colunas e margens refaz o grid", async ({ page }) => {
  await abrir(page);
  await page.locator("[data-grids-formato]").selectOption("stories");
  await expect(page.locator("[data-grids-segura]")).toHaveCount(1);
  await expect(page.locator("[data-grids-fonte]")).toContainText("Meta");
  const colunas = page.locator("[data-grids-campo=colunas]");
  await colunas.fill("6");
  await colunas.press("Enter");
  await expect(page.locator("[data-grids-previa] rect[fill^='rgba(0, 158']")).toHaveCount(6);
  const { bytes } = await baixar(page, "[data-grids-baixar-idml]");
  const z = unzipSync(bytes);
  expect(strFromU8(z["Resources/Preferences.xml"])).toContain('ColumnCount="6"');
  expect(strFromU8(z["designmap.xml"])).toContain("Área segura da plataforma");
});

test("a versão gratuita tem 13 formatos e deixa a desconstrução para o assinante", async ({ page }) => {
  await abrir(page);
  const opcoes = page.locator("[data-grids-formato] option:not([disabled])");
  await expect(opcoes).toHaveCount(13);
  await expect(page.locator("[data-grids-formato] option[value=livro-14x21]")).toHaveCount(0);
  await expect(page.locator("[data-grids-formato] option[value=gupy-carreiras]")).toHaveCount(0);
  await expect(page.locator("[data-grids-formatos-bloqueados]")).toBeDisabled();
  await expect(page.locator("[data-grids-formatos-bloqueados]")).toContainText("no plano de assinatura");
  await expect(page.locator("[data-grids-desconstrucao-bloqueada]")).toContainText("do plano de assinatura");
  await expect(page.locator("[data-grids-sobreposto]")).toHaveCount(0);
  await expect(page.locator("[data-grids-rotacionado]")).toHaveCount(0);

  const pdf = await baixar(page, "[data-grids-baixar-pdf]");
  expect(pdf.nome).toBe("grid-a4-colunas.pdf");
  expect(strFromU8(pdf.bytes.subarray(0, 8))).toBe("%PDF-1.4");
});
