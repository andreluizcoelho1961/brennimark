import { expect, test, type Page } from "@playwright/test";

/**
 * A janela do Vini — fatia 4a.
 *
 * O que o ensaio de 18/09 pediu: a conversa acontece DENTRO da janela, a
 * resposta chega formatada (e não com `###` e `**` crus), e a citação leva o
 * PDF à página sem fechar a conversa.
 *
 * Rede fingida, como no resto da suíte. A marca "festival" chama o rascunho de
 * "Under review" — a citação precisa ser reconhecida no vocabulário DELA.
 */
const MARCA = "/dev/marcas?marca=festival";

const RESPOSTA = [
  "The guide doesn't name a single primary color, but it defines two:",
  "",
  "### Provisional rules",
  "",
  "* **Principle colours:** black and support colour [Fonte: Cores — UNDER REVIEW · /docs/cores]",
  "* **Logo:** white on black [Fonte: Logo — UNDER REVIEW · /docs/logo]",
  "",
  "*Interpretation: \"principle colours\" is the manual's term.*",
].join("\n");

async function comResposta(page: Page, corpo = RESPOSTA, enviados?: unknown[]) {
  await page.route("**/api/ai/chat**", async (rota) => {
    enviados?.push(rota.request().postDataJSON());
    await rota.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      // Só "/docs/cores" tem página: o trecho do logo veio sem ela.
      headers: { "X-Brennimark-Paginas": encodeURIComponent(JSON.stringify({ "/docs/cores": 12 })) },
      body: corpo,
    });
  });
}

async function perguntar(page: Page, texto: string) {
  await page.locator("[data-botao-do-vini]").click();
  const campo = page.getByRole("textbox", { name: "Pergunta para o Vini" });
  await campo.fill(texto);
  await campo.press("Enter");
}

test("a pergunta sai da janela e a resposta volta formatada, dentro dela", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comResposta(page, RESPOSTA, enviados);
  await page.goto(MARCA);
  const url = page.url();

  await perguntar(page, "what is the primary color?");

  const resposta = page.locator("[data-vini-janela] [data-resposta-do-vini]");
  await expect(resposta).toBeVisible();
  // Nada de navegar: a conversa acontece aqui.
  expect(page.url()).toBe(url);
  expect(enviados[0]).toEqual({ messages: [{ role: "user", content: "what is the primary color?" }] });

  // Formatado: título, negrito, itálico e lista — sem os símbolos crus.
  await expect(resposta.getByRole("heading", { name: "Provisional rules" })).toBeVisible();
  await expect(resposta.locator("strong", { hasText: "Principle colours:" })).toBeVisible();
  await expect(resposta.locator("em")).toContainText("principle colours");
  await expect(resposta.locator("li")).toHaveCount(2);
  await expect(resposta).not.toContainText("###");
  await expect(resposta).not.toContainText("**");
});

test("a citação leva ao manual NA PÁGINA — e a página vem do servidor, não do texto", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comResposta(page);
  await page.goto(MARCA);
  await perguntar(page, "cores?");

  const citacoes = page.locator("[data-vini-janela] [data-citacao]");
  await expect(citacoes).toHaveCount(2);

  // Com página conhecida: o manual, naquela página, e a página à vista.
  const cores = citacoes.filter({ hasText: "Cores" });
  await expect(cores).toHaveAttribute("href", /\/dev\/marcas\/original\?pagina=12&ir=/);
  await expect(cores).toContainText("p. 12");
  // O selo fala o vocabulário da marca.
  await expect(cores).toContainText("UNDER REVIEW");

  // Sem página conhecida: o manual, sem página inventada.
  const logo = citacoes.filter({ hasText: "Logo" });
  await expect(logo).toHaveAttribute("href", "/dev/marcas/original");
  await expect(logo).not.toContainText("p.");
});

test("clicar fora não fecha: a pessoa lê a resposta e confere no manual", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comResposta(page);
  await page.goto(MARCA);
  await perguntar(page, "cores?");
  await expect(page.locator("[data-resposta-do-vini]")).toBeVisible();

  await page.mouse.click(400, 400);
  await expect(page.locator("[data-vini-janela]")).toBeVisible();

  // Recolher e abrir de novo não perde a conversa.
  await page.locator("[data-botao-do-vini]").click();
  await expect(page.locator("[data-vini-janela]")).toHaveCount(0);
  await page.locator("[data-botao-do-vini]").click();
  await expect(page.locator("[data-resposta-do-vini]")).toBeVisible();
});

test("Shift+Enter quebra a linha; Enter envia", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comResposta(page, RESPOSTA, enviados);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();

  const campo = page.getByRole("textbox", { name: "Pergunta para o Vini" });
  await campo.type("linha um");
  await campo.press("Shift+Enter");
  await campo.type("linha dois");
  expect(enviados).toEqual([]);
  await campo.press("Enter");

  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toEqual({ messages: [{ role: "user", content: "linha um\nlinha dois" }] });
});

test("a recusa do servidor aparece como ele a escreveu, com como tentar de novo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/ai/chat**", (rota) => rota.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ message: "A IA desta conta ainda não está configurada." }),
  }));
  await page.goto(MARCA);
  await perguntar(page, "cores?");

  const erro = page.locator("[data-vini-erro]");
  await expect(erro).toContainText("ainda não está configurada");
  await expect(erro.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
});

test("no celular a janela cabe na tela", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await comResposta(page);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();

  const caixa = await page.locator("[data-vini-janela]").boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa!.x).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(375);
});

test("resposta que o provedor interrompeu aparece como incompleta, nunca como inteira", async ({ page }) => {
  // O caso do ensaio de 19/09: o Vini parou em "(such as the Sony" e a janela
  // mostrou o pedaço como resposta. O servidor acrescenta a marca de fim
  // (`lib/ai/fim-da-resposta.ts`) quando o motivo não é "terminou".
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comResposta(page, "A decision needs to be made (such as the Sony⁣[[brennimark:incompleta:content-filter]]", enviados);
  await page.goto(MARCA);
  await perguntar(page, "what is the primary logo?");

  const resposta = page.locator("[data-vini-janela] [data-incompleta]");
  await expect(resposta).toContainText("(such as the Sony");
  await expect(resposta).toContainText("Resposta incompleta");
  // A marca é do sistema: não aparece para a pessoa.
  await expect(page.locator("[data-vini-janela]")).not.toContainText("brennimark:incompleta");

  const aviso = page.locator("[data-vini-aviso]");
  await expect(aviso).toContainText("parou antes de terminar");
  await expect(aviso).toContainText("filtro de conteúdo");

  // Tentar de novo refaz a PERGUNTA, sem o pedaço interrompido.
  await aviso.getByRole("button", { name: "Tentar de novo" }).click();
  await expect.poll(() => enviados.length).toBe(2);
  expect(enviados[1]).toEqual({ messages: [{ role: "user", content: "what is the primary logo?" }] });
});

test("resposta inteira não ganha aviso nenhum", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comResposta(page);
  await page.goto(MARCA);
  await perguntar(page, "cores?");
  await expect(page.locator("[data-resposta-do-vini]")).toBeVisible();
  await expect(page.locator("[data-incompleta]")).toHaveCount(0);
  await expect(page.locator("[data-vini-aviso]")).toHaveCount(0);
});
