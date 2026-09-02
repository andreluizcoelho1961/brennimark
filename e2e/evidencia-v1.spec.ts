import { test } from "@playwright/test";
import { mkdirSync } from "node:fs";

/**
 * Evidência visual do V1 — desktop e mobile.
 *
 * Não é teste: não afirma nada. Ele produz as imagens que a revisão pediu, e
 * roda só quando `EVIDENCIA_V1` está definida, porque gerar arquivo binário a
 * cada `npm run verify` encheria o repositório de ruído.
 *
 *   EVIDENCIA_V1=1 npx playwright test evidencia-v1 --project=chromium
 */
const LIGADO = process.env.EVIDENCIA_V1 === "1";
test.skip(!LIGADO, "defina EVIDENCIA_V1=1 para gerar as imagens");

const DESTINO = "docs/evidencias/v1";
const MARCAS = ["sobria", "institucional", "mercado", "festival"] as const;
const TELAS = [
  { nome: "desktop", largura: 1440, altura: 900 },
  { nome: "mobile", largura: 390, altura: 844 },
] as const;

test.beforeAll(() => mkdirSync(DESTINO, { recursive: true }));

for (const marca of MARCAS) {
  for (const tela of TELAS) {
    test(`marca ${marca} em ${tela.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: tela.largura, height: tela.altura });
      await page.goto(`/dev/marcas?marca=${marca}`);
      await page.locator("[data-shell-ready]").waitFor();
      await page.screenshot({ path: `${DESTINO}/marca-${marca}-${tela.nome}.png`, fullPage: true });
    });
  }
}

/** As superfícies sem marca aberta: é onde a moldura precisa parecer o produto. */
const SEM_MARCA = [
  ["login", "/login"],
  ["resolvedor", "/docs"],
  ["nao-encontrado", "/w/conta/b/marca/docs/inexistente"],
  ["falha", "/w/conta/b/marca/docs/dev-falha"],
] as const;

for (const [nome, rota] of SEM_MARCA) {
  for (const tela of TELAS) {
    test(`${nome} em ${tela.nome}`, async ({ page }) => {
      await page.setViewportSize({ width: tela.largura, height: tela.altura });
      await page.goto(rota);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: `${DESTINO}/${nome}-${tela.nome}.png`, fullPage: true });
    });
  }
}
