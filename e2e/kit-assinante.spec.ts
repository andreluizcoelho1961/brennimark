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

async function fingir(page: Page, opcoes: { regras?: unknown[]; semLogo?: boolean; fonteDaAssinatura?: { nome: string; origem: string } } = {}) {
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
    fonteDaAssinatura: opcoes.fonteDaAssinatura ?? null,
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

test("as versões (10/10/2026): o Kit marca a melhor de cada papel, a pessoa troca, e só a escolhida é baixada", async ({ page }) => {
  const HORIZONTAL = LOGO;
  const VERTICAL = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 260"><circle cx="100" cy="80" r="70" fill="#0b4f9e"/><rect x="20" y="180" width="160" height="60" fill="#0b4f9e"/></svg>`;
  const SIMBOLO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="#0b4f9e"/></svg>`;
  const base = { itemId: "i1", tipo: "logo", hierarquia: "principal", cor: "colorido", polaridade: "positivo", espacoDeCor: "rgb", miniatura: null };
  const h = { ...base, id: "h", arquivo: "acme-h.svg", mime: "image/svg+xml", lockup: "horizontal" };
  const h2 = { ...base, id: "h2", arquivo: "acme-h-mono.svg", mime: "image/svg+xml", lockup: "horizontal", cor: "monocromatico" };
  const vert = { ...base, id: "vert", arquivo: "acme-v.svg", mime: "image/svg+xml", lockup: "vertical" };
  const eps = { ...base, id: "eps", arquivo: "acme.eps", mime: "application/postscript", lockup: "horizontal", hierarquia: "secundario" };
  const ico = { ...base, id: "ico", itemId: "i2", tipo: "icone", arquivo: "acme-s.svg", mime: "image/svg+xml", hierarquia: null, lockup: null };
  const baixados: string[] = [];
  await page.route("**/api/kit/regras", (r) => r.fulfill({ json: {
    marca: "Acme", regras: [AREA, LOGO_MIN, SIMB_MIN], coresDaMarca: [], podeEditar: false, podeAprovar: false,
    desenhos: { logo: h, vertical: vert, simbolo: ico, negativo: null, semLogoPorque: null },
    versoes: [h, h2, vert, eps, ico],
  } }));
  await page.route("**/api/assets/kit", (r) => {
    const id = (r.request().postDataJSON() as { ids: string[] }).ids[0];
    baixados.push(id);
    return r.fulfill({ json: { nome: "kit.zip", arquivos: [{ url: `https://storage.prova.test/${id}.svg`, caminho: `${id}.svg` }] } });
  });
  await page.route("https://storage.prova.test/**", (r) => {
    const id = r.request().url().split("/").pop()!.replace(".svg", "");
    const corpo = id === "vert" ? VERTICAL : id === "ico" ? SIMBOLO : HORIZONTAL;
    return r.fulfill({ headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "image/svg+xml" }, body: corpo });
  });
  await page.goto("/dev/kit-assinante");

  // A escolha do Kit já vem marcada; só as escolhidas foram baixadas.
  const papel = (p: string) => page.locator(`[data-kit-papel=${p}]`);
  await expect(papel("logo").locator("[data-kit-opcao=h]")).toHaveAttribute("aria-pressed", "true");
  await expect(papel("vertical").locator("[data-kit-opcao=vert]")).toHaveAttribute("aria-pressed", "true");
  await expect(papel("simbolo").locator("[data-kit-opcao=ico]")).toHaveAttribute("aria-pressed", "true");
  await expect(papel("negativo")).toHaveCount(0);
  await expect.poll(() => [...baixados].sort()).toEqual(["h", "ico", "vert"]);

  // O EPS aparece, apagado, com o motivo.
  await expect(papel("logo").locator("[data-kit-opcao=eps]")).toBeDisabled();
  await expect(papel("logo")).toContainText("acme.eps");

  // Trocar baixa só a nova; voltar não baixa de novo.
  await papel("logo").locator("[data-kit-opcao=h2]").click();
  await expect(papel("logo").locator("[data-kit-opcao=h2]")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => baixados.filter((x) => x === "h2").length).toBe(1);
  await papel("logo").locator("[data-kit-opcao=h]").click();
  await expect(papel("logo").locator("[data-kit-opcao=h]")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(300);
  expect(baixados.filter((x) => x === "h").length).toBe(1);

  // O pacote traz o vertical na apresentação, em pé.
  const baixando = page.waitForEvent("download");
  await page.locator("[data-kit-baixar-tudo]").click();
  const zip = unzipSync(new Uint8Array(await readFile((await (await baixando).path())!)));
  const png = zip["apresentacao/logotipo-vertical-2000.png"];
  expect(png, "o vertical entra na apresentação").toBeTruthy();
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  expect(dv.getUint32(20), "em pé: mais alto que largo").toBeGreaterThan(dv.getUint32(16));
  expect(Object.keys(zip)).toContain("apresentacao/logotipo-vertical.svg");

  // "Não usar" o símbolo: o pacote não leva o símbolo.
  await papel("simbolo").locator("[data-kit-opcao=nenhuma]").click();
  await expect(papel("simbolo").locator("[data-kit-opcao=nenhuma]")).toHaveAttribute("aria-pressed", "true");
  const baixando2 = page.waitForEvent("download");
  await page.locator("[data-kit-baixar-tudo]").click();
  const zip2 = unzipSync(new Uint8Array(await readFile((await (await baixando2).path())!)));
  expect(Object.keys(zip2)).not.toContain("apresentacao/simbolo-2000.png");
});

test("a assinatura usa a fonte substituta aprovada da tipografia, e diz de onde veio", async ({ page }) => {
  await fingir(page, { fonteDaAssinatura: { nome: "Verdana", origem: "a substituta que o manual indica (p. 30)" } });
  await page.goto("/dev/kit-assinante");
  await expect(page.locator("[data-kit-dos-materiais]")).toContainText("Vêm dos Materiais da marca");
  await page.locator("[data-kit-aba=email]").click();
  await expect(page.locator("[data-kit-fonte-da-assinatura]")).toHaveText("Fonte: Verdana, a substituta que o manual indica (p. 30).");
  const tabela = page.locator("[data-kit-assinatura-previa] table");
  await expect(tabela).toHaveAttribute("style", /font-family:\s*Verdana, Arial, Helvetica, sans-serif|font-family:'Verdana',Arial/);

  const baixando = page.waitForEvent("download");
  await page.locator("[data-kit-baixar-grupo]").click();
  const zip = unzipSync(new Uint8Array(await readFile((await (await baixando).path())!)));
  expect(strFromU8(zip["email/assinatura.html"])).toContain("font-family:'Verdana',Arial,Helvetica,sans-serif");
  expect(strFromU8(zip["LEIA-ME.txt"])).toContain("A assinatura usa Verdana, a substituta que o manual indica (p. 30)");
});
