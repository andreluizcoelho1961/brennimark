import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

/**
 * O Kit do assinante (10/10/2026), com as rotas fingidas: o logo vem dos
 * Materiais, as regras do manual. O banco (rascunho, aprovar, isolamento) está
 * provado em `scripts/prova-regras-do-logo.sh`.
 */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120"><circle cx="60" cy="60" r="50" fill="#0b4f9e"/><rect x="130" y="20" width="370" height="80" fill="#0b4f9e"/></svg>`;
const AREA = { id: "r1", chave: "area_de_protecao", valor: 0.25, descricao: "x = altura do B", pagina: 12, origem: "ia", status: "draft" };
const LOGO_MIN = { id: "r2", chave: "reducao_minima_logo", valor: 120, descricao: "120 px", pagina: 13, origem: "ia", status: "draft" };
const SIMB_MIN = { id: "r3", chave: "reducao_minima_simbolo", valor: 24, descricao: "24 px", pagina: 13, origem: "ia", status: "draft" };

async function fingir(page: Page, opcoes: { regras?: unknown[]; semLogo?: boolean } = {}) {
  const chamadas = { ler: 0, aprovar: [] as string[][], baixados: 0 };
  let regras = opcoes.regras ?? [AREA];
  await page.route("**/api/kit/regras/ler", (r) => {
    chamadas.ler += 1;
    regras = [AREA, LOGO_MIN, SIMB_MIN];
    return r.fulfill({ json: { regras, lidas: 2, paginas: [12, 13] } });
  });
  await page.route("**/api/kit/regras/aprovar", (r) => {
    const { ids } = r.request().postDataJSON() as { ids: string[] };
    chamadas.aprovar.push(ids);
    regras = regras.map((x) => ((x as { id: string }).id === ids[0] ? { ...(x as object), status: "ready" } : x));
    return r.fulfill({ json: { aprovadas: 1 } });
  });
  await page.route("**/api/kit/regras", (r) => r.fulfill({ json: {
    marca: "Acme", regras, coresDaMarca: ["#0B4F9E", "#FFC629"], podeEditar: true, podeAprovar: true,
    desenhos: {
      logo: opcoes.semLogo ? null : { id: "v1", itemId: "i1", tipo: "logo", arquivo: "acme.svg", mime: "image/svg+xml", hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espacoDeCor: "rgb" },
      simbolo: null, negativo: null,
    },
  } }));
  await page.route("**/api/assets/kit", (r) => {
    chamadas.baixados += 1;
    return r.fulfill({ json: { nome: "kit.zip", arquivos: [{ url: "https://storage.prova.test/acme.svg", caminho: "acme.svg" }] } });
  });
  await page.route("https://storage.prova.test/**", (r) => r.fulfill({ headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "image/svg+xml" }, body: LOGO }));
  return chamadas;
}

test("o logo vem dos Materiais, a regra que falta é lida do manual uma vez, e cada regra diz de onde veio", async ({ page }) => {
  const chamadas = await fingir(page);
  await page.goto("/dev/kit-assinante");
  await expect(page.locator("[data-kit-dos-materiais]")).toContainText("Vêm dos Materiais da marca");
  // O original foi buscado pela rota que registra o download.
  expect(chamadas.baixados).toBe(1);

  // Faltavam duas regras: o Kit leu o manual, uma vez.
  await expect(page.locator("[data-kit-regra=reducao_minima_logo] [data-kit-regra-valor]")).toHaveText("120 px de largura");
  expect(chamadas.ler).toBe(1);
  const area = page.locator("[data-kit-regra=area_de_protecao]");
  await expect(area.locator("[data-kit-regra-valor]")).toHaveText("25% da altura do logo");
  await expect(area.locator("[data-kit-regra-situacao]")).toHaveText("lida pela IA — confira");
  await expect(area.getByRole("link", { name: "manual, p. 12" })).toHaveAttribute("href", "/docs/original?pagina=12");

  // As cores aprovadas da paleta viram opção de fundo.
  await page.locator("[data-kit-fundo=cor]").click();
  await expect(page.locator("[data-kit-cores-da-marca] button")).toHaveCount(2);

  // Confirmar aprova pela rota de aprovação.
  await area.locator("[data-kit-confirmar]").click();
  await expect(area.locator("[data-kit-regra-situacao]")).toHaveText("aprovada");
  expect(chamadas.aprovar).toEqual([["r1"]]);

  // O LEIA-ME diz de que página veio cada regra, e se está aprovada.
  const baixando = page.waitForEvent("download");
  await page.locator("[data-kit-baixar-tudo]").click();
  const zip = unzipSync(new Uint8Array(await readFile((await (await baixando).path())!)));
  const leia = strFromU8(zip["LEIA-ME.txt"]);
  expect(leia).toContain("Área de proteção aplicada: 25% da altura do logo, do manual, p. 12, aprovada.");
  expect(leia).toContain("Redução mínima do logotipo: 120 px de largura, do manual, p. 13, lida pela IA e ainda não confirmada.");
  expect(leia).not.toContain("informada por você");
});

test("com as três regras já gravadas, o Kit não chama a IA", async ({ page }) => {
  const chamadas = await fingir(page, { regras: [AREA, LOGO_MIN, SIMB_MIN] });
  await page.goto("/dev/kit-assinante");
  await expect(page.locator("[data-kit-regra=reducao_minima_simbolo] [data-kit-regra-valor]")).toHaveText("24 px de largura");
  await page.waitForTimeout(300);
  expect(chamadas.ler).toBe(0);
});

test("marca sem logotipo nos Materiais: o Kit explica o que falta", async ({ page }) => {
  await fingir(page, { semLogo: true, regras: [AREA, LOGO_MIN, SIMB_MIN] });
  await page.goto("/dev/kit-assinante");
  await expect(page.locator("[data-kit-sem-logo]")).toContainText("ainda não tem o logotipo nos Materiais");
});
