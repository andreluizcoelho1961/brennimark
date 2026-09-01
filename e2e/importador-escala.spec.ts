import { expect, test } from "@playwright/test";
import path from "node:path";

const fixture = (nome: string) => path.join(process.cwd(), "e2e/fixtures", nome);

/**
 * Manuais grandes, nos três motores.
 *
 * Um manual de marca de verdade tem centenas de páginas — o do André tem 743.
 * Se o produto só aguenta o PDF de três páginas do teste, ele não serve para o
 * caso que existe.
 *
 * As fixtures grandes são geradas por `npm run fixtures:pdf` e ficam fora do
 * git: 1.000 páginas de texto não se versionam, e o gerador as reconstrói
 * idênticas.
 */

test("mil páginas chegam à prévia sem derrubar o navegador", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', fixture("mil-paginas.pdf"));

  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible({
    timeout: 150_000,
  });
  await expect(page.getByText(/1000 páginas no PDF/)).toBeVisible();

  // O teto de seções é respeitado sem recusar o manual.
  const total = await page.getByText(/Mostrando \d+ de (\d+)/).textContent();
  const secoes = Number(total?.match(/de (\d+)/)?.[1] ?? 0);
  expect(secoes).toBeGreaterThan(0);
  expect(secoes).toBeLessThanOrEqual(500);
});

test("mil páginas não renderizam mil linhas", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', fixture("mil-paginas.pdf"));
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible({
    timeout: 150_000,
  });

  // A lista é paginada: 40 no DOM, independentemente do tamanho do manual.
  await expect(page.getByRole("listitem")).toHaveCount(40);
  await expect(page.getByRole("button", { name: /Carregar mais/ })).toBeVisible();

  await page.getByRole("button", { name: /Carregar mais/ }).click();
  await expect(page.getByRole("listitem")).toHaveCount(80);
});

test("a busca alcança o fim de um manual de mil páginas", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', fixture("mil-paginas.pdf"));
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible({
    timeout: 150_000,
  });

  // A página 998 nunca esteve na tela.
  await page.getByPlaceholder(/Buscar por título/).fill("Corpo da pagina 998");
  await expect(page.getByText(/Mostrando 1 de 1/)).toBeVisible();
});

test("mil e uma páginas são recusadas com mensagem própria", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', fixture("mil-e-uma-paginas.pdf"));

  await expect(page.getByText(/mais páginas do que o limite/i)).toBeVisible({
    timeout: 150_000,
  });
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toHaveCount(0);
});

test("arquivo acima do limite de tamanho é recusado antes de qualquer leitura", async ({ page }) => {
  // O limite real é 100 MiB. Carregar isso num navegador de teste custaria
  // minutos e não exercitaria nada além do que este limite reduzido exercita:
  // a comparação acontece antes de o arquivo ser lido.
  await page.goto("/dev/importar?maxBytes=100");
  await page.setInputFiles('input[type="file"]', fixture("manual-de-teste.pdf"));

  await expect(page.getByText(/limite de tamanho/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toHaveCount(0);
});

test("um byte abaixo do limite é aceito", async ({ page }) => {
  // A fronteira exata: o mesmo arquivo, com o limite um byte acima do tamanho
  // dele. Um erro de `>` para `>=` recusaria arquivos válidos no limite.
  const { size } = await import("node:fs").then((fs) =>
    fs.statSync(fixture("manual-de-teste.pdf")),
  );
  await page.goto(`/dev/importar?maxBytes=${size}`);
  await page.setInputFiles('input[type="file"]', fixture("manual-de-teste.pdf"));

  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();
});
