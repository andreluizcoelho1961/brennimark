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
  await page.goto("/en/terms");
  await expect(page).toHaveURL(/\/termos\?idioma=indisponivel$/);
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
  const c = await request.get("/en/terms", { maxRedirects: 0 });
  expect(c.status()).toBe(307);
  expect(c.headers()["location"]).toMatch(/\/termos\?idioma=indisponivel$/);
  // O que não existe no site é 404, não redirecionamento.
  expect((await request.get("/en/nao-existe", { maxRedirects: 0 })).status()).toBe(404);
});

test("a plataforma não é reescrita nem ganha prefixo de idioma", async ({ request }) => {
  expect((await request.get("/en/login", { maxRedirects: 0 })).status()).toBe(404);
  expect((await request.get("/login", { maxRedirects: 0 })).status()).toBe(200);
});

/**
 * Cada página traduzida tem o seu teste: um só com várias páginas estourava o limite
 * de 30 s quando a suíte inteira roda, e não dizia qual delas falhou.
 */
test("Agências em inglês: texto, trilha, cartões com endereços traduzidos, FAQ e o Studio", async ({ page }) => {
  await page.goto("/en/agencies");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The brands in your portfolio");
  await expect(page.locator(".crumb")).toContainText("Who it's for");
  await expect(page.locator('a.rel[href="/en/materials#entrega"]')).toHaveCount(1);
  await expect(page.locator('a.rel[href="/en/agencies#studio"]')).toHaveCount(1);
  await expect(page.locator("details summary").first()).toHaveText("How many brands fit?");
  await expect(page.locator("#studio")).toContainText("Studio is where the agency looks after all its brands.");
});

test("Agências em português continua igual, na mesma árvore de páginas", async ({ page }) => {
  await page.goto("/agencias");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("As marcas da sua carteira");
  await expect(page.locator('a.rel[href="/materiais#entrega"]')).toHaveCount(1);
});

const PAGINAS_EM_INGLES: { url: string; titulo: string; extra?: (page: import("@playwright/test").Page) => Promise<void> }[] = [
  { url: "/en/companies", titulo: "Agencies, suppliers and teams with the same reference" },
  { url: "/en/font-license", titulo: "The brand font and its license." },
  { url: "/en/vini", titulo: "Vini Max helps you work with the brand",
    extra: async (page) => { await expect(page.locator("details summary").first()).toHaveText("Does Vini make up rules when it doesn't know?"); } },
  { url: "/en/security", titulo: "Your client's brand is confidential",
    extra: async (page) => { await expect(page.locator('a.rel[href="/en/companies"]')).toHaveCount(1); } },
  { url: "/en/manual", titulo: "The manual the studio designed",
    extra: async (page) => {
      // O bloco fundido de Complementos mora na mesma página, com a âncora e o texto em inglês.
      await expect(page.locator("#complementos")).toContainText("What the manual doesn't say, the agency writes");
      await expect(page.locator('a.rel[href="/en/materials"]')).toHaveCount(1);
    } },
  { url: "/en/materials", titulo: "Everything the brand needs",
    extra: async (page) => {
      await expect(page.locator("#entrega")).toContainText("Every supplier with the current version of the brand.");
      // A etiqueta da versão antiga e a data saem no idioma da página.
      await expect(page.getByText("DISCONTINUED", { exact: true })).toBeVisible();
      await expect(page.getByText("since Mar 2026", { exact: false }).first()).toBeVisible();
      // O link do FAQ aponta para o endereço traduzido da própria página.
      await expect(page.locator('a.more[href="/en/materials#entrega"]')).toHaveCount(1);
    } },
];

for (const { url, titulo, extra } of PAGINAS_EM_INGLES) {
  test(`${url} abre em inglês`, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(titulo);
    await extra?.(page);
  });
}

test("Materiais em português: etiqueta da versão antiga e bloco de entrega seguem ancorados", async ({ page }) => {
  await page.goto("/materiais");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Tudo que a marca precisa");
  await expect(page.getByText("DESCONTINUADO", { exact: true })).toBeVisible();
  await expect(page.locator("#entrega")).toContainText("Cada fornecedor com a versão atual da marca.");
});
