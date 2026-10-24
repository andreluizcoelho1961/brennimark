import { expect, test } from "@playwright/test";

/**
 * O site em dois idiomas (fatia 5, 24/10/2026). O idioma mora no endereço:
 * `/vini` é português, `/en/...` é inglês, e o `proxy` faz a ponte. Só o
 * Manifesto está traduzido por enquanto; as outras páginas levam à versão em
 * português com um aviso, e é isso que estes testes travam.
 */
test("o Manifesto em inglês: texto, lang, menu e rodapé no idioma, e o botão volta ao português", async ({ page }) => {
  await page.goto("/en/manifesto");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("A brand is forged with care");
  await expect(page.getByText("Brennimark is the help I always wanted to have.")).toBeVisible();
  // O menu e o rodapé falam inglês, e os endereços são os traduzidos.
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.locator('footer a[href="/en/help"]')).toHaveText("Help center");
  await expect(page.locator('footer a[href="/en/privacy"]')).toHaveText("Privacy");
  // O botão de idioma mostra o OUTRO idioma e leva à mesma página.
  const botao = page.locator("[data-seletor-de-idioma-do-site]").first();
  await expect(botao).toHaveText("PT");
  await expect(botao).toHaveAttribute("href", "/manifesto");
});

test("o Manifesto em português continua igual, e o botão leva ao inglês", async ({ page }) => {
  await page.goto("/manifesto");
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Uma marca é forjada com cuidado");
  const botao = page.locator("[data-seletor-de-idioma-do-site]").first();
  await expect(botao).toHaveText("EN");
  await expect(botao).toHaveAttribute("href", "/en/manifesto");
  await botao.click();
  await expect(page).toHaveURL(/\/en\/manifesto$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("página sem tradução leva à equivalente em português, com o aviso nos dois idiomas", async ({ page }) => {
  await page.goto("/en/security");
  await expect(page).toHaveURL(/\/seguranca\?idioma=indisponivel$/);
  const aviso = page.locator("[data-aviso-de-idioma]");
  await expect(aviso).toContainText("This page isn't available in English yet");
  await expect(aviso).toContainText("Esta página ainda não está disponível em inglês");
  await aviso.getByRole("button").click();
  await expect(aviso).toHaveCount(0);
});

test("a home em inglês ainda não existe: volta à home em português, com aviso", async ({ page }) => {
  await page.goto("/en");
  await expect(page).toHaveURL(/\/\?idioma=indisponivel$/);
  await expect(page.locator("[data-aviso-de-idioma]")).toBeVisible();
});

test("os redirecionamentos do idioma: status e destino, uma URL por página", async ({ request }) => {
  // Pasta em português com prefixo vira o endereço traduzido (permanente).
  const a = await request.get("/en/agencias", { maxRedirects: 0 });
  expect(a.status()).toBe(308);
  expect(a.headers()["location"]).toMatch(/\/en\/agencies$/);
  // /pt-BR direto volta ao endereço sem prefixo (permanente).
  const b = await request.get("/pt-BR/vini", { maxRedirects: 0 });
  expect(b.status()).toBe(308);
  expect(b.headers()["location"]).toMatch(/\/vini$/);
  // Sem tradução: provisório (307), porque a tradução vem depois.
  const c = await request.get("/en/security", { maxRedirects: 0 });
  expect(c.status()).toBe(307);
  expect(c.headers()["location"]).toMatch(/\/seguranca\?idioma=indisponivel$/);
  // O que não existe no site é 404, não redirecionamento.
  expect((await request.get("/en/nao-existe", { maxRedirects: 0 })).status()).toBe(404);
});

test("a plataforma não é reescrita nem ganha prefixo de idioma", async ({ request }) => {
  expect((await request.get("/en/login", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/login", { maxRedirects: 0 })).status()).toBe(200);
});

test("Agências, Empresas e Licença de fontes em inglês: texto, trilha, cartões e FAQ no idioma", async ({ page }) => {
  await page.goto("/en/agencies");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The brands in your portfolio");
  await expect(page.locator(".crumb")).toContainText("Who it's for");
  // Os cartões de páginas relacionadas apontam para os endereços traduzidos, e o Studio é âncora da própria página.
  await expect(page.locator('a.rel[href="/en/materials#entrega"]')).toHaveCount(1);
  await expect(page.locator('a.rel[href="/en/agencies#studio"]')).toHaveCount(1);
  await expect(page.locator("details summary").first()).toHaveText("How many brands fit?");
  await expect(page.locator("#studio")).toContainText("Studio is where the agency looks after all its brands.");

  await page.goto("/en/companies");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Agencies, suppliers and teams with the same reference");
  await page.goto("/en/font-license");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The brand font and its license.");

  // E o português continua o mesmo, na mesma árvore de páginas.
  await page.goto("/agencias");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("As marcas da sua carteira");
  await expect(page.locator('a.rel[href="/materiais#entrega"]')).toHaveCount(1);
});
