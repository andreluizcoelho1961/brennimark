import { expect, test } from "@playwright/test";

/**
 * Substituir não apaga — item 10 do ADR-0007 §2.4.
 *
 * Até 13/09/2026 o botão da biblioteca era "Remover" e apagava de verdade: a
 * linha saía e o arquivo ia para a fila de exclusão. Isso contradizia o
 * CLAUDE.md ("nunca apagar asset em silêncio") num produto que vende
 * governança de marca.
 *
 * A rede é fingida, como em `importador-payload.spec.ts`: o teste não depende
 * de banco e exercita o caminho de produção do componente, do clique à
 * requisição.
 */
const EM_USO = {
  id: "asset-novo", label: "Logo v2", description: "", category: "Logotipos",
  file_name: "logo-v2.svg", mime_type: "image/svg+xml", size_bytes: 2048,
  status: "ready", created_at: "2026-09-13T10:00:00Z", downloadUrl: "https://exemplo.test/v2",
  descontinuadoEm: null, substituidoPor: null,
};
const FORA_DE_USO = {
  ...EM_USO,
  id: "asset-velho", label: "Logo v1", file_name: "logo-v1.svg",
  downloadUrl: "https://exemplo.test/v1",
  descontinuadoEm: "2026-09-13T11:00:00Z", substituidoPor: "asset-novo",
};

async function comAcervo(page: import("@playwright/test").Page, assets: unknown[]) {
  await page.route("**/api/assets**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ assets }) }),
  );
}

test("o descontinuado continua visível, identificado e baixável", async ({ page }) => {
  await comAcervo(page, [EM_USO, FORA_DE_USO]);
  await page.goto("/dev/biblioteca");

  // Duas listas, não uma grade misturada: o acervo e o histórico.
  await expect(page.getByRole("heading", { name: "Descontinuados" })).toBeVisible();

  const velho = page.locator('[data-asset-descontinuado="sim"]');
  await expect(velho).toHaveCount(1);
  // A identificação que o item 10 exige: diz que saiu, e diz por qual.
  await expect(velho).toContainText(/Descontinuado — substituído por “Logo v2”/);
  // Quem tem material antigo precisa poder conferir o que era.
  await expect(velho.getByRole("link", { name: "Baixar" })).toBeVisible();
});

test("o card em uso oferece descontinuar, e não apagar", async ({ page }) => {
  await comAcervo(page, [EM_USO, FORA_DE_USO]);
  await page.goto("/dev/biblioteca");

  const emUso = page.locator("article").filter({ hasText: "Logo v2" }).first();
  await expect(emUso.getByRole("button", { name: "Descontinuar" })).toBeVisible();
  // O caminho sem volta não pode estar a um clique do card em uso.
  await expect(emUso.getByRole("button", { name: /apagar em definitivo/i })).toHaveCount(0);
});

test("descontinuar chama a rota sem pedir apagamento definitivo", async ({ page }) => {
  await comAcervo(page, [EM_USO]);
  const chamadas: string[] = [];
  await page.route("**/api/admin/assets**", (rota) => {
    chamadas.push(`${rota.request().method()} ${rota.request().url()}`);
    return rota.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  page.on("dialog", (d) => d.accept());

  await page.goto("/dev/biblioteca");
  await page.getByRole("button", { name: "Descontinuar" }).click();

  await expect.poll(() => chamadas.length).toBeGreaterThan(0);
  expect(chamadas[0]).toContain("DELETE");
  expect(chamadas[0], "descontinuar não pode pedir apagamento definitivo").not.toContain("definitivo=1");
});

test("apagar em definitivo só existe no que já saiu de uso, e diz que não há volta", async ({ page }) => {
  await comAcervo(page, [FORA_DE_USO]);
  const chamadas: string[] = [];
  const avisos: string[] = [];
  await page.route("**/api/admin/assets**", (rota) => {
    chamadas.push(rota.request().url());
    return rota.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
  });
  page.on("dialog", (d) => { avisos.push(d.message()); void d.accept(); });

  await page.goto("/dev/biblioteca");
  await page.getByRole("button", { name: /apagar em definitivo/i }).click();

  await expect.poll(() => chamadas.length).toBeGreaterThan(0);
  expect(chamadas[0]).toContain("definitivo=1");
  expect(avisos[0], "o aviso precisa dizer que não há como desfazer").toMatch(/não há como desfazer/i);
});

test("quem só consulta não vê nenhum dos dois botões", async ({ page }) => {
  await comAcervo(page, [EM_USO, FORA_DE_USO]);
  await page.goto("/dev/biblioteca?gerencia=0");

  await expect(page.getByRole("button", { name: "Descontinuar" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /apagar em definitivo/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /voltar ao uso/i })).toHaveCount(0);
  // Mas continua vendo e baixando as duas.
  await expect(page.getByRole("link", { name: "Baixar" })).toHaveCount(2);
});
