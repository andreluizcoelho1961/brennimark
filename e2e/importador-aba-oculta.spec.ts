import { expect, test } from "@playwright/test";
import path from "node:path";

/**
 * A publicação termina com a aba oculta.
 *
 * No aceite do Marco B (10/09) a publicação levou ~23 minutos porque a aba
 * ficou oculta: o pdf.js esperava `requestAnimationFrame` para cada fatia do
 * desenho, e aba oculta não tem quadro. Ver `desenharSemEsperarQuadro` em
 * `src/lib/import/pdf.ts`.
 *
 * Um navegador automatizado não esconde a própria aba, então o teste
 * reproduz o que a aba oculta FAZ: a página se declara oculta e
 * `requestAnimationFrame` aceita o pedido e nunca o executa. Com o defeito de
 * volta, o desenho para na primeira página visual e a RPC nunca chega.
 *
 * A rede é fingida como em `importador-payload.spec.ts`: o caminho exercitado
 * é o de produção, do clique à RPC, e o teste não depende de banco.
 *
 * `manual-visual.pdf` é a fixture que tem páginas visual-dominantes — é o que
 * põe o desenho de página no caminho da publicação.
 */
const FIXTURE = path.join(process.cwd(), "e2e/fixtures/manual-visual.pdf");

test("com a aba oculta, as páginas visuais são desenhadas e a publicação chega à RPC", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "visibilityState", { get: () => "hidden" });
    Object.defineProperty(document, "hidden", { get: () => true });
    let id = 0;
    window.requestAnimationFrame = () => ++id;
    window.cancelAnimationFrame = () => {};
  });

  const imagens: string[] = [];
  const rpc: string[] = [];

  await page.route("**/storage/v1/object/**", (rota) => {
    const url = rota.request().url();
    if (url.includes("/brand-assets/")) imagens.push(url);
    return rota.fulfill({ status: 200, contentType: "application/json", body: '{"Key":"ok"}' });
  });
  await page.route("**/rest/v1/rpc/publish_brand_import", (rota) => {
    rpc.push(rota.request().postData() ?? "");
    return rota.fulfill({
      status: 200,
      contentType: "application/json",
      body: '"00000000-0000-4000-8000-000000000001"',
    });
  });

  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', FIXTURE);
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();

  // A premissa do teste: quadro pedido nunca roda. Sem ela, o teste passaria
  // por não ter simulado nada.
  const quadroRodou = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        let rodou = false;
        requestAnimationFrame(() => (rodou = true));
        setTimeout(() => resolve(rodou), 300);
      }),
  );
  expect(quadroRodou, "requestAnimationFrame rodou — a aba oculta não foi simulada").toBe(false);

  await page.getByRole("button", { name: /Criar a marca/ }).click();

  // Segundos, e não minutos: é a diferença que o defeito fazia.
  await expect.poll(() => rpc.length, { timeout: 20_000 }).toBeGreaterThan(0);
  expect(imagens.length, "nenhuma página visual foi desenhada e enviada").toBeGreaterThan(0);
});
