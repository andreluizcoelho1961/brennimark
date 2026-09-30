import { expect, test, type Page } from "@playwright/test";

/**
 * Configurações › Consumo — a tela da conta (30/09/2026).
 *
 * `/api/configuracoes/consumo` é fingido, como em Registros: quem LÊ o consumo
 * é decidido pelas políticas de `ai_ledger`, `ai_budgets` e
 * `consumo_de_armazenamento` (`scripts/prova-consumo-da-conta.sh`). O que se
 * prova aqui é o caminho da tela: mês, tetos, pausas, a tabela por marca, e
 * que nada em dinheiro aparece.
 */

const KB = 1024;
const MB = 1024 * KB;

function consumo(mes: string, extra: Record<string, unknown> = {}) {
  return {
    mes,
    marcas: [
      { id: "m2", nome: "Marca Dois", perguntas: 0, analises: 0, prompts: 0, manuais_bytes: 0, materiais_bytes: 0, pecas_bytes: 0, pausada: true },
      { id: "m1", nome: "Marca Um", perguntas: 1234, analises: 5, prompts: 2, manuais_bytes: 12.5 * MB, materiais_bytes: 3 * MB, pecas_bytes: 200 * KB, pausada: false },
    ],
    totais: { perguntas: 1234, analises: 5, prompts: 2, manuais_bytes: 12.5 * MB, materiais_bytes: 3 * MB, pecas_bytes: 200 * KB },
    tetos: [{ periodo: "dia", pct: 85, estado: "alerta" }, { periodo: "mes", pct: 12, estado: "ok" }],
    contaPausada: false,
    fotografia: "2026-09-29",
    ...extra,
  };
}

async function fingir(page: Page, pedidos: URL[], resposta: (mes: string) => { status?: number; json: unknown }) {
  await page.route("**/api/configuracoes/consumo**", async (rota) => {
    const url = new URL(rota.request().url());
    pedidos.push(url);
    const r = resposta(url.searchParams.get("mes") ?? "");
    return rota.fulfill({ status: r.status ?? 200, json: r.json });
  });
}

test("mostra os tetos de agora, a tabela por marca e nenhum valor em dinheiro", async ({ page }) => {
  const pedidos: URL[] = [];
  await fingir(page, pedidos, (mes) => ({ json: consumo(mes) }));
  await page.goto("/dev/configuracoes");

  await expect(page.locator('[data-parte="consumo"]')).toHaveAttribute("aria-current", "page");
  for (const id of ["plano", "aceites"]) {
    await expect(page.locator(`[data-parte-em-breve="${id}"]`)).toHaveAttribute("aria-disabled", "true");
  }

  const dia = page.locator('[data-teto="dia"]');
  await expect(dia).toHaveAttribute("data-estado", "alerta");
  await expect(dia).toContainText("85%");
  await expect(dia).toContainText("Perto do limite");
  await expect(dia).toContainText("21h em Brasília");
  await expect(page.locator('[data-teto="mes"]')).toContainText("12%");

  const um = page.locator('[data-marca="m1"]');
  await expect(um).toContainText("1.234");
  await expect(um).toContainText("12,5 MB");
  await expect(um).toContainText("200 KB");
  await expect(page.locator('[data-marca="m2"] [data-marca-pausada]')).toHaveText("Vini pausado");
  await expect(page.locator('[data-marca="m1"] [data-marca-pausada]')).toHaveCount(0);
  await expect(page.getByText("na medição de 29/09")).toBeVisible();
  await expect(page.locator("[data-conta-pausada]")).toHaveCount(0);

  // Decisão de 30/09: uso e percentual, nunca dinheiro.
  await expect(page.locator("[data-consumo]")).not.toContainText(/US\$|R\$|\$\s?\d|dólar|custo/i);
  expect(pedidos[0].searchParams.get("mes")).toMatch(/^\d{4}-\d{2}$/);
});

test("trocar o mês pede o mês escolhido", async ({ page }) => {
  const pedidos: URL[] = [];
  await fingir(page, pedidos, (mes) => ({ json: consumo(mes) }));
  await page.goto("/dev/configuracoes");
  await expect(page.locator("[data-tabela-consumo]")).toBeVisible();

  const opcoes = await page.locator("[data-mes] option").evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(opcoes).toHaveLength(12);
  await page.locator("[data-mes]").selectOption(opcoes[3]);
  await expect.poll(() => pedidos.at(-1)?.searchParams.get("mes")).toBe(opcoes[3]);
  await expect(page.locator("#titulo-por-marca")).toBeVisible();
});

test("conta pausada, sem teto e sem medição dizem isso com todas as letras", async ({ page }) => {
  await fingir(page, [], (mes) => ({ json: consumo(mes, { contaPausada: true, tetos: [], fotografia: null }) }));
  await page.goto("/dev/configuracoes");

  await expect(page.locator("[data-conta-pausada]")).toContainText("A Brennimark pausou o Vini nesta conta");
  await expect(page.locator("[data-sem-teto]")).toBeVisible();
  await expect(page.getByText("O espaço ainda não foi medido neste mês.")).toBeVisible();
});

test("teto esgotado diz que o Vini recusa até renovar", async ({ page }) => {
  await fingir(page, [], (mes) => ({ json: consumo(mes, { tetos: [{ periodo: "mes", pct: 104, estado: "esgotado" }] }) }));
  await page.goto("/dev/configuracoes");

  const mes = page.locator('[data-teto="mes"]');
  await expect(mes).toContainText("104%");
  await expect(mes).toContainText("Limite atingido");
  // A barra não passa da largura do cartão.
  await expect(mes.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");
});

test("erro do servidor aparece, sem tabela vazia fingindo zero", async ({ page }) => {
  await fingir(page, [], () => ({ status: 500, json: { message: "Não foi possível carregar o consumo." } }));
  await page.goto("/dev/configuracoes");

  // O anunciador de rota do Next também tem papel de alerta: procurar dentro da tela.
  await expect(page.locator("[data-consumo]").getByRole("alert")).toHaveText("Não foi possível carregar o consumo.");
  await expect(page.locator("[data-tabela-consumo]")).toHaveCount(0);
});
