import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

/**
 * O Grids do assinante (14/10/2026), com as rotas fingidas: as regras de grid
 * vêm do manual, o logo dos Materiais, as cores da paleta aprovada. O banco
 * (rascunho, aprovar, isolamento) está provado em `scripts/prova-regras-de-grid.sh`;
 * que o pacote abre no InDesign foi provado no InDesign 2026 do André (14/10).
 */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 60" width="200" height="60"><rect width="60" height="60" fill="#ff4103"/><rect x="72" y="12" width="128" height="36" fill="#001621"/></svg>`;
const REGRA_A4 = { id: "ra4", formato: "a4", tipo: "colunas", unidade: "mm", colunas: 8, linhas: null, medianiz: 5, margemSup: 20, margemInf: 25, margemEsq: 18, margemDir: 18, linhaDeBase: 12, zonas: null, descricao: "grid de 8 colunas", pagina: 31, origem: "ia", status: "ready" };
const REGRA_GERAL = { id: "rtodos", formato: "todos", tipo: "modular", unidade: "proporcao", colunas: 4, linhas: 5, medianiz: 0.02, margemSup: 0.06, margemInf: 0.06, margemEsq: 0.06, margemDir: 0.06, linhaDeBase: 12, zonas: null, descricao: "sistema modular", pagina: 32, origem: "ia", status: "draft" };
const VERSAO = { id: "v1", itemId: "i1", tipo: "logo", arquivo: "Acme Logo horizontal.svg", mime: "image/svg+xml", hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espacoDeCor: "rgb", rotulo: null, miniatura: null };

async function fingir(page: Page, o: { regras?: unknown[]; versoes?: unknown[]; protecao?: number } = {}) {
  const chamadas = { ler: 0, aprovar: [] as string[][], guardar: [] as Record<string, unknown>[], baixados: 0 };
  let regras = o.regras ?? [REGRA_A4, REGRA_GERAL];
  await page.route("**/api/grids/regras/ler", (r) => {
    chamadas.ler += 1;
    return r.fulfill({ json: { regras: [], lidas: 0, paginas: [], message: "O manual não fala de grid nem de diagramação nas páginas que o Brennimark leu." } });
  });
  await page.route("**/api/grids/regras/aprovar", (r) => {
    const { ids } = r.request().postDataJSON() as { ids: string[] };
    chamadas.aprovar.push(ids);
    regras = regras.map((x) => ((x as { id: string }).id === ids[0] ? { ...(x as object), status: "ready" } : x));
    return r.fulfill({ json: { aprovadas: 1 } });
  });
  await page.route("**/api/grids/regras", (r) => {
    if (r.request().method() === "PATCH") {
      chamadas.guardar.push(r.request().postDataJSON());
      return r.fulfill({ json: { regra: {} } });
    }
    return r.fulfill({ json: {
      marca: "Acme", regras, versoesDoLogo: o.versoes ?? [VERSAO], foraDoInDesign: [],
      paleta: [{ nome: "Brasa", hex: "#FF4103", cmyk: "C0 M80 Y100 K0", pagina: 12 }, { nome: "Noite", hex: "#001621", cmyk: null, pagina: 12 }],
      coresEmRascunho: 1,
      regrasDoLogo: { protecao: o.protecao ?? 0.25, reducao: { logo: 120, simbolo: null }, regras: [] },
      podeEditar: true, podeAprovar: true,
    } });
  });
  await page.route("**/api/assets/kit", (r) => {
    chamadas.baixados += 1;
    return r.fulfill({ json: { nome: "kit.zip", arquivos: [{ url: "https://storage.prova.test/logo.svg", caminho: "logo.svg" }] } });
  });
  await page.route("https://storage.prova.test/**", (r) => r.fulfill({ headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "image/svg+xml" }, body: LOGO }));
  return chamadas;
}

async function abrir(page: Page) {
  await page.goto("/dev/grids-assinante");
  await expect(page.locator("[data-grids-vivo]")).toHaveCount(1, { timeout: 30_000 });
}

test("o grid vem do manual, a tela diz de onde, e o pacote leva logo, cores e estilos", async ({ page }) => {
  const chamadas = await fingir(page);
  await abrir(page);
  await expect(page.locator("[data-grids-origem]")).toHaveText("Grid: do manual, p. 31 — aprovada");
  await expect(page.locator("[data-grids-campo=colunas]")).toHaveValue("8");
  await expect(page.locator("[data-grids-logo]")).toContainText("Área de proteção: 25%");
  await expect(page.locator("[data-grids-logo-previa] image")).toHaveCount(1);
  expect(chamadas.baixados, "o original do logo pela rota que registra o download").toBe(1);
  expect(chamadas.ler, "com regras gravadas, a IA não é chamada").toBe(0);
  await expect(page.locator("[data-grids-cores]")).toContainText("1 cor em rascunho não entra");
  await expect(page.locator("[data-grids-cores]")).toContainText("Noite: o manual não declara CMYK");

  const baixando = page.waitForEvent("download");
  await page.locator("[data-grids-baixar-idml]").click();
  const download = await baixando;
  expect(download.suggestedFilename()).toBe("grid-acme-a4-colunas.zip");
  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(zip).sort()).toEqual(["LEIA-ME.txt", "Links/logo-acme-logo-horizontal.svg", "grid-acme-a4-colunas.idml"]);
  const idml = unzipSync(zip["grid-acme-a4-colunas.idml"]);
  const spread = strFromU8(idml["Spreads/Spread_sp1.xml"]);
  expect(spread).toContain('<SVG Self="gr_logo"');
  expect(spread).toContain('LinkResourceURI="file:Links/logo-acme-logo-horizontal.svg"');
  expect(spread).toContain('Name="Área de proteção do logo"');
  expect(strFromU8(idml["Resources/Graphic.xml"])).toContain('Space="CMYK" ColorValue="0 80 100 0" Name="Brasa — manual, p. 12"');
  expect(strFromU8(idml["Resources/Styles.xml"])).toContain('Name="Texto"');
  expect(strFromU8(idml["Resources/Preferences.xml"])).toContain('ColumnCount="8"');
  expect(strFromU8(idml["designmap.xml"])).toContain("Grid — do manual, p. 31 — aprovada");
  const leia = strFromU8(zip["LEIA-ME.txt"]);
  expect(leia).toContain("GRID (colunas): do manual, p. 31 — aprovada.");
  expect(leia).toContain("tipografia da marca");
});

test("a regra geral vale onde o formato não tem regra, identificada como rascunho; confirmar aprova", async ({ page }) => {
  const chamadas = await fingir(page);
  await abrir(page);
  await page.locator("[data-grids-formato]").selectOption("post-4x5");
  await expect(page.locator("[data-grids-origem]")).toContainText("regra geral da marca");
  await expect(page.locator("[data-grids-origem]")).toContainText("lida pela IA, ainda não confirmada");
  await expect(page.locator("[data-grids-tipo=modular]")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-grids-confirmar]").click();
  await expect(page.locator("[data-grids-regras] [role=status]")).toHaveText("Regra aprovada.");
  expect(chamadas.aprovar).toEqual([["rtodos"]]);
});

test("ajustar na tela muda a origem; guardar grava a regra do formato", async ({ page }) => {
  const chamadas = await fingir(page);
  await abrir(page);
  const colunas = page.locator("[data-grids-campo=colunas]");
  await colunas.fill("6");
  await colunas.press("Enter");
  await expect(page.locator("[data-grids-origem]")).toContainText("ajustado na tela");
  await page.locator("[data-grids-guardar]").click();
  await expect.poll(() => chamadas.guardar.length).toBe(1);
  expect(chamadas.guardar[0]).toMatchObject({ formato: "a4", tipo: "colunas", unidade: "mm", colunas: 6, pagina: 31 });
});

test("margem menor que a área de proteção: avisa e ajusta", async ({ page }) => {
  await fingir(page, { protecao: 2 });
  await abrir(page);
  await expect(page.locator("[data-grids-aviso-logo]").first()).toContainText("menor que a área de proteção");
  await page.locator("[data-grids-ajustar-margens]").click();
  await expect(page.locator("[data-grids-ajustar-margens]")).toHaveCount(0);
});

test("sem regra de grid: lê o manual uma vez e diz o que achou; sem logo: explica", async ({ page }) => {
  const chamadas = await fingir(page, { regras: [], versoes: [] });
  await abrir(page);
  await expect(page.locator("[data-grids-regras]")).toContainText("não fala de grid");
  expect(chamadas.ler).toBe(1);
  await expect(page.locator("[data-grids-origem]")).toContainText("proposta do Brennimark");
  await expect(page.locator("[data-grids-sem-logo]")).toContainText("não tem logotipo nos Materiais");
});
