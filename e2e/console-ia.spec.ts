import { expect, test, type Page } from "@playwright/test";

/**
 * A IA da plataforma no Console (etapa 2 — 29/09/2026).
 *
 * `/api/console/ia` é fingido; quem pode mudar, e que toda mudança fica no
 * registro com motivo, está provado no banco (`scripts/prova-ia-da-plataforma.sh`).
 * Aqui, o caminho da tela: chaves só por presença, rotas por tarefa, limites
 * com motivo, e a recusa do servidor dita como foi.
 */

const DADOS = {
  rotas: [
    { tarefa: "chat", ordem: 1, provider: "google", model: "gemini-3.6-flash" },
    { tarefa: "chat", ordem: 2, provider: "groq", model: "qwen/qwen3.8-27b" },
    { tarefa: "analysis", ordem: 1, provider: "google", model: "gemini-3.6-flash" },
  ],
  parametros: { espera_chat_ms: 20000, espera_analysis_ms: 30000, limite_diario_padrao_micros: 5000000, limite_mensal_padrao_micros: 60000000 },
  limites: [
    { workspace_id: "w1", conta: "Brennimark — Ensaio", brand_id: null, marca: null, period: "daily", limit_micros: 5000000, currency: "USD", kill_switch: false, gasto_hoje_micros: 440000 },
    { workspace_id: "w1", conta: "Brennimark — Ensaio", brand_id: null, marca: null, period: "monthly", limit_micros: 60000000, currency: "USD", kill_switch: false, gasto_hoje_micros: 1790000 },
  ],
  registro: [
    { quando: "2026-09-29T12:00:00Z", quem: "André Coelho", acao: "definir limites padrão", alvo: "contas novas", antes: { diario: 1000000 }, depois: { diario: 5000000 }, motivo: "piloto com agências" },
  ],
  oferta: {
    chat: [
      { provider: "google", model: "gemini-3.6-flash", label: "Gemini 3.6 Flash" },
      { provider: "groq", model: "qwen/qwen3.8-27b", label: "Qwen 3.8 27B" },
    ],
    analysis: [{ provider: "google", model: "gemini-3.6-flash", label: "Gemini 3.6 Flash" }],
  },
  chaves: [
    { provider: "google", variavel: "BRENNIMARK_CHAVE_GOOGLE", presente: true },
    { provider: "groq", variavel: "BRENNIMARK_CHAVE_GROQ", presente: false },
    { provider: "anthropic", variavel: "BRENNIMARK_CHAVE_ANTHROPIC", presente: false },
  ],
};

async function fingir(page: Page, enviados: unknown[], resposta: { status: number; json: unknown } = { status: 200, json: { ok: true } }) {
  await page.route("**/api/console/ia", async (rota) => {
    if (rota.request().method() === "POST") {
      enviados.push(rota.request().postDataJSON());
      return rota.fulfill(resposta);
    }
    return rota.fulfill({ json: DADOS });
  });
}

test("as chaves aparecem só por presença, e a que falta numa rota é apontada", async ({ page }) => {
  await fingir(page, []);
  await page.goto("/dev/console-ia");
  await expect(page.locator('[data-chave="google"]')).toHaveAttribute("data-presente", "sim");
  await expect(page.locator('[data-chave="groq"]')).toContainText("ausente");
  await expect(page.locator('[data-chave="groq"]')).toContainText("BRENNIMARK_CHAVE_GROQ");
  // O groq está numa rota e sem chave: aviso. A anthropic não está: sem aviso.
  await expect(page.locator("[data-chave-faltando]")).toHaveText("Falta a chave de groq, usado nas rotas: o Vini não consegue usar esse provedor.");
});

test("trocar a ordem das rotas manda a lista, a espera e o motivo", async ({ page }) => {
  const enviados: Record<string, unknown>[] = [];
  await fingir(page, enviados);
  await page.goto("/dev/console-ia");
  const form = page.locator('[data-rotas="chat"]');
  await expect(form.getByLabel("Principal")).toHaveValue("google|gemini-3.6-flash");
  await form.getByLabel("Principal").selectOption("groq|qwen/qwen3.8-27b");
  await form.getByLabel("Reserva 1").selectOption("google|gemini-3.6-flash");
  await form.getByLabel("Espera pelo 1º trecho (s)").fill("15");
  await form.getByLabel("Motivo da mudança").fill("Gemini em pico de demanda");
  await form.getByRole("button", { name: "Guardar rotas" }).click();

  await expect(form.getByRole("status")).toHaveText("Guardado. O registro tem a mudança.");
  expect(enviados.at(-1)).toEqual({
    acao: "rotas", tarefa: "chat",
    rotas: [{ provider: "groq", model: "qwen/qwen3.8-27b" }, { provider: "google", model: "gemini-3.6-flash" }],
    esperaMs: 15000, motivo: "Gemini em pico de demanda",
  });
});

test("o limite de uma conta muda com motivo; a recusa do servidor aparece como foi dita", async ({ page }) => {
  const enviados: Record<string, unknown>[] = [];
  await fingir(page, enviados, { status: 400, json: { message: "Escreva o motivo da mudança (de 3 a 500 caracteres): ele fica no registro." } });
  await page.goto("/dev/console-ia");
  const linha = page.locator('[data-limite-da-conta="w1-monthly"]');
  await expect(linha).toContainText("US$ 1,79 de US$ 60,00 · 3%");
  await linha.getByLabel("Novo limite de Brennimark — Ensaio por mês").fill("80");
  await linha.getByRole("button", { name: "Guardar" }).click();
  await expect(linha.getByRole("status")).toHaveText("Escreva o motivo da mudança (de 3 a 500 caracteres): ele fica no registro.");
  expect(enviados.at(-1)).toEqual({ acao: "limite", workspaceId: "w1", periodo: "monthly", valor: "80", motivo: "" });
});

test("o registro da equipe mostra quem, o antes, o depois e o motivo", async ({ page }) => {
  await fingir(page, []);
  await page.goto("/dev/console-ia");
  const registro = page.locator("[data-tabela-registro-da-equipe]");
  await expect(registro).toContainText("André Coelho");
  await expect(registro).toContainText("definir limites padrão · contas novas");
  await expect(registro).toContainText('{"diario":1000000} → {"diario":5000000}');
  await expect(registro).toContainText("piloto com agências");
});
