import { expect, test, type Page } from "@playwright/test";

/**
 * Item e variante — ADR-0007 §2.2.
 *
 * "Item não é arquivo. A interface é matriz, nunca lista plana." Estes testes
 * provam o que a TELA faz com o modelo: uma matriz por item, colunas só dos
 * eixos que o tipo usa, e um formulário que não deixa mandar eixo proibido nem
 * esquecer eixo obrigatório. O que o BANCO garante está em
 * `scripts/prova-item-e-variante.sh`.
 *
 * Rede fingida, como no resto da suíte da biblioteca.
 */
const semEixo = { hierarquia: null, lockup: null, cor: null, polaridade: null, espaco_de_cor: null };
const ITENS = [
  { id: "item-logo", tipo: "logo", nome: "Logo principal", descricao: "", ordem: 0 },
  { id: "item-paleta", tipo: "paleta", nome: "Paleta institucional", descricao: "", ordem: 1 },
  { id: "item-fonte", tipo: "fonte", nome: "Tipografia", descricao: "", ordem: 2 },
  { id: "item-vazio", tipo: "icone", nome: "Ícones de serviço", descricao: "", ordem: 3 },
];
const base = { description: "", mime_type: "image/svg+xml", size_bytes: 2048, status: "ready", created_at: "2026-09-17T10:00:00Z", baixavel: true, descontinuadoEm: null, substituidoPor: null };
const ASSETS = [
  { ...base, id: "v-horizontal", itemId: "item-logo", label: "Horizontal positivo", file_name: "logo-h.svg",
    eixos: { hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espaco_de_cor: "rgb" } },
  { ...base, id: "v-vertical", itemId: "item-logo", label: "Vertical negativo", file_name: "logo-v.eps",
    eixos: { hierarquia: "principal", lockup: "vertical", cor: "monocromatico", polaridade: "negativo", espaco_de_cor: "cmyk" } },
  { ...base, id: "v-paleta", itemId: "item-paleta", label: "Paleta CMYK", file_name: "paleta.ase",
    eixos: { ...semEixo, espaco_de_cor: "cmyk" } },
];

async function comAcervo(page: Page) {
  await page.route("**/api/assets**", (rota) =>
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ itens: ITENS, assets: ASSETS }) }),
  );
}

test("cada item é uma matriz, com uma linha por variante", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/biblioteca");

  const logo = page.locator('[data-matriz-do-item="item-logo"]');
  await expect(logo.locator("tbody tr")).toHaveCount(2);
  // O formato é fato do arquivo, e aparece; o espaço de cor é eixo declarado.
  await expect(logo.locator("[data-variante='v-vertical']")).toContainText("EPS");
  await expect(logo.locator("[data-variante='v-vertical']")).toContainText("CMYK");
  await expect(logo.locator("[data-variante='v-vertical']")).toContainText("Negativo");
});

test("as colunas são só os eixos do tipo — paleta não mostra polaridade vazia", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/biblioteca");

  const cabecalhoDoLogo = page.locator('[data-matriz-do-item="item-logo"] thead');
  for (const eixo of ["Hierarquia", "Lockup", "Cor", "Polaridade", "Espaço de cor"]) {
    await expect(cabecalhoDoLogo.getByRole("columnheader", { name: eixo, exact: true })).toBeVisible();
  }
  const cabecalhoDaPaleta = page.locator('[data-matriz-do-item="item-paleta"] thead');
  await expect(cabecalhoDaPaleta.getByRole("columnheader", { name: "Espaço de cor" })).toBeVisible();
  await expect(cabecalhoDaPaleta.getByRole("columnheader", { name: "Polaridade", exact: true })).toHaveCount(0);
  await expect(cabecalhoDaPaleta.getByRole("columnheader", { name: "Lockup", exact: true })).toHaveCount(0);
});

test("o envio pede os eixos do item escolhido, obrigatórios como obrigatórios", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/biblioteca");
  const envio = page.locator("[data-form-envio]");

  await envio.getByLabel("Item").selectOption("item-logo");
  for (const nome of ["hierarquia", "lockup", "cor", "polaridade", "espaco_de_cor"]) {
    await expect(envio.locator(`select[name="${nome}"]`)).toHaveAttribute("required", "");
  }

  // Trocar para a paleta tira os eixos que ela não tem — não há como mandá-los.
  await envio.getByLabel("Item").selectOption("item-paleta");
  await expect(envio.locator('select[name="espaco_de_cor"]')).toHaveAttribute("required", "");
  for (const nome of ["hierarquia", "lockup", "cor", "polaridade"]) {
    await expect(envio.locator(`select[name="${nome}"]`)).toHaveCount(0);
  }
});

test("a substituição só oferece variantes do mesmo item", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/biblioteca");
  const envio = page.locator("[data-form-envio]");

  await envio.getByLabel("Item").selectOption("item-paleta");
  const opcoes = envio.locator('select[name="substitui"] option');
  await expect(opcoes).toHaveCount(2); // "nada" + a paleta
  await expect(envio.locator('select[name="substitui"]')).not.toContainText("Horizontal positivo");
});

test("fonte não pede arquivo antes do termo, e diz por quê", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/biblioteca");

  await expect(page.locator('[data-item="item-fonte"] [data-fonte-travada]')).toBeVisible();
  const envio = page.locator("[data-form-envio]");
  await envio.getByLabel("Item").selectOption("item-fonte");
  await expect(envio.locator('input[type="file"]')).toHaveCount(0);
  await expect(envio).toContainText(/termo de licença/);
});

test("só item vazio oferece remoção", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/biblioteca");

  await expect(page.locator('[data-item="item-vazio"]').getByRole("button", { name: "Remover item" })).toBeVisible();
  await expect(page.locator('[data-item="item-logo"]').getByRole("button", { name: "Remover item" })).toHaveCount(0);
});

test("criar item manda tipo, nome e descrição", async ({ page }) => {
  await comAcervo(page);
  const corpos: unknown[] = [];
  await page.route("**/api/admin/assets/itens**", async (rota) => {
    corpos.push(rota.request().postDataJSON());
    await rota.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ item: { id: "novo" } }) });
  });
  await page.goto("/dev/biblioteca");
  const form = page.locator("[data-form-item]");
  await form.getByLabel("Tipo").selectOption("gabarito");
  await form.getByLabel("Nome do item").fill("Gabarito de cartão");
  await form.getByRole("button", { name: "Criar item" }).click();

  await expect.poll(() => corpos.length).toBe(1);
  expect(corpos[0]).toEqual({ tipo: "gabarito", nome: "Gabarito de cartão", descricao: "" });
});

test("corrigir o nome do arquivo manda só o texto, e o botão mostra que está salvando", async ({ page }) => {
  await comAcervo(page);
  const corpos: unknown[] = [];
  let liberar = () => {};
  const segurando = new Promise<void>((r) => { liberar = r; });
  await page.route((url) => url.pathname === "/api/admin/assets", async (rota) => {
    if (rota.request().method() !== "PATCH") return rota.fallback();
    corpos.push(rota.request().postDataJSON());
    await segurando;
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, renomeado: true }) });
  });
  await page.goto("/dev/biblioteca");
  const linha = page.locator("[data-variante='v-horizontal']");
  await linha.getByRole("button", { name: "Editar nome" }).click();
  const form = linha.locator("[data-editar-texto]");
  await form.getByLabel("Nome").fill("Horizontal positivo — RGB");
  await form.getByRole("button", { name: "Salvar" }).click();

  await expect(form.getByRole("button", { name: "Salvando…" })).toHaveAttribute("aria-busy", "true");
  liberar();
  await expect.poll(() => corpos.length).toBe(1);
  expect(corpos[0]).toEqual({ id: "v-horizontal", label: "Horizontal positivo — RGB", description: "" });
  await expect(page.locator("[data-aviso-do-acervo]")).toHaveText("Alteração salva.");
  await expect(linha.locator("[data-editar-texto]")).toHaveCount(0);
});

test("o item também tem o nome corrigível", async ({ page }) => {
  await comAcervo(page);
  const corpos: unknown[] = [];
  await page.route("**/api/admin/assets/itens**", async (rota) => {
    corpos.push(rota.request().postDataJSON());
    await rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto("/dev/biblioteca");
  const item = page.locator('[data-item="item-paleta"]');
  await item.getByRole("button", { name: "Editar item" }).click();
  await item.locator("[data-editar-texto]").getByLabel("Nome").fill("Paleta da marca");
  await item.getByRole("button", { name: "Salvar" }).click();

  await expect.poll(() => corpos.length).toBe(1);
  expect(corpos[0]).toEqual({ id: "item-paleta", nome: "Paleta da marca", descricao: "" });
});

test("quem só consulta vê a matriz e baixa, sem formulários", async ({ page }) => {
  await comAcervo(page);
  await page.goto("/dev/biblioteca?gerencia=0");

  await expect(page.locator("[data-form-item]")).toHaveCount(0);
  await expect(page.locator("[data-form-envio]")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Baixar" })).toHaveCount(3);
  await expect(page.getByRole("button", { name: /Editar/ })).toHaveCount(0);
});
