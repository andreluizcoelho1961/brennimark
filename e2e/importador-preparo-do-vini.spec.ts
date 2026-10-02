import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * As imagens de leitura do Vini no FIM da importação (02/10/2026).
 *
 * Antes, quem importava precisava descobrir um botão no visualizador
 * ("Preparar o manual para o Vini"). Agora a importação desenha uma imagem de
 * cada página, envia ao Storage e a registra, logo depois de a marca nascer.
 *
 * A rede é fingida, como em `importador-payload.spec.ts`: Storage, as RPCs e o
 * registro do documento-fonte. O desenho das páginas é real (PDF.js no
 * navegador). O que se prova: uma imagem por página, no caminho
 * determinístico, registrada uma a uma; e que "Pular" interrompe e segue.
 */
const FIXTURE = path.join(process.cwd(), "e2e/fixtures/manual-de-teste.pdf");

async function fingirRede(page: Page, atrasoPorImagemMs = 0) {
  const imagens: string[] = [];
  const registros: number[] = [];
  await page.route("**/storage/v1/object/**", async (rota) => {
    const url = rota.request().url();
    if (url.includes("/brand-assets/")) {
      imagens.push(decodeURIComponent(url.split("/brand-assets/")[1]));
      if (atrasoPorImagemMs) await new Promise((r) => setTimeout(r, atrasoPorImagemMs));
    }
    return rota.fulfill({ status: 200, contentType: "application/json", body: '{"Key":"ok"}' });
  });
  await page.route("**/rest/v1/rpc/publish_brand_import", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: '"00000000-0000-4000-8000-000000000001"' }));
  await page.route("**/api/documento-fonte/registrar", (rota) =>
    rota.fulfill({ json: { documentoId: "doc-da-prova", paginas: 0, paginasSemSecao: 0, jaEstava: false } }));
  await page.route("**/rest/v1/rpc/registrar_imagem_de_leitura", (rota) => {
    registros.push(JSON.parse(rota.request().postData() ?? "{}").p_pagina);
    return rota.fulfill({ status: 200, contentType: "application/json", body: "null" });
  });
  // O destino depois da importação: qualquer resposta serve, só a navegação importa.
  await page.route("**/w/*/b/*/docs", (rota) => rota.fulfill({ contentType: "text/html", body: "<h1>Manual</h1>" }));
  return { imagens, registros };
}

async function importar(page: Page) {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();
  await page.getByRole("button", { name: /Criar a marca/ }).click();
}

test("depois de criar a marca, cada página ganha a imagem de leitura, e então o manual abre", async ({ page }) => {
  test.setTimeout(90_000);
  const rede = await fingirRede(page);
  await importar(page);
  await expect(page).toHaveURL(/\/b\/[^/]+\/docs$/, { timeout: 60_000 });

  const paginas = [...new Set(rede.registros)].sort((a, b) => a - b);
  expect(paginas.length).toBeGreaterThan(0);
  expect(paginas).toEqual(Array.from({ length: paginas.length }, (_, i) => i + 1));
  // O caminho é o determinístico: conta/marca/pagina-<documento>-<n>.jpg.
  for (const n of paginas) {
    expect(rede.imagens.some((c) => /\/pagina-doc-da-prova-\d+\.jpg$/.test(c) && c.endsWith(`-${n}.jpg`))).toBe(true);
  }
});

test("enquanto prepara, a tela diz o que faz; Pular interrompe e abre o manual", async ({ page }) => {
  test.setTimeout(90_000);
  const rede = await fingirRede(page, 1500);
  await importar(page);
  const aviso = page.locator("[data-preparo-do-vini]");
  await expect(aviso).toContainText("A marca já foi criada", { timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Preparando o manual para o Vini: página/ })).toBeVisible();
  await aviso.locator("[data-pular-preparo]").click();
  await expect(page).toHaveURL(/\/b\/[^/]+\/docs$/, { timeout: 30_000 });
  // Pulou antes do fim: nem todas as páginas foram registradas.
  expect(rede.registros.length).toBeLessThan(3);
});

test("com a aba oculta, o preparo termina — o desenho não espera quadro", async ({ page }) => {
  test.setTimeout(90_000);
  // O que a aba oculta faz: quadro pedido nunca roda (ver importador-aba-oculta.spec.ts).
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", { get: () => "hidden" });
    Object.defineProperty(document, "hidden", { get: () => true });
    let id = 0;
    window.requestAnimationFrame = () => ++id;
    window.cancelAnimationFrame = () => {};
  });
  const rede = await fingirRede(page);
  await importar(page);
  await expect(page).toHaveURL(/\/b\/[^/]+\/docs$/, { timeout: 60_000 });
  expect(rede.registros.length).toBeGreaterThan(0);
});
