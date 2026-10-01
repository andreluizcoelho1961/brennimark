import { expect, test, type Page } from "@playwright/test";

/**
 * Links de entrega — a tela da conta (30/09/2026, ADR-0007 §2.5).
 *
 * `/api/links` e `/api/assets` são fingidos, como em Registros: quem lê, cria
 * e encerra cada link é decidido pelo banco (`scripts/prova-links-de-entrega.sh`).
 * O que se prova aqui é o caminho da tela: criar só com o que pode ir, ver o
 * endereço UMA vez, listar, ver acessos e encerrar com confirmação.
 */

const ENDERECO = "http://localhost:3000/receber/" + "k".repeat(43);

const LINKS = [
  { id: "11111111-1111-4111-8111-111111111111", marca: "Marca Um", nome: "Gráfica Pampa", destinatario: "Carla", criado_em: "2026-09-30T12:00:00Z",
    criado_por: "dono@agencia.com", expira_em: "2026-10-07T12:00:00Z", revogado_em: null, situacao: "ativo", arquivos: 3, downloads: 2, ultimo_download: "2026-09-30T15:00:00Z" },
  { id: "22222222-2222-4222-8222-222222222222", marca: "Marca Dois", nome: "Fornecedor antigo", destinatario: "", criado_em: "2026-09-01T12:00:00Z",
    criado_por: "dono@agencia.com", expira_em: "2026-09-08T12:00:00Z", revogado_em: null, situacao: "expirado", arquivos: 1, downloads: 0, ultimo_download: null },
];

const ITENS = [
  { id: "item-logo", tipo: "logo", nome: "Logotipo" },
  { id: "item-fonte", tipo: "fonte", nome: "Fonte" },
];
const base = { baixavel: true, descontinuadoEm: null };
const ASSETS = [
  { ...base, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", itemId: "item-logo", label: "Logo principal", file_name: "logo.svg" },
  { ...base, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2", itemId: "item-logo", label: "Logo negativo", file_name: "logo-neg.svg" },
  { ...base, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3", itemId: "item-logo", label: "Logo antigo", file_name: "velho.svg", descontinuadoEm: "2026-09-01T00:00:00Z" },
  { ...base, id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4", itemId: "item-fonte", label: "Fonte", file_name: "fonte.otf" },
];

async function fingir(page: Page, pedidos: { criar: Record<string, unknown>[]; criarUrl: URL[]; revogar: string[] }, criar?: { status: number; json: unknown }) {
  let revogados = new Set<string>();
  await page.route("**/api/links**", async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname === "/api/links" && rota.request().method() === "POST") {
      pedidos.criar.push(rota.request().postDataJSON());
      pedidos.criarUrl.push(url);
      return rota.fulfill(criar ?? { status: 201, json: { id: "novo", endereco: ENDERECO } });
    }
    const revogar = url.pathname.match(/^\/api\/links\/([^/]+)\/revogar$/);
    if (revogar) {
      pedidos.revogar.push(revogar[1]);
      revogados = new Set([...revogados, revogar[1]]);
      return rota.fulfill({ json: { ok: true } });
    }
    if (/\/acessos$/.test(url.pathname)) {
      return rota.fulfill({ json: { acessos: [
        { id: "x2", evento: "baixou", nome: "Carla", email: "carla@grafica.com", asset_label: "Logo principal", file_name: "logo.svg", created_at: "2026-09-30T15:00:00Z" },
        { id: "x1", evento: "abriu", nome: null, email: null, asset_label: null, file_name: null, created_at: "2026-09-30T14:59:00Z" },
      ] } });
    }
    return rota.fulfill({ json: { links: LINKS.map((l) => (revogados.has(l.id) ? { ...l, situacao: "revogado", revogado_em: "2026-09-30T16:00:00Z" } : l)) } });
  });
  await page.route("**/api/assets**", (rota) => rota.fulfill({ json: { itens: ITENS, assets: ASSETS, manual: null } }));
}

const vazios = () => ({ criar: [] as Record<string, unknown>[], criarUrl: [] as URL[], revogar: [] as string[] });

test("lista os links com situação e downloads; acessos dizem o que o registro prova", async ({ page }) => {
  await fingir(page, vazios());
  await page.goto("/dev/links");
  const ativo = page.locator(`[data-link="${LINKS[0].id}"]`);
  await expect(ativo).toHaveAttribute("data-situacao", "ativo");
  await expect(ativo.locator("[data-situacao-rotulo]")).toHaveText("Ativo");
  await expect(ativo).toContainText("para Carla");
  await expect(page.locator(`[data-link="${LINKS[1].id}"] [data-situacao-rotulo]`)).toHaveText("Expirado");
  // Link vencido não se encerra: já está fora.
  await expect(page.locator(`[data-link="${LINKS[1].id}"] [data-encerrar]`)).toHaveCount(0);

  await ativo.locator("[data-ver-acessos]").click();
  const acessos = page.locator(`[data-acessos="${LINKS[0].id}"]`);
  await expect(acessos).toContainText("Carla (carla@grafica.com) baixou Logo principal — logo.svg");
  await expect(acessos).toContainText("Link aberto");
  await expect(acessos).toContainText("não são verificados");
});

test("encerrar pede confirmação e vale na lista", async ({ page }) => {
  const pedidos = vazios();
  await fingir(page, pedidos);
  await page.goto("/dev/links");
  const ativo = page.locator(`[data-link="${LINKS[0].id}"]`);
  await ativo.locator("[data-encerrar]").click();
  expect(pedidos.revogar).toEqual([]);
  await ativo.locator("[data-confirmar-encerrar]").click();
  await expect(ativo.locator("[data-situacao-rotulo]")).toHaveText("Encerrado");
  expect(pedidos.revogar).toEqual([LINKS[0].id]);
});

test("criar: só arquivo em uso e sem fonte; prazo padrão de 7; o endereço aparece uma vez", async ({ page }) => {
  const pedidos = vazios();
  await fingir(page, pedidos);
  await page.goto("/dev/links");
  await page.locator("[data-novo-link]").click();
  const form = page.locator("[data-criar-link]");
  await expect(form.locator("[data-arquivo-para-link]")).toHaveCount(2);
  await expect(form.getByText("velho.svg")).toHaveCount(0);
  await expect(form.getByText("fonte.otf")).toHaveCount(0);
  await expect(form.locator("[data-prazo-do-link]")).toHaveValue("7");
  await expect(form.locator("[data-criar]")).toBeDisabled();

  await form.locator("[data-nome-do-link]").fill("Gráfica Pampa — cartazes");
  await form.locator(`[data-arquivo-para-link="${ASSETS[0].id}"]`).check();
  await form.locator(`[data-arquivo-para-link="${ASSETS[1].id}"]`).check();
  await form.locator("[data-criar]").click();

  const criado = page.locator("[data-link-criado]");
  await expect(criado.locator("[data-endereco-do-link]")).toHaveValue(ENDERECO);
  await expect(criado).toContainText("Este endereço aparece só agora");
  expect(pedidos.criar[0]).toEqual({ nome: "Gráfica Pampa — cartazes", destinatario: "", dias: 7, arquivos: [ASSETS[0].id, ASSETS[1].id] });
  expect(pedidos.criarUrl[0].searchParams.get("b")).toBe("marca-um");
});

test("o atalho de Materiais abre a criação já com a marca e os arquivos", async ({ page }) => {
  await fingir(page, vazios());
  await page.goto(`/dev/links?marca=marca-dois&arquivos=${ASSETS[1].id}`);
  const form = page.locator("[data-criar-link]");
  await expect(form.locator("[data-marca-do-link]")).toHaveValue("marca-dois");
  await expect(form.locator(`[data-arquivo-para-link="${ASSETS[1].id}"]`)).toBeChecked();
  await expect(form.locator(`[data-arquivo-para-link="${ASSETS[0].id}"]`)).not.toBeChecked();
});

test("a recusa do servidor aparece com a frase dele, e nenhum endereço", async ({ page }) => {
  await fingir(page, vazios(), { status: 400, json: { message: "Fonte não vai por link: só quem tem acesso à marca a recebe." } });
  await page.goto("/dev/links");
  await page.locator("[data-novo-link]").click();
  const form = page.locator("[data-criar-link]");
  await form.locator("[data-nome-do-link]").fill("x");
  await form.locator(`[data-arquivo-para-link="${ASSETS[0].id}"]`).check();
  await form.locator("[data-criar]").click();
  await expect(form.getByRole("alert")).toHaveText("Fonte não vai por link: só quem tem acesso à marca a recebe.");
  await expect(page.locator("[data-link-criado]")).toHaveCount(0);
});
