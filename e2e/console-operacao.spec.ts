import { expect, test, type Page } from "@playwright/test";

/**
 * A operação do Console (etapa 3 — 30/09/2026).
 *
 * `/api/console/operacao` é fingido; quem pode pausar, e que cada trava para
 * só o que diz parar, está provado no banco (`scripts/prova-operacao-do-console.sh`).
 * Aqui, o caminho da tela: a trava geral pede confirmação, toda ação leva
 * motivo, a ficha mostra a conta sem conversa nenhuma, e a recusa do servidor
 * aparece como foi dita.
 */

const W1 = "3f2b9c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const MARCA = "7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d";

const PAINEL = (plataformaPausada = false) => ({
  plataformaPausada,
  contas: [{ workspace_id: W1, conta: "Brennimark — Ensaio", slug: "brennimark-ensaio", marcas: 1, pausada: false, gasto_mes_micros: 1_790_000 }],
});

const FICHA = {
  conta: { id: W1, nome: "Brennimark — Ensaio", slug: "brennimark-ensaio", criada_em: "2026-09-18T12:00:00Z" },
  plataforma_pausada: false,
  pausada: false,
  pessoas: 3,
  limites: { daily: 5_000_000, monthly: 60_000_000 },
  uso: { hoje_micros: 19_000, mes_micros: 1_790_000, pedidos_hoje: 1, pedidos_mes: 48 },
  marcas: [{ id: MARCA, nome: "Bradesco", chave: "bradesco", pausada: false, pedidos_mes: 30 }],
};

async function fingir(page: Page, enviados: unknown[], opcoes: { pausada?: boolean; resposta?: { status: number; json: unknown } } = {}) {
  await page.route("**/api/console/operacao**", async (rota) => {
    const pedido = rota.request();
    if (pedido.method() === "POST") {
      enviados.push(pedido.postDataJSON());
      return rota.fulfill(opcoes.resposta ?? { status: 200, json: { ok: true } });
    }
    const url = new URL(pedido.url());
    return rota.fulfill({ json: url.searchParams.has("conta") ? FICHA : PAINEL(opcoes.pausada) });
  });
}

test("a trava geral pede um segundo clique antes de parar todas as contas", async ({ page }) => {
  const enviados: Record<string, unknown>[] = [];
  await fingir(page, enviados);
  await page.goto("/dev/console-operacao");

  const trava = page.locator('[aria-label="Trava geral"]');
  await expect(trava).toHaveAttribute("data-trava-geral", "desligada");
  await trava.getByLabel("Motivo").fill("chave do Google vazada");
  await trava.getByRole("button", { name: "Pausar o Vini em todas as contas" }).click();

  // Primeiro clique: só pergunta.
  await expect(trava.getByRole("alert")).toHaveText("Isto para o Vini para TODOS os clientes, agora. Confirma?");
  expect(enviados).toEqual([]);

  await trava.getByRole("button", { name: "Confirmar" }).click();
  await expect(trava.getByRole("status")).toHaveText("Feito. O registro da equipe tem a mudança.");
  expect(enviados).toEqual([{ alvo: "plataforma", pausado: true, motivo: "chave do Google vazada" }]);
});

test("cancelar a confirmação não envia nada", async ({ page }) => {
  const enviados: unknown[] = [];
  await fingir(page, enviados);
  await page.goto("/dev/console-operacao");
  const trava = page.locator('[aria-label="Trava geral"]');
  await trava.getByLabel("Motivo").fill("teste");
  await trava.getByRole("button", { name: "Pausar o Vini em todas as contas" }).click();
  await trava.getByRole("button", { name: "Cancelar" }).click();
  await expect(trava.getByRole("button", { name: "Pausar o Vini em todas as contas" })).toBeVisible();
  expect(enviados).toEqual([]);
});

test("com a trava ligada, a tela diz o que o cliente lê, e retomar não pede confirmação", async ({ page }) => {
  const enviados: Record<string, unknown>[] = [];
  await fingir(page, enviados, { pausada: true });
  await page.goto("/dev/console-operacao");
  const trava = page.locator('[aria-label="Trava geral"]');
  await expect(trava).toHaveAttribute("data-trava-geral", "ligada");
  await expect(trava.getByRole("alert")).toContainText("O Vini está em manutenção no momento. Volta em breve.");
  await trava.getByLabel("Motivo").fill("chave trocada");
  await trava.getByRole("button", { name: "Retomar o Vini em todas as contas" }).click();
  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toEqual({ alvo: "plataforma", pausado: false, motivo: "chave trocada" });
});

test("a ficha mostra a conta e pausa uma marca com motivo", async ({ page }) => {
  const enviados: Record<string, unknown>[] = [];
  await fingir(page, enviados);
  await page.goto("/dev/console-operacao");
  await page.locator('[data-conta="brennimark-ensaio"]').getByRole("button", { name: "Abrir a ficha" }).click();

  const ficha = page.locator('[data-ficha-da-conta="brennimark-ensaio"]');
  await expect(ficha.locator("[data-ficha-pessoas]")).toHaveText("3");
  await expect(ficha.locator("[data-ficha-situacao]")).toHaveText("Ativo");
  await expect(ficha).toContainText("US$ 1,79 de US$ 60,00 · 48 pedidos");

  const marca = ficha.locator('[data-marca="bradesco"]');
  await marca.getByLabel("Motivo").fill("pedido do cliente");
  await marca.getByRole("button", { name: "Pausar nesta marca" }).click();
  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toEqual({ alvo: "marca", brandId: MARCA, pausado: true, motivo: "pedido do cliente" });
});

test("a recusa do servidor aparece como foi dita", async ({ page }) => {
  const enviados: unknown[] = [];
  await fingir(page, enviados, {
    resposta: { status: 400, json: { message: "Escreva o motivo (de 3 a 500 caracteres): ele fica no registro." } },
  });
  await page.goto("/dev/console-operacao");
  await page.locator('[data-conta="brennimark-ensaio"]').getByRole("button", { name: "Abrir a ficha" }).click();
  const conta = page.locator('[data-alavanca="conta"]');
  await conta.getByRole("button", { name: "Pausar o Vini nesta conta" }).click();
  await expect(conta.getByRole("status")).toHaveText("Escreva o motivo (de 3 a 500 caracteres): ele fica no registro.");
});
