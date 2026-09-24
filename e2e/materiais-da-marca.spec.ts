import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";

/**
 * Materiais da marca — fatia 5 (24/09/2026).
 *
 * O que só o navegador prova: a lista com prévia, a regra CITADA ao lado do
 * botão, o kit que chega como ZIP organizado pelos eixos, a falha que não
 * salva kit pela metade, e a seleção que baixa um arquivo direto ou vários em
 * ZIP. O que o BANCO garante está em `scripts/prova-materiais-regra-e-miniatura.sh`;
 * a ordem buscar → assinar → registrar, em `lib/assets/liberar-kit.test.ts`.
 *
 * Rede fingida, como no resto da suíte da biblioteca.
 */

// Um PNG de 1×1 — a miniatura que o envio gera.
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const semEixo = { hierarquia: null, lockup: null, cor: null, polaridade: null, espaco_de_cor: null };
const logo = { hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espaco_de_cor: "rgb" };
const base = { label: "x", mime_type: "image/svg+xml", size_bytes: 2048, created_at: "2026-09-24T10:00:00Z", baixavel: true, descontinuadoEm: null, substituidoPor: null };

const ITENS = [
  { id: "item-logo", tipo: "logo", nome: "Logotipo", descricao: "", ordem: 0,
    regra: [{ pagina: 12, titulo: "Área de proteção", status: "ready" }, { pagina: 14, titulo: "Usos proibidos", status: "draft" }] },
  { id: "item-icones", tipo: "icone", nome: "Ícones", descricao: "", ordem: 1, regra: [] },
  { id: "item-paleta", tipo: "paleta", nome: "Paleta", descricao: "", ordem: 2, regra: [] },
];
const ASSETS = [
  { ...base, id: "v-h", itemId: "item-logo", file_name: "vaio-h.svg", eixos: logo, miniatura: PNG },
  { ...base, id: "v-v", itemId: "item-logo", file_name: "vaio-v.eps", mime_type: "application/postscript",
    eixos: { ...logo, lockup: "vertical", cor: "monocromatico", polaridade: "negativo", espaco_de_cor: "cmyk" }, miniatura: null },
  { ...base, id: "v-velho", itemId: "item-logo", file_name: "vaio-antigo.svg", eixos: logo, miniatura: null, descontinuadoEm: "2026-09-01T00:00:00Z" },
  { ...base, id: "v-ico", itemId: "item-icones", file_name: "icone.svg", eixos: { ...semEixo, cor: "colorido", polaridade: "positivo", espaco_de_cor: "rgb" }, miniatura: PNG },
  { ...base, id: "v-pal", itemId: "item-paleta", file_name: "paleta.ase", mime_type: "application/octet-stream", eixos: { ...semEixo, espaco_de_cor: "rgb" }, miniatura: null },
];

async function comAcervo(page: Page, extra?: (corpo: Record<string, unknown>) => void) {
  await page.route("**/api/assets", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ itens: ITENS, assets: ASSETS, manual: { id: "m", paginas: 27 } }) }));
  await page.route("**/api/assets/kit", async (rota) => {
    const corpo = rota.request().postDataJSON() as Record<string, unknown>;
    extra?.(corpo);
    const ids = (corpo.ids as string[] | undefined) ?? ["v-h", "v-v"];
    const caminhos: Record<string, string> = {
      "v-h": "sony-vaio-logotipo/principal/horizontal/colorido-positivo-rgb/vaio-h.svg",
      "v-v": "sony-vaio-logotipo/principal/vertical/monocromatico-negativo-cmyk/vaio-v.eps",
      "v-velho": "sony-vaio-logotipo/principal/horizontal/colorido-positivo-rgb/vaio-antigo.svg",
    };
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      nome: "sony-vaio-logotipo.zip",
      arquivos: ids.map((id) => ({ url: `https://kit.test/${id}`, caminho: caminhos[id] })),
    }) });
  });
  await page.route("https://kit.test/**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/octet-stream", headers: { "Access-Control-Allow-Origin": "*" },
      body: `conteudo de ${rota.request().url().split("/").pop()}` }));
}

test("o catálogo é uma lista com prévia, e a prancha conta os itens", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/materiais");
  await expect(page.locator("[data-prancha-contagem]")).toHaveText(/M · 03 itens/);
  const logotipo = page.locator("[data-item-do-catalogo='item-logo']");
  await expect(logotipo).toContainText("Logotipo");
  // Fora de uso não conta: dois em uso.
  await expect(logotipo).toContainText("2 arquivos");
  await expect(logotipo.locator("img")).toHaveAttribute("src", PNG);
  // Sem miniatura, o formato — nunca um quadrado mudo.
  await expect(page.locator("[data-item-do-catalogo='item-paleta'] [data-sem-previa]")).toContainText(/ase/i);
});

test("filtrar por tipo e buscar pelo nome", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/materiais");
  await page.getByLabel("Tipo").selectOption("icone");
  await expect(page.locator("[data-item-do-catalogo]")).toHaveCount(1);
  await page.getByLabel("Tipo").selectOption("");
  await page.getByPlaceholder("Buscar").fill("pal");
  await expect(page.locator("[data-item-do-catalogo]")).toHaveCount(1);
  await expect(page.locator("[data-item-do-catalogo='item-paleta']")).toBeVisible();
});

test("a página do item cita a regra ao lado do botão — com página, e rascunho dito como rascunho", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/materiais/item-logo");
  const regra = page.locator("[data-regra-do-item]");
  await expect(regra.locator("[data-regra-citada='12']")).toContainText("Área de proteção");
  await expect(regra.locator("[data-regra-citada='12']")).toHaveAttribute("href", /original\?pagina=12/);
  await expect(regra.locator("[data-regra-citada='14']")).toContainText(/Rascunho/i);
  await expect(regra.locator("[data-regra-citada='12']")).not.toContainText(/Rascunho/i);
});

test("sem regra ligada, a tela diz — e não inventa", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/materiais/item-icones");
  await expect(page.locator("[data-regra-do-item]")).toContainText("Nenhuma página do manual foi ligada");
});

test("Baixar kit entrega um ZIP organizado pelos eixos, só com o que está em uso", async ({ page }) => {
  let pedido: Record<string, unknown> | null = null;
  await comAcervo(page, (corpo) => { pedido = corpo; });
  await page.goto("/dev/materiais/item-logo");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-baixar-kit]").click()]);
  expect(pedido).toEqual({ itemId: "item-logo" });
  expect(download.suggestedFilename()).toBe("sony-vaio-logotipo.zip");
  const arquivos = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(arquivos).sort()).toEqual([
    "sony-vaio-logotipo/principal/horizontal/colorido-positivo-rgb/vaio-h.svg",
    "sony-vaio-logotipo/principal/vertical/monocromatico-negativo-cmyk/vaio-v.eps",
  ]);
  expect(new TextDecoder().decode(arquivos["sony-vaio-logotipo/principal/horizontal/colorido-positivo-rgb/vaio-h.svg"])).toBe("conteudo de v-h");
});

test("um arquivo do kit que não chega: aviso, e nada salvo pela metade", async ({ page }) => {
  await comAcervo(page);
  await page.route("https://kit.test/v-v", (rota) => rota.fulfill({ status: 403, body: "" }));
  await page.goto("/dev/materiais/item-logo");
  let baixou = false;
  page.on("download", () => { baixou = true; });
  await page.locator("[data-baixar-kit]").click();
  await expect(page.locator("[data-aviso-do-kit]")).toContainText("nada foi salvo pela metade");
  expect(baixou).toBe(false);
});

test("a prévia do EPS explica por que não existe", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/materiais/item-logo");
  await page.locator("[data-escolher-arquivos]").click();
  await expect(page.locator("[data-lista-de-arquivos] li", { hasText: "vaio-v.eps" }).locator("[data-sem-previa]")).toContainText(/eps/i);
});

test("escolher arquivos: fora de uso só com o filtro; vários saem em ZIP com os ids", async ({ page }) => {
  let pedido: Record<string, unknown> | null = null;
  await comAcervo(page, (corpo) => { pedido = corpo; });
  await page.goto("/dev/materiais/item-logo");
  await page.locator("[data-escolher-arquivos]").click();
  const lista = page.locator("[data-lista-de-arquivos]");
  await expect(lista.getByText("vaio-antigo.svg")).toHaveCount(0);
  await lista.getByLabel(/Mostrar fora de uso/).check();
  await expect(lista.getByText("vaio-antigo.svg")).toBeVisible();

  await lista.getByLabel("vaio-h.svg").check();
  await lista.getByLabel("vaio-antigo.svg").check();
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-baixar-selecionados]").click()]);
  expect(pedido).toEqual({ itemId: "item-logo", ids: ["v-h", "v-velho"] });
  expect(download.suggestedFilename()).toBe("sony-vaio-logotipo.zip");
});

test("um arquivo só, escolhido a dedo, vai pela rota que registra — sem ZIP", async ({ page }) => {
  await comAcervo(page);
  await page.route("**/api/assets/v-h/download**", (rota) => rota.fulfill({ status: 200, contentType: "text/plain", body: "ok" }));
  await page.goto("/dev/materiais/item-logo");
  await page.locator("[data-escolher-arquivos]").click();
  await page.locator("[data-lista-de-arquivos]").getByLabel("vaio-h.svg").check();
  const pedido = page.waitForRequest("**/api/assets/v-h/download**");
  await page.locator("[data-baixar-selecionados]").click();
  await pedido;
});

test("quem edita liga a regra às páginas; quem consulta não vê o editor", async ({ page }) => {
  let corpo: unknown = null;
  await comAcervo(page);
  await page.route("**/api/admin/assets/itens/regra", async (rota) => {
    corpo = rota.request().postDataJSON();
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ regra: [] }) });
  });
  await page.goto("/dev/materiais/item-icones");
  await expect(page.locator("[data-editor-da-regra]")).toHaveCount(0);

  await page.goto("/dev/materiais/item-icones?edita=1");
  const editor = page.locator("[data-editor-da-regra]");
  await editor.getByLabel("Páginas do manual").fill("12, 14");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await expect(editor).toContainText("Regra guardada.");
  expect(corpo).toEqual({ id: "item-icones", paginas: ["12", "14"] });
});

/**
 * O ENVIO direto ao Storage (24/09/2026) — e a miniatura que nasce no
 * navegador de quem envia.
 *
 * O arquivo não passa pela função da Vercel (que corta o corpo em ~4,5 MB):
 * preparar (a rota confere e escolhe o caminho) → enviar (daqui direto ao
 * Storage, por endereço assinado para aquele caminho) → concluir (só a
 * autorização assinada e a miniatura voltam à rota).
 */
type Envio = { preparo: Record<string, unknown> | null; armazenado: Buffer | null; conclusao: string };

async function enviar(page: Page, nome: string, tipo: string, conteudo: Buffer | string): Promise<Envio> {
  const envio: Envio = { preparo: null, armazenado: null, conclusao: "" };
  await page.route("**/api/assets", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ itens: ITENS, assets: [], manual: null }) }));
  await page.route("**/api/admin/assets/envio**", async (rota) => {
    envio.preparo = rota.request().postDataJSON();
    await rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ autorizacao: "autorizacao-assinada", caminho: "w/b/uuid-arquivo", token: "tok" }) });
  });
  // O Storage de mentira: é aqui que o arquivo tem de chegar.
  await page.route("**/storage/v1/object/upload/sign/**", async (rota) => {
    envio.armazenado = rota.request().postDataBuffer();
    await rota.fulfill({ status: 200, contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ Key: "brand-assets/w/b/uuid-arquivo" }) });
  });
  await page.route("**/api/admin/assets", async (rota) => {
    envio.conclusao = rota.request().postDataBuffer()?.toString("latin1") ?? "";
    await rota.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, substituicao: "nao-pedida" }) });
  });
  await page.goto("/dev/biblioteca");
  const form = page.locator("[data-form-envio]");
  await form.getByLabel("Item").selectOption("item-paleta");
  await form.locator('select[name="espaco_de_cor"]').selectOption("rgb");
  await form.locator('input[name="label"]').fill("Arquivo");
  await form.locator('input[name="file"]').setInputFiles({ name: nome, mimeType: tipo, buffer: Buffer.from(conteudo) });
  const pedido = page.waitForRequest("**/api/admin/assets");
  await form.evaluate((f) => (f as HTMLFormElement).requestSubmit());
  await pedido;
  await expect.poll(() => envio.conclusao).not.toBe("");
  return envio;
}

test("o arquivo vai direto ao Storage; a rota recebe só a autorização — e a miniatura do SVG", async ({ page }) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#123"/></svg>';
  const envio = await enviar(page, "logo.svg", "image/svg+xml", svg);
  expect(envio.preparo).toMatchObject({ item: "item-paleta", label: "Arquivo", fileName: "logo.svg", mimeType: "image/svg+xml",
    sizeBytes: Buffer.byteLength(svg), espaco_de_cor: "rgb" });
  expect(envio.armazenado?.toString()).toContain("<svg");
  expect(envio.conclusao).toContain('name="autorizacao"');
  expect(envio.conclusao).toContain("autorizacao-assinada");
  expect(envio.conclusao).toContain('name="miniatura"; filename="miniatura.png"');
  expect(envio.conclusao).toContain("\x89PNG");
  // O arquivo NÃO passa pela função.
  expect(envio.conclusao).not.toContain("<svg");
  expect(envio.conclusao).not.toContain('name="file"');
});

test("um arquivo de 6 MB — acima do corte da Vercel — sai inteiro para o Storage, e a rota não o carrega", async ({ page }) => {
  const grande = Buffer.concat([Buffer.from("%!PS-Adobe-3.0 EPSF-3.0\n"), Buffer.alloc(6 * 1024 * 1024, 0x20)]);
  const envio = await enviar(page, "logo-grande.eps", "application/postscript", grande);
  expect(envio.preparo).toMatchObject({ sizeBytes: grande.length });
  // O cliente do Supabase embrulha o arquivo num formulário (multipart): o que
  // chega é o arquivo inteiro mais uns trezentos bytes de cabeçalho.
  expect(envio.armazenado?.length).toBeGreaterThanOrEqual(grande.length);
  expect(envio.armazenado?.length).toBeLessThan(grande.length + 2_000);
  expect(envio.armazenado?.toString("latin1")).toContain("%!PS-Adobe-3.0");
  expect(envio.conclusao.length).toBeLessThan(10_000);
});

test("EPS sem tipo declarado é tratado como PostScript — e vai sem miniatura", async ({ page }) => {
  const envio = await enviar(page, "logo.eps", "", "%!PS-Adobe-3.0 EPSF-3.0\n");
  expect(envio.preparo).toMatchObject({ mimeType: "application/postscript" });
  expect(envio.conclusao).not.toContain('name="miniatura"');
});
