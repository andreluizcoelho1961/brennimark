import { expect, test } from "@playwright/test";

/**
 * A Central de ajuda e o "Como usar" dentro das ferramentas (17/10/2026).
 * A mecânica do Markdown está provada em `src/lib/ajuda/*.test.ts`; aqui, a tela.
 */

test("a /ajuda mostra categorias reais, todas com artigo, e cada cartão leva a ele", async ({ page }) => {
  await page.goto("/ajuda");
  const cartoes = page.locator(".related");
  await expect(cartoes.getByRole("link", { name: /Primeiros passos/ })).toHaveAttribute("href", "/ajuda/primeiros-passos");
  await expect(cartoes.getByRole("link", { name: /O manual em PDF/ })).toHaveAttribute("href", "/ajuda/categoria/manual-em-pdf");
  await expect(cartoes.getByRole("link", { name: /Materiais da marca/ })).toHaveAttribute("href", "/ajuda/categoria/materiais-da-marca");
  await expect(cartoes.getByRole("link", { name: /Vini Max/ })).toHaveAttribute("href", "/ajuda/vini-max");
  await expect(cartoes.getByRole("link", { name: /Pessoas e acesso/ })).toHaveAttribute("href", "/ajuda/categoria/pessoas-e-acesso");
  await expect(cartoes.getByRole("link", { name: /Assinatura/ }).first()).toHaveAttribute("href", "/ajuda/assinatura");
  await expect(page.getByText("Em breve")).toHaveCount(0);
  // O contador deixou de ser inventado.
  await expect(page.getByText("14 artigos")).toHaveCount(0);
  await expect(page.getByText("4 artigos")).toBeVisible();
});

test("o FAQ não promete o que o produto não faz", async ({ page }) => {
  await page.goto("/ajuda");
  await expect(page.locator(".faq")).not.toContainText("limite de downloads");
  await expect(page.locator(".faq")).not.toContainText("uso adicional");
  await expect(page.locator(".faq")).not.toContainText("No Studio, crie a marca");
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

test("o botão Ajuda da moldura abre o painel, mostra a lista numa tela sem artigo, e Esc devolve o foco", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/marcas?marca=festival");
  const botao = page.locator("[data-ajuda-abrir]").first();
  await expect(page.locator("[data-ajuda-da-moldura]")).toHaveCount(0);
  // Foco e Enter, e não clique: o botão "N" do Next (só em desenvolvimento) cobre o canto de baixo
  // da coluna e intercepta o ponteiro. É também a prova de que o teclado abre a Ajuda.
  await botao.focus();
  await page.keyboard.press("Enter");
  const painel = page.locator("[data-ajuda-da-moldura]");
  await expect(painel).toBeVisible();
  await expect(painel.locator("[data-ajuda-lista]")).toContainText("Pessoas e acesso — como usar");
  await painel.getByRole("button", { name: /Registros — como usar/ }).click();
  await expect(painel.locator("[data-ajuda-artigo]")).toContainText("quem fez o quê e quando");
  await painel.locator("[data-ajuda-outros]").click();
  await expect(painel.locator("[data-ajuda-lista]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(painel).toHaveCount(0);
  await expect(botao).toBeFocused();
});
