import { expect, test, type Page } from "@playwright/test";

/**
 * Registros — a tela da conta (28/09/2026).
 *
 * `/api/registros` é fingido, como em Pessoas: quem LÊ cada linha é decidido
 * pelas políticas de cada tabela de registro (só quem administra a marca). O
 * que se prova aqui é o caminho da tela: abas, filtros, "carregar mais", e a
 * verdade sobre o que é e o que não é gravado.
 */

const MARCA_UM = "d87b93f3-81d8-49f1-a8ef-9371ba05464c";

function downloads(n: number, inicio = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `d${inicio + i}`, tipo: i % 2 ? "manual" : "material", marca: "Marca Um", pessoa: "ana@agencia.com",
    oque: i % 2 ? "Manual (PDF)" : "Logo principal", arquivo: i % 2 ? "manual.pdf" : "logo.svg",
    quando: new Date(Date.UTC(2026, 8, 28, 12, 0) - (inicio + i) * 60_000).toISOString(),
  }));
}

async function fingir(page: Page, pedidos: URL[]) {
  await page.route("**/api/registros**", async (rota) => {
    const url = new URL(rota.request().url());
    pedidos.push(url);
    const aba = url.searchParams.get("aba");
    if (aba === "acessos") {
      return rota.fulfill({ json: { proximo: null, linhas: [
        { id: "a1", marca: "Marca Um", pessoa: "bia@grafica.com", autor: "dono@agencia.com", acao: "concedido", antes: [], depois: ["consultar"], quando: "2026-09-28T12:00:00Z" },
        { id: "a2", marca: "Marca Um", pessoa: "Conta removida · 7F3A2C", autor: "dono@agencia.com", acao: "revogado", antes: ["editar"], depois: [], quando: "2026-09-27T12:00:00Z" },
      ] } });
    }
    if (aba === "acoes") {
      return rota.fulfill({ json: { proximo: null, linhas: [
        { id: "v1", marca: "Marca Dois", autor: "André Coelho", acao: "published", slug: "cores", titulo: "Paleta de cores", quando: "2026-09-28T11:00:00Z" },
      ] } });
    }
    if (url.searchParams.get("pessoa") === "ninguem") return rota.fulfill({ json: { linhas: [], proximo: null } });
    if (url.searchParams.get("antes")) return rota.fulfill({ json: { linhas: downloads(3, 100), proximo: null } });
    return rota.fulfill({ json: { linhas: downloads(100), proximo: downloads(100)[99].quando } });
  });
}

test("abre em Downloads, pagina com 'carregar mais' e diz o que 'download' quer dizer", async ({ page }) => {
  const pedidos: URL[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/registros");

  const tabela = page.locator('[data-tabela-registros="downloads"]');
  await expect(tabela.locator("[data-linha-de-registro]")).toHaveCount(100);
  await expect(page.getByText("Download iniciado: a pessoa recebeu um endereço válido")).toBeVisible();
  await expect(tabela.locator("[data-linha-de-registro]").first()).toContainText("Logo principal");
  await expect(tabela.locator("[data-linha-de-registro]").first()).toContainText("28/09 09:00");

  await page.locator("[data-carregar-mais]").click();
  await expect(tabela.locator("[data-linha-de-registro]")).toHaveCount(103);
  // A página seguinte pede só o que vem ANTES da última linha.
  expect(pedidos.at(-1)!.searchParams.get("antes")).toBe(downloads(100)[99].quando);
  await expect(page.locator("[data-carregar-mais]")).toHaveCount(0);
});

test("os filtros só valem ao clicar 'Filtrar', e vão todos ao servidor", async ({ page }) => {
  const pedidos: URL[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/registros");
  await expect(page.locator("[data-linha-de-registro]").first()).toBeVisible();
  const antes = pedidos.length;

  const filtros = page.locator("[data-filtros]");
  await filtros.getByLabel("Marca").selectOption({ label: "Marca Um" });
  await filtros.getByLabel("Pessoa").fill("ninguem");
  await filtros.getByLabel("De").fill("2026-09-01");
  await filtros.getByLabel("Até").fill("2026-09-28");
  // Digitar não consulta.
  expect(pedidos.length).toBe(antes);
  await page.locator("[data-filtrar]").click();

  await expect(page.locator("[data-registros-vazio]")).toHaveText("Nada registrado com estes filtros.");
  const ultimo = pedidos.at(-1)!.searchParams;
  expect(Object.fromEntries(ultimo)).toEqual({ aba: "downloads", marca: MARCA_UM, pessoa: "ninguem", de: "2026-09-01", ate: "2026-09-28" });
});

test("Acessos mostra a mudança em uma frase, e a conta removida pelo apelido", async ({ page }) => {
  const pedidos: URL[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/registros");
  await page.locator('[data-aba="acessos"]').click();

  const linhas = page.locator('[data-tabela-registros="acessos"] [data-linha-de-registro]');
  await expect(linhas).toHaveCount(2);
  await expect(linhas.nth(0)).toContainText("concedido: consultar");
  await expect(linhas.nth(1)).toContainText("revogado (tinha: editar)");
  await expect(linhas.nth(1)).toContainText("Conta removida · 7F3A2C");
  await expect(page.getByText("Visitas às marcas não são gravadas.")).toBeVisible();
  await expect(page.locator('[data-aba="acessos"]')).toHaveAttribute("aria-selected", "true");
});

test("Ações mostra quem publicou o quê", async ({ page }) => {
  await fingir(page, []);
  await page.goto("/dev/registros");
  await page.locator('[data-aba="acoes"]').click();
  const linha = page.locator('[data-tabela-registros="acoes"] [data-linha-de-registro]');
  await expect(linha).toHaveCount(1);
  await expect(linha).toContainText("André Coelho");
  await expect(linha).toContainText("publicou · Paleta de cores");
});

test("Perguntas sem resposta explica por que vem depois, sem consultar nada", async ({ page }) => {
  const pedidos: URL[] = [];
  await fingir(page, pedidos);
  await page.goto("/dev/registros");
  await expect(page.locator("[data-linha-de-registro]").first()).toBeVisible();
  const antes = pedidos.length;
  await page.locator('[data-aba="perguntas"]').click();
  await expect(page.locator("[data-perguntas-em-breve]")).toContainText("para ninguém ser identificado pela pergunta");
  expect(pedidos.length).toBe(antes);
});

test("sem rede, a tela diz que falhou em vez de ficar carregando", async ({ page }) => {
  await page.route("**/api/registros**", (rota) => rota.abort("internetdisconnected"));
  await page.goto("/dev/registros");
  await expect(page.locator("[data-registros]").getByRole("alert")).toHaveText("Sem conexão: não foi possível carregar os registros.");
  await expect(page.getByText("Carregando…")).toHaveCount(0);
});
