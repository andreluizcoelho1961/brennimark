import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const fixture = (nome: string) => path.join(process.cwd(), "e2e/fixtures", nome);

/**
 * A prévia de seções: revisável antes de publicar, e utilizável num manual
 * grande.
 *
 * A lista é paginada, não virtualizada. Uma virtualização caseira desmonta
 * elementos enquanto o teclado ou o leitor de tela ainda os usa — o foco cai no
 * vazio e a leitura recomeça do topo. O que estes testes protegem é
 * exatamente o contrário disso.
 */

async function abrir(page: Page, nome: string) {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', fixture(nome));
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();
}

test("o índice do PDF vira as fronteiras, e o método aparece", async ({ page }) => {
  await abrir(page, "com-outline.pdf");

  const titulos = page.getByLabel("Título da seção");
  await expect(titulos).toHaveCount(2);
  await expect(titulos.nth(0)).toHaveValue("Cor");
  await expect(titulos.nth(1)).toHaveValue("Tipografia");

  // Quem revisa precisa saber de onde veio a fronteira para decidir se confia.
  await expect(page.getByText("Índice", { exact: true }).first()).toBeVisible();
});

test("a lista diz o total, e o leitor de tela recebe posição e total", async ({ page }) => {
  await abrir(page, "cabecalho-repetido.pdf");

  await expect(page.getByText(/Mostrando \d+ de \d+/)).toBeVisible();
  // Cada item se anuncia como "Seção N de M": sem isso, quem usa leitor de
  // tela não sabe onde está numa lista longa.
  await expect(page.getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    /Seção 1 de \d+/,
  );
  await expect(page.getByRole("list", { name: /\d+ seções/ })).toBeVisible();
});

test("renomear preserva a faixa de páginas", async ({ page }) => {
  await abrir(page, "com-outline.pdf");

  const primeiro = page.getByLabel("Título da seção").first();
  const faixaAntes = await page.getByText(/^Páginas /).first().textContent();

  await primeiro.fill("Sistema de cor");
  await expect(primeiro).toHaveValue("Sistema de cor");
  // A procedência é da seção, não do título.
  await expect(page.getByText(/^Páginas /).first()).toHaveText(faixaAntes!);
});

test("unir duas seções soma as páginas e não perde nenhuma", async ({ page }) => {
  await abrir(page, "com-outline.pdf");

  await expect(page.getByLabel("Título da seção")).toHaveCount(2);
  await page.getByRole("button", { name: "Unir com a anterior" }).click();

  await expect(page.getByLabel("Título da seção")).toHaveCount(1);
  // As duas páginas continuam representadas.
  await expect(page.getByText("Páginas 1–2")).toBeVisible();
});

test("o foco não some depois de unir", async ({ page }) => {
  await abrir(page, "com-outline.pdf");
  await page.getByRole("button", { name: "Unir com a anterior" }).click();

  // Depois de uma operação que remove um item da lista, o foco precisa pousar
  // na seção resultante — não no corpo do documento.
  //
  // A espera é do locator, não um `evaluate` imediato: a devolução do foco
  // acontece no quadro seguinte à re-renderização, e ler `activeElement` no
  // instante do clique mede a corrida, não o comportamento. Se o foco nunca
  // voltar, isto continua falhando — a espera tem teto.
  await expect(page.locator("[data-secao] [data-titulo]").first()).toBeFocused();
});

test("a busca alcança seções que não estão renderizadas", async ({ page }) => {
  await abrir(page, "cabecalho-repetido.pdf");

  const busca = page.getByPlaceholder(/Buscar por título/);
  // O texto da página 14 está no fim do manual e não precisa estar na tela
  // para ser encontrado: uma busca que só acha o que está renderizado não é
  // busca.
  await busca.fill("Conteudo da pagina 14");
  await expect(page.getByText(/Mostrando 1 de 1/)).toBeVisible();

  await busca.fill("");
  await expect(page.getByText(/Mostrando \d+ de \d+/)).toBeVisible();
});

test("busca por número de página encontra a seção", async ({ page }) => {
  await abrir(page, "cabecalho-repetido.pdf");
  await page.getByPlaceholder(/Buscar por título/).fill("9–14");
  await expect(page.getByText(/Mostrando 1 de 1/)).toBeVisible();
});

test("busca sem resultado diz isso, em vez de lista vazia muda", async ({ page }) => {
  await abrir(page, "com-outline.pdf");
  await page.getByPlaceholder(/Buscar por título/).fill("zzzznadaaqui");
  await expect(page.getByText("Nenhuma seção corresponde à busca.")).toBeVisible();
});

test("dividir cria duas seções sem perder páginas", async ({ page }) => {
  await abrir(page, "cabecalho-repetido.pdf");

  const antes = await page.getByLabel("Título da seção").count();
  await page.getByRole("button", { name: "Dividir" }).first().click();
  await expect(page.getByLabel("Título da seção")).toHaveCount(antes + 1);

  // A segunda parte se anuncia como continuação, para quem revisa saber que
  // não é uma seção nova do manual.
  await expect(page.getByLabel("Título da seção").nth(1)).toHaveValue(/continuação/);
});

test("mover a primeira página deixa a seção descontínua, e a tela diz isso", async ({ page }) => {
  await abrir(page, "cabecalho-repetido.pdf");

  await page.getByRole("button", { name: "Mover 1ª página acima" }).first().click();
  // "Páginas 10–14" viraria mentira se a 9 tivesse ido embora sem a faixa
  // acompanhar. O modelo por intervalos mostra o buraco.
  await expect(page.getByText(/^Páginas 1–9$/)).toBeVisible();
});
