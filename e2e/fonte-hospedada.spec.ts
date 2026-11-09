import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";

/**
 * A fonte da marca, hospedada (ADR-0007 §3, 03/11/2026).
 *
 * O que só o navegador prova: a licença dita ao lado do botão, o "Baixar kit de
 * fontes" que chega como ZIP com LEIA-ME, o "baixar todos os materiais da
 * marca", e o envio que não sai sem o termo aceito. O que o BANCO garante está
 * em `scripts/prova-fonte-hospedada.sh`; a ordem buscar → assinar → registrar,
 * em `lib/assets/liberar-marca.test.ts`.
 *
 * Rede fingida, como no resto da suíte da biblioteca.
 */
const semEixo = { hierarquia: null, lockup: null, cor: null, polaridade: null, espaco_de_cor: null };
const LICENCA = { tipo: "comprada", titular: "Foundry X", comoObter: "foundryx.example/licencas" };
const ITENS = [
  { id: "item-logo", tipo: "logo", nome: "Logotipo", descricao: "", ordem: 0, regra: [] },
  { id: "item-fonte", tipo: "fonte", nome: "Marca Sans", descricao: "", ordem: 1, regra: [], licenca: LICENCA },
  { id: "item-foto", tipo: "foto", nome: "Álbum", descricao: "", ordem: 2, regra: [] },
];
const base = { label: "x", mime_type: "font/ttf", size_bytes: 40_000, created_at: "2026-11-03T10:00:00Z", baixavel: true, descontinuadoEm: null, substituidoPor: null, miniatura: null, eixos: semEixo };
const ASSETS = [
  { ...base, id: "f-reg", itemId: "item-fonte", file_name: "MarcaSans-Regular.ttf" },
  { ...base, id: "f-bold", itemId: "item-fonte", file_name: "MarcaSans-Bold.ttf" },
  { ...base, id: "l-h", itemId: "item-logo", file_name: "logo.svg", mime_type: "image/svg+xml" },
];

async function comAcervo(page: Page, opcoes: { assets?: unknown[] } = {}) {
  await page.route("**/api/assets", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ itens: ITENS, assets: opcoes.assets ?? ASSETS, manual: null }) }));
  await page.route("https://kit.test/**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/octet-stream", headers: { "Access-Control-Allow-Origin": "*" },
      body: `conteudo de ${rota.request().url().split("/").pop()}` }));
}

test("a página da fonte diz a licença ao lado do botão, e o botão é de kit de fontes", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/materiais/item-fonte");
  const licenca = page.locator("[data-licenca-da-fonte]");
  await expect(licenca).toContainText("Comprada de uma fundição");
  await expect(licenca).toContainText("Titular: Foundry X");
  await expect(licenca).toContainText("Como obter: foundryx.example/licencas");
  await expect(licenca).toContainText("Instalar fonte");
  await expect(page.locator("[data-baixar-kit]")).toHaveText("Baixar kit de fontes · 2 estilos (ZIP)");
});

test("o kit de fontes chega em ZIP com os estilos e o LEIA-ME de licença e instalação", async ({ page }) => {
  await comAcervo(page);
  let pedido: unknown = null;
  await page.route("**/api/assets/kit", (rota) => {
    pedido = rota.request().postDataJSON();
    return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      nome: "acme-marca-sans.zip",
      arquivos: [
        { url: "https://kit.test/f-reg", caminho: "acme-marca-sans/marcasans-regular.ttf" },
        { url: "https://kit.test/f-bold", caminho: "acme-marca-sans/marcasans-bold.ttf" },
      ],
      extras: [{ caminho: "acme-marca-sans/LEIA-ME.txt", texto: "Licença: Comprada\nCOMO INSTALAR\nMac: duplo clique" }],
    }) });
  });
  await page.goto("/dev/materiais/item-fonte");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-baixar-kit]").click()]);
  expect(pedido).toEqual({ itemId: "item-fonte" });
  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(zip).sort()).toEqual([
    "acme-marca-sans/LEIA-ME.txt", "acme-marca-sans/marcasans-bold.ttf", "acme-marca-sans/marcasans-regular.ttf",
  ]);
  expect(new TextDecoder().decode(zip["acme-marca-sans/LEIA-ME.txt"])).toContain("COMO INSTALAR");
});

test("fonte retirada: a tela diz que foi retirada a pedido da fundição", async ({ page }) => {
  await comAcervo(page, { assets: [{ ...ASSETS[0], baixavel: false, retiradaEm: "2026-11-03T12:00:00Z" }, ASSETS[1]] });
  await page.goto("/dev/materiais/item-fonte");
  await expect(page.locator("[data-fonte-retirada]")).toContainText("retiradas a pedido da fundição");
});

test("baixar todos os materiais da marca pede a marca inteira e entrega um ZIP com LEIA-ME", async ({ page }) => {
  await comAcervo(page);
  let pedido: unknown = null;
  await page.route("**/api/assets/kit", (rota) => {
    pedido = rota.request().postDataJSON();
    return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      nome: "acme-materiais.zip",
      arquivos: [
        { url: "https://kit.test/l-h", caminho: "acme-materiais/logo/logotipo/logo.svg" },
        { url: "https://kit.test/f-reg", caminho: "acme-materiais/fonte/marca-sans/marcasans-regular.ttf" },
      ],
      extras: [{ caminho: "acme-materiais/LEIA-ME.txt", texto: "Acme — todos os materiais" }],
    }) });
  });
  await page.goto("/dev/materiais");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-baixar-tudo-da-marca]").click()]);
  expect(pedido).toEqual({ marca: true });
  expect(download.suggestedFilename()).toBe("acme-materiais.zip");
  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(zip).sort()).toEqual([
    "acme-materiais/LEIA-ME.txt", "acme-materiais/fonte/marca-sans/marcasans-regular.ttf", "acme-materiais/logo/logotipo/logo.svg",
  ]);
});

test("baixar tudo: a recusa do servidor aparece em frase, e nada é salvo", async ({ page }) => {
  await comAcervo(page);
  await page.route("**/api/assets/kit", (rota) => rota.fulfill({ status: 400, contentType: "application/json",
    body: JSON.stringify({ message: "Esta marca tem 301 arquivos em uso; o download completo leva até 300. Baixe por item." }) }));
  await page.goto("/dev/materiais");
  let baixou = false;
  page.on("download", () => { baixou = true; });
  await page.locator("[data-baixar-tudo-da-marca]").click();
  await expect(page.locator("[data-aviso-de-tudo]")).toContainText("Baixe por item");
  expect(baixou).toBe(false);
});

test("o envio de fonte mostra o termo e só segue com o aceite, mandando o tipo certo", async ({ page }) => {
  await page.route("**/api/assets**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ itens: ITENS, assets: ASSETS }) }));
  await page.route("**/api/assets/termo-de-fonte", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ versao: "1", texto: "Termo de hospedagem de fonte — versão 1\n\n1. Quem declara." }) }));
  let corpo: Record<string, unknown> | null = null;
  await page.route("**/api/admin/assets/envio", (rota) => {
    corpo = rota.request().postDataJSON() as Record<string, unknown>;
    return rota.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "parou aqui, de propósito" }) });
  });
  await page.goto("/dev/biblioteca");

  await expect(page.locator('[data-item="item-fonte"] [data-licenca-do-item]')).toContainText("Foundry X");
  const envio = page.locator("[data-form-envio]");
  await envio.getByLabel("Item").selectOption("item-fonte");
  await expect(envio.locator('input[type="file"]')).toHaveAttribute("accept", ".otf,.ttf,.ttc");
  const termo = page.locator("[data-termo-de-fonte]");
  await expect(termo).toContainText("v1");
  await expect(termo).toContainText("1. Quem declara.");
  await envio.locator('input[name="label"]').fill("Regular");
  await envio.locator('input[type="file"]').setInputFiles({ name: "MarcaSans-Regular.ttf", mimeType: "application/x-font-ttf", buffer: Buffer.from("fonte") });
  // Sem aceitar, o navegador segura o envio: nenhuma chamada sai.
  await envio.getByRole("button", { name: "Enviar arquivo" }).click();
  expect(corpo).toBeNull();
  await termo.locator('input[name="termo"]').check();
  await envio.getByRole("button", { name: "Enviar arquivo" }).click();
  await expect.poll(() => corpo).not.toBeNull();
  expect(corpo).toMatchObject({ item: "item-fonte", fileName: "MarcaSans-Regular.ttf", mimeType: "font/ttf", termoAceito: true });
});
