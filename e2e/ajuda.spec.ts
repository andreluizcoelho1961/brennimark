import { expect, test } from "@playwright/test";

/**
 * A Central de ajuda e o "Como usar" dentro das ferramentas (17/10/2026).
 * A mecânica do Markdown está provada em `src/lib/ajuda/*.test.ts`; aqui, a tela.
 */

test("a /ajuda mostra categorias reais: as com artigo levam a ele, as sem artigo dizem 'em breve'", async ({ page }) => {
  await page.goto("/ajuda");
  await expect(page.getByRole("link", { name: /Primeiros passos/ })).toHaveAttribute("href", "/ajuda/primeiros-passos");
  await expect(page.getByRole("link", { name: /Materiais da marca/ })).toHaveAttribute("href", "/ajuda/categoria/materiais-da-marca");
  await expect(page.getByRole("link", { name: /O manual em PDF/ })).toHaveAttribute("href", "/ajuda/manual-em-pdf");
  await expect(page.getByRole("link", { name: /Pessoas e acesso/ })).toHaveAttribute("href", "/ajuda/pessoas-e-acesso");
  // Só Vini Max e Assinatura ainda não têm artigo.
  await expect(page.getByText("Em breve")).toHaveCount(2);
  // O contador deixou de ser inventado.
  await expect(page.getByText("14 artigos")).toHaveCount(0);
  await expect(page.getByText("3 artigos")).toBeVisible();
});

test("a busca encontra o artigo certo, sem acento e sem caixa", async ({ page }) => {
  await page.goto("/ajuda");
  await page.getByRole("searchbox", { name: "Buscar na central de ajuda" }).fill("DALTONISMO");
  await expect(page.getByRole("status").getByRole("link", { name: /Cores — como usar/ })).toBeVisible();
  await page.getByRole("searchbox").fill("xyzzy");
  await expect(page.getByRole("status")).toContainText("Nenhum artigo encontrado");
});

test("a busca acha o manual e as pessoas pelo que a pessoa diria", async ({ page }) => {
  await page.goto("/ajuda");
  const busca = page.getByRole("searchbox", { name: "Buscar na central de ajuda" });
  await busca.fill("senha provisória");
  await expect(page.getByRole("status").getByRole("link", { name: /Pessoas e acesso — como usar/ })).toBeVisible();
  await busca.fill("miniaturas");
  await expect(page.getByRole("status").getByRole("link", { name: /O manual em PDF — como usar/ })).toBeVisible();
});

test("o artigo público mostra as duas versões e diz de qual é cada trecho", async ({ page }) => {
  await page.goto("/ajuda/kit");
  await expect(page.getByRole("heading", { name: "Kit — como usar" })).toBeVisible();
  await expect(page.getByText("No site, sem login").first()).toBeVisible();
  await expect(page.getByText("Dentro de uma marca").first()).toBeVisible();
  await expect(page.locator(".ajuda-artigo")).not.toContainText(":::");
  await page.goto("/ajuda/nao-existe");
  await expect(page.getByText(/não encontrad|404/i).first()).toBeVisible();
});

test("o 'Como usar' do Cores gratuito abre ao lado, só com o que vale no site, e Esc devolve o foco", async ({ page }) => {
  await page.goto("/ferramentas/cores");
  const abrir = page.locator("[data-como-usar-abrir]");
  await expect(page.locator("[data-como-usar]")).toHaveCount(0);
  await abrir.click();
  const painel = page.locator("[data-como-usar]");
  await expect(painel).toBeVisible();
  await expect(painel).toContainText("Pegue uma cor");
  // O trecho "É a cor da marca?" é só de dentro de uma marca.
  await expect(painel).not.toContainText("Parecida com");
  await expect(painel).not.toContainText("Dentro de uma marca");
  // A ferramenta continua usável com o painel aberto.
  await page.locator("[data-cores-codigo]").fill("#FF4103");
  await page.keyboard.press("Escape");
  await expect(painel).toHaveCount(0);
  await expect(abrir).toBeFocused();
});

test("Grids e Kit gratuitos têm o seu 'Como usar', com o link para a Central", async ({ page }) => {
  for (const [rota, trecho] of [["grids", "O formato"], ["kit", "O logo"]] as const) {
    await page.goto(`/ferramentas/${rota}`);
    await page.locator("[data-como-usar-abrir]").click();
    const painel = page.locator("[data-como-usar]");
    await expect(painel).toContainText(trecho);
    await expect(painel.getByRole("link", { name: "Abrir na Central de ajuda" })).toHaveAttribute("href", `/ajuda/${rota}`);
  }
});
