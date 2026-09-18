import { expect, test, type Page } from "@playwright/test";

/**
 * Pessoas e acesso — o que a TELA faz.
 *
 * O que o BANCO garante está em `scripts/prova-conceder-e-revogar.sh` (35
 * casos): quem pode conceder, marca de outra conta, último administrador. Aqui
 * se prova o gesto: o que é enviado, o que aparece, e o que a tela recusa antes
 * de enviar.
 *
 * Rede fingida, como no resto da suíte.
 */
const MARCAS = [{ id: "m1", nome: "Solara" }, { id: "m2", nome: "Ferro" }];
const PESSOAS = [
  { email: "ana@agencia.test", papel: "administrador", marcas: [], pendente: false, desde: "2026-09-10T10:00:00Z" },
  { email: "bruno@agencia.test", papel: "consulta", marcas: [MARCAS[0]], pendente: false, desde: "2026-09-12T10:00:00Z" },
  { email: "grafica@fornecedor.test", papel: "consulta", marcas: [MARCAS[1]], pendente: true, desde: "2026-09-17T10:00:00Z" },
];

async function comAcesso(page: Page, enviados?: unknown[]) {
  await page.route("**/api/admin/pessoas**", async (rota) => {
    const metodo = rota.request().method();
    if (metodo === "GET") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ pessoas: PESSOAS, marcas: MARCAS }) });
    }
    enviados?.push({ metodo, corpo: rota.request().postDataJSON() });
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ resultado: metodo === "POST" ? "pendente" : "revogada" }) });
  });
}

test("a lista mostra quem administra, quem consulta e quem ainda não entrou", async ({ page }) => {
  await comAcesso(page);
  await page.goto("/dev/pessoas");

  const tabela = page.locator("[data-tabela-pessoas]");
  await expect(tabela.locator("tbody tr")).toHaveCount(3);

  // Quem está esperando vem primeiro: é a linha sobre a qual alguém age.
  await expect(tabela.locator("tbody tr").first()).toContainText("grafica@fornecedor.test");
  await expect(page.locator('[data-pessoa="grafica@fornecedor.test"] [data-pendente]')).toBeVisible();

  // Administrador não lista marcas — a lista de hoje mentiria amanhã.
  await expect(page.locator('[data-pessoa="ana@agencia.test"]')).toContainText("Todas as marcas da conta");
  await expect(page.locator('[data-pessoa="bruno@agencia.test"]')).toContainText("Solara");
});

test("conceder consulta manda e-mail, nível e as marcas escolhidas", async ({ page }) => {
  const enviados: unknown[] = [];
  await comAcesso(page, enviados);
  await page.goto("/dev/pessoas");

  await page.getByLabel("E-mail").fill("Nova@Agencia.TEST");
  await page.getByRole("checkbox", { name: "Ferro" }).check();
  await page.getByRole("button", { name: "Conceder acesso" }).click();

  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toEqual({
    metodo: "POST",
    // O e-mail sai normalizado: o banco recusa a forma com maiúsculas.
    corpo: { email: "nova@agencia.test", papel: "consulta", marcas: ["m2"] },
  });
  // E a tela diz a verdade sobre o que aconteceu: ninguém foi avisado.
  await expect(page.getByRole("status")).toContainText(/primeiro login/);
});

test("administrador não escolhe marcas, e a tela explica por quê", async ({ page }) => {
  await comAcesso(page);
  await page.goto("/dev/pessoas");

  await page.getByLabel("Nível").selectOption("administrador");
  await expect(page.locator("[data-aviso-administrador]")).toContainText(/todas as marcas da conta/i);
  await expect(page.getByRole("checkbox", { name: "Solara" })).toHaveCount(0);
});

test("consulta sem marca nenhuma nem chega a ser enviada", async ({ page }) => {
  const enviados: unknown[] = [];
  await comAcesso(page, enviados);
  await page.goto("/dev/pessoas");

  await page.getByLabel("E-mail").fill("alguem@agencia.test");
  await page.getByRole("button", { name: "Conceder acesso" }).click();

  await expect(page.getByRole("status")).toContainText(/ao menos uma marca/i);
  expect(enviados, "a tela mandou uma concessão que o banco recusaria").toEqual([]);
});

test("remover acesso avisa e manda o e-mail da pessoa", async ({ page }) => {
  const enviados: unknown[] = [];
  const avisos: string[] = [];
  await comAcesso(page, enviados);
  page.on("dialog", (d) => { avisos.push(d.message()); void d.accept(); });
  await page.goto("/dev/pessoas");

  await page.locator('[data-pessoa="bruno@agencia.test"]').getByRole("button", { name: "Remover acesso" }).click();

  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toEqual({ metodo: "DELETE", corpo: { email: "bruno@agencia.test", marca: null } });
  expect(avisos[0]).toContain("bruno@agencia.test");
});

test("dá para tirar uma marca só, sem remover a pessoa", async ({ page }) => {
  const enviados: unknown[] = [];
  await comAcesso(page, enviados);
  page.on("dialog", (d) => d.accept());
  await page.goto("/dev/pessoas");

  await page.locator('[data-pessoa="bruno@agencia.test"]').getByRole("button", { name: "Tirar Solara" }).click();

  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toEqual({ metodo: "DELETE", corpo: { email: "bruno@agencia.test", marca: "m1" } });
});
