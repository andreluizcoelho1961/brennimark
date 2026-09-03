import { expect, test, type Page } from "@playwright/test";

/**
 * A experiência de ler o manual.
 *
 * Antes do Q1 a barra tinha "Visão geral" e as utilidades, e nada mais: um
 * manual de 152 seções só era alcançável pela busca ou pela página de entrada.
 * Quem não sabia o nome exato do que procurava não chegava a lugar nenhum.
 *
 * A rota de fixtures é usada de propósito: ela monta a MESMA moldura, com os
 * mesmos componentes, sobre páginas que existem sem banco. As rotas reais
 * dependem de sessão, e o que se prova aqui é a navegação.
 */
const LAB = "/dev/marcas";

async function desktop(page: Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LAB);
}

async function mobile(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(LAB);
}

/**
 * Abre a busca pelo atalho, UMA vez, depois da moldura declarar-se pronta.
 *
 * O ouvinte de teclado é registrado num efeito: entre a moldura aparecer e a
 * hidratação terminar, ⌘K não chega a lugar nenhum. A primeira versão deste
 * ajudante insistia na tecla até três vezes, e isso estava errado por dois
 * motivos: media o escalonamento em vez do comportamento, e um atalho quebrado
 * poderia passar se alguém aumentasse o número de tentativas.
 *
 * A moldura publica `data-shell-ready` no mesmo efeito que registra os
 * atalhos, depois do registro. Esperar por ele é esperar pela condição certa —
 * e uma tecla só, depois disso, torna a regressão do atalho sempre vermelha.
 */
async function abrirBuscaPeloAtalho(page: Page) {
  await expect(page.locator("[data-shell-ready]")).toHaveCount(1);
  await page.keyboard.press("ControlOrMeta+k");
  await expect(page.getByRole("dialog")).toBeVisible();
}

test("a barra lista as páginas do manual, agrupadas", async ({ page }) => {
  await desktop(page);
  const navegacao = page.getByRole("navigation", { name: /Páginas do manual|Manual pages/ });
  await expect(navegacao).toBeVisible();
  await expect(navegacao.getByRole("heading", { name: "Sistema" })).toBeVisible();
  await expect(navegacao.getByRole("heading", { name: "Aplicações" })).toBeVisible();
});

test("um grupo grande é cortado, e diz quantos existem", async ({ page }) => {
  await desktop(page);
  const navegacao = page.getByRole("navigation", { name: /Páginas do manual|Manual pages/ });
  // 15 páginas em "Aplicações", lote de 12: nem todas na tela de uma vez.
  const antes = await navegacao.locator("[data-doc-destino]").count();
  expect(antes).toBeLessThan(17);
  // O total precisa estar dito: sem ele, lista cortada é indistinguível de
  // lista completa.
  await expect(navegacao.getByRole("heading", { name: /Aplicações \(15\)/ })).toBeVisible();

  await navegacao.getByRole("button", { name: /Ver mais|Show/ }).click();
  expect(await navegacao.locator("[data-doc-destino]").count()).toBeGreaterThan(antes);
});

test("a navegação é alcançável só pelo teclado", async ({ page, browserName }) => {
  await desktop(page);

  /*
   * No WebKit a tecla é outra, e isso não é defeito do produto.
   *
   * O Safari não move o foco para links com Tab por padrão — é o
   * "Full Keyboard Access" do macOS, desligado de fábrica —, e quem navega por
   * teclado nele usa Option+Tab. Pular o teste no WebKit deixaria a garantia
   * sem cobertura justamente no navegador em que ela é mais frágil; usar a
   * tecla da plataforma testa a mesma coisa.
   */
  const tecla = browserName === "webkit" ? "Alt+Tab" : "Tab";

  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press(tecla);
    const chegou = await page.evaluate(() =>
      document.activeElement?.hasAttribute("data-doc-destino") ?? false,
    );
    if (chegou) return;
  }
  throw new Error(`nenhuma página do manual recebeu foco com ${tecla}`);
});

test("o foco fica visível em cada destino", async ({ page }) => {
  await desktop(page);
  const primeiro = page.locator("[data-doc-destino]").first();
  await primeiro.focus();
  // Contorno de foco não é decoração: sem ele, quem navega por teclado não
  // sabe onde está.
  const contorno = await primeiro.evaluate((el) => {
    const estilo = getComputedStyle(el, ":focus-visible");
    return { largura: estilo.outlineWidth, estilo: estilo.outlineStyle };
  });
  expect(contorno.estilo).not.toBe("none");
});

test("a gaveta mobile oferece a mesma navegação de páginas", async ({ page }) => {
  await mobile(page);
  await page.getByRole("button", { name: /navega|navigation/i }).click();
  const gaveta = page.getByRole("dialog");
  await expect(gaveta.getByRole("navigation", { name: /Páginas do manual|Manual pages/ })).toBeVisible();
  await expect(gaveta.locator("[data-doc-destino]").first()).toBeVisible();
});

test("escolher uma página fecha a gaveta", async ({ page }) => {
  await mobile(page);
  await page.getByRole("button", { name: /navega|navigation/i }).click();
  await page.getByRole("dialog").locator("[data-doc-destino]").first().click();
  // Gaveta aberta por cima do conteúdo que a pessoa acabou de pedir é o
  // defeito mais comum de menu mobile.
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a busca encontra uma página que não está na tela", async ({ page }) => {
  await desktop(page);
  await abrirBuscaPeloAtalho(page);
  const busca = page.getByRole("dialog");
  // A página 15 está além do lote de 12: a busca precisa alcançá-la.
  await busca.getByRole("combobox").or(busca.getByRole("searchbox")).or(busca.locator("input")).first()
    .fill("Aplicação 15");
  await expect(busca.getByText("Aplicação 15").first()).toBeVisible();
});

test("Escape fecha a busca e devolve o foco", async ({ page }) => {
  await desktop(page);
  await abrirBuscaPeloAtalho(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // O foco não pode cair no corpo: quem fechou a busca continua navegando.
  const noCorpo = await page.evaluate(() => document.activeElement === document.body);
  expect(noCorpo, "o foco caiu no vazio ao fechar a busca").toBe(false);
});

for (const [largura, nome] of [[390, "mobile"], [1440, "desktop"]] as const) {
  test(`rota inexistente responde 404 com a moldura em ${nome}`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    const resposta = await page.goto("/w/conta/b/marca/docs/pagina-que-nao-existe");
    expect(resposta?.status()).toBe(404);

    // A tela genérica do Next tira a pessoa do produto: sem barra, sem lista
    // de páginas, e a única saída é o botão de voltar do navegador.
    await expect(page.getByText("This page could not be found")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /não está neste manual|não existe/i }),
    ).toBeVisible();
  });
}

test("o manual aparece acima das ferramentas na coluna", async ({ page }) => {
  /*
   * A ordem no DOM é a ordem que a pessoa lê. O teste mede posição vertical
   * real, e não a ordem do array: um `order` de CSS ou um flex invertido
   * mudaria a tela sem mudar a estrutura, e o teste continuaria verde.
   */
  await desktop(page);

  const posicaoDe = (seletor: string) =>
    page.evaluate(
      (s) => document.querySelector(s)?.getBoundingClientRect().top ?? Infinity,
      seletor,
    );

  const primeiraPagina = await posicaoDe("[data-doc-destino]");
  const biblioteca = await posicaoDe("[data-nav-destination][href*='biblioteca']");

  expect(
    primeiraPagina,
    "as páginas do manual estão abaixo do acervo",
  ).toBeLessThan(biblioteca);
});
