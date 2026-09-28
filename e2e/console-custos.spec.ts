import { expect, test } from "@playwright/test";

/**
 * O painel de custos do Console da Brennimark (28/09/2026).
 *
 * `/api/console/custos` é fingido; quem pode ler — só a equipe — está provado
 * no banco (`scripts/prova-console-da-brennimark.sh`). Aqui, o caminho da
 * tela: totais, por conta e marca, por modelo, limites com alerta, a cotação
 * digitada e a verdade sobre a estimativa.
 */

const DADOS = {
  mes: "2026-09",
  ia: [
    { workspace_id: "w1", conta: "Brennimark — Ensaio", brand_id: "a", marca: "BRADESCO", provider: "google", model: "gemini-3.6-flash", currency: "USD", execucoes: 40, tokens_entrada: 600000, tokens_saida: 30000, custo_micros: 1500000, sem_uso_medido: 1, custo_incerto_micros: 1600000, recusadas: 2 },
    { workspace_id: "w1", conta: "Brennimark — Ensaio", brand_id: "b", marca: "Sony Vaio", provider: "groq", model: "qwen", currency: "USD", execucoes: 7, tokens_entrada: 40000, tokens_saida: 2000, custo_micros: 287698, sem_uso_medido: 0 },
  ],
  armazenamento: [
    { workspace_id: "w1", conta: "Brennimark — Ensaio", brand_id: "a", marca: "BRADESCO", bucket_id: "brand-assets", dia: "2026-09-28", objetos: 50, bytes: 15000000 },
  ],
  limites: [
    { workspace_id: "w1", conta: "Brennimark — Ensaio", brand_id: null, marca: null, period: "daily", limit_micros: 1000000, currency: "USD", kill_switch: false, gasto_hoje_micros: 850000 },
    { workspace_id: "w2", conta: "Outra", brand_id: null, marca: null, period: "daily", limit_micros: 1000000, currency: "USD", kill_switch: false, gasto_hoje_micros: 10000 },
  ],
};

test("o mês em números: total, por conta e marca, por modelo — e o aviso de que é estimativa", async ({ page }) => {
  const pedidos: string[] = [];
  await page.route("**/api/console/custos**", async (rota) => {
    pedidos.push(new URL(rota.request().url()).searchParams.get("mes") ?? "");
    await rota.fulfill({ json: DADOS });
  });
  await page.goto("/dev/console");

  await expect(page.locator("[data-aviso-de-estimativa]")).toContainText("preço de tabela");
  await expect(page.locator("[data-total-custo]")).toHaveText("US$ 1,79");
  await expect(page.locator("[data-total-execucoes]")).toHaveText("47");
  await expect(page.locator("[data-total-armazenamento]")).toHaveText("14,3 MB");
  await expect(page.locator("[data-aviso-sem-uso]")).toContainText("1 execução liquidada sem tokens informados pelo provedor: somam US$ 1,60");
  await expect(page.locator("[data-custo-medido-e-incerto]")).toHaveText("US$ 0,19 medido + até US$ 1,60 incerto");
  await expect(page.locator("[data-recusadas]")).toContainText("2 pedidos recusados pelo provedor sem processar");

  const contas = page.locator("[data-tabela-contas]");
  await expect(contas.locator('[data-conta="w1"]')).toContainText("Brennimark — Ensaio");
  await expect(contas.locator("[data-marca-da-conta]").first()).toContainText("BRADESCO");
  await expect(page.locator("[data-tabela-modelos]")).toContainText("google · gemini-3.6-flash");

  // A cotação digitada mostra reais; o produto não inventa câmbio.
  await page.getByLabel("Cotação do dólar (opcional)").fill("5,40");
  await expect(page.getByText("≈ R$ 9,65").first()).toBeVisible();

  // Trocar o mês pede o mês novo.
  await page.getByLabel("Mês", { exact: true }).fill("2026-08");
  await expect.poll(() => pedidos.at(-1)).toBe("2026-08");
});

test("a conta perto do limite de hoje aparece em alerta", async ({ page }) => {
  await page.route("**/api/console/custos**", (rota) => rota.fulfill({ json: DADOS }));
  await page.goto("/dev/console");
  await expect(page.locator("[data-alerta-de-limite]")).toHaveText("1 conta pede atenção: Brennimark — Ensaio.");
  await expect(page.locator('[data-limite="alerta"]')).toContainText("85%");
  await expect(page.locator('[data-limite="ok"]')).toContainText("Outra");
});

test("quem não é da equipe: a rota responde 404 e o painel não mostra número nenhum", async ({ page }) => {
  await page.route("**/api/console/custos**", (rota) => rota.fulfill({ status: 404, json: { error: "nao_encontrado" } }));
  await page.goto("/dev/console");
  await expect(page.locator("[data-painel-de-custos]").getByRole("alert")).toHaveText("Não foi possível ler os custos.");
  await expect(page.locator("[data-total-custo]")).toHaveCount(0);
});
