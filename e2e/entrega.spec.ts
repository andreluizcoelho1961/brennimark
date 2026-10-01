import { expect, test, type Page } from "@playwright/test";
import { unzipSync } from "fflate";
import { readFile } from "node:fs/promises";

/**
 * A página PÚBLICA do link de entrega (30/09/2026, ADR-0007 §2.5).
 *
 * A de verdade abre o link no banco com a chave de serviço; a bancada recebe a
 * vista pronta e o download é fingido. O que o banco garante — código, prazo,
 * revogação, só arquivo do link, registro antes de entregar — está em
 * `scripts/prova-links-de-entrega.sh`; a ordem assinar → registrar → emitir, em
 * `lib/links/entrega.test.ts`. Aqui: o que quem recebe vê e faz, inclusive
 * depois de expirado e depois de revogado (ADR-0007 §10).
 */

const CODIGO = "c".repeat(43);

async function fingirDownload(page: Page, pedidos: Record<string, unknown>[], resposta?: (corpo: Record<string, unknown>) => { status?: number; json: unknown }) {
  await page.route(`**/api/receber/${CODIGO}/baixar`, async (rota) => {
    const corpo = rota.request().postDataJSON() as Record<string, unknown>;
    pedidos.push(corpo);
    const r = resposta?.(corpo) ?? { json: { arquivos: (corpo.arquivos as string[]).map((id) => ({ id, url: `https://arquivos.test/${id}`, file_name: `${id}.svg` })) } };
    await rota.fulfill({ status: r.status ?? 200, json: r.json });
  });
  await page.route("https://arquivos.test/**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/octet-stream", headers: { "Access-Control-Allow-Origin": "*" }, body: `conteudo de ${rota.request().url().split("/").pop()}` }));
}

async function identificar(page: Page) {
  const form = page.locator("[data-identificacao]");
  await form.getByLabel("Nome").fill("Carla");
  await form.getByLabel("E-mail").fill("carla@grafica.com");
  await form.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("[data-identificado]")).toContainText("Carla · carla@grafica.com");
}

test("mostra o link, a marca, o prazo, os arquivos e as páginas que regem — rascunho dito como rascunho", async ({ page }) => {
  await page.goto("/dev/entrega");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gráfica Pampa — cartazes de outubro");
  await expect(page.locator("[data-entrega]")).toContainText("Arquivos da marca Marca Um, enviados para Carla.");
  await expect(page.locator("[data-prazo]")).toContainText("7 de outubro de 2026");
  await expect(page.locator('[data-pagina-da-regra="9"]')).toContainText("Área de proteção");
  await expect(page.locator('[data-pagina-da-regra="11"] [data-regra-rascunho]')).toHaveText("Rascunho");
  await expect(page.locator('[data-arquivo-da-entrega="a1"] [data-atualizado]')).toContainText("Atualizado pela marca em 01/10");
  // Retirado de uso: dito, e sem botão.
  await expect(page.locator('[data-arquivo-da-entrega="a3"] [data-retirado]')).toBeVisible();
  await expect(page.locator('[data-baixar-arquivo="a3"]')).toHaveCount(0);
  // O endereço traz o código: nada de mandá-lo adiante no Referer.
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});

test("sem nome e e-mail, nada se baixa; e-mail malformado é recusado na tela", async ({ page }) => {
  await page.goto("/dev/entrega");
  await expect(page.locator('[data-baixar-arquivo="a1"]')).toBeDisabled();
  await expect(page.locator("[data-baixar-todos]")).toBeDisabled();
  const form = page.locator("[data-identificacao]");
  await form.getByLabel("Nome").fill("Carla");
  await form.getByLabel("E-mail").fill("carla-sem-arroba");
  await form.getByRole("button", { name: "Continuar" }).click();
  await expect(page.locator("[data-entrega]").getByRole("alert")).toHaveText("Preencha seu nome e um e-mail válido.");
  await expect(page.locator('[data-baixar-arquivo="a1"]')).toBeDisabled();
});

test("um arquivo: pede com nome, e-mail e o id, e vai direto ao endereço assinado", async ({ page }) => {
  const pedidos: Record<string, unknown>[] = [];
  await fingirDownload(page, pedidos);
  await page.goto("/dev/entrega");
  await identificar(page);
  const [arquivo] = await Promise.all([
    page.waitForRequest("https://arquivos.test/a2"),
    page.locator('[data-baixar-arquivo="a2"]').click(),
  ]);
  expect(arquivo.url()).toBe("https://arquivos.test/a2");
  expect(pedidos[0]).toEqual({ nome: "Carla", email: "carla@grafica.com", arquivos: ["a2"] });
});

test("baixar todos: só os em uso, num ZIP com o nome da marca e do link", async ({ page }) => {
  const pedidos: Record<string, unknown>[] = [];
  await fingirDownload(page, pedidos);
  await page.goto("/dev/entrega");
  await identificar(page);
  await expect(page.locator("[data-baixar-todos]")).toHaveText("Baixar todos (2, ZIP)");
  const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-baixar-todos]").click()]);
  expect(pedidos[0].arquivos).toEqual(["a1", "a2"]);
  expect(download.suggestedFilename()).toBe("marca-um-grafica-pampa-cartazes-de-outubro.zip");
  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(zip).sort()).toEqual(["a1.svg", "a2.svg"]);
});

test("a identificação fica neste navegador: voltar à página não pede de novo", async ({ page }) => {
  await page.goto("/dev/entrega");
  await identificar(page);
  await page.reload();
  await expect(page.locator("[data-identificado]")).toContainText("Carla · carla@grafica.com");
  await expect(page.locator('[data-baixar-arquivo="a1"]')).toBeEnabled();
});

test("revogado no meio do caminho: a página passa a dizer que foi encerrado", async ({ page }) => {
  await fingirDownload(page, [], () => ({ status: 410, json: { estado: "revogado", message: "Este link foi encerrado por quem o enviou." } }));
  await page.goto("/dev/entrega");
  await identificar(page);
  await page.locator('[data-baixar-arquivo="a1"]').click();
  await expect(page.locator('[data-link-indisponivel="revogado"]')).toContainText("Este link foi encerrado.");
});

for (const [estado, frase] of [
  ["expirado", "Este link expirou."],
  ["revogado", "Este link foi encerrado."],
  ["inexistente", "Este link não existe."],
] as const) {
  test(`link ${estado}: a página diz isso, e não mostra arquivo nenhum`, async ({ page }) => {
    await page.goto(`/dev/entrega?estado=${estado}`);
    await expect(page.locator(`[data-link-indisponivel="${estado}"]`)).toContainText(frase);
    await expect(page.locator("[data-arquivo-da-entrega]")).toHaveCount(0);
  });
}
