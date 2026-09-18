import { expect, test, type Page } from "@playwright/test";

/**
 * A V2 é a interface real do manual.
 *
 * Até aqui ela existia numa rota de laboratório e /docs montava o DocsNav —
 * duas interfaces no mesmo produto, e a que estava sendo revisada não era a
 * que as pessoas usavam.
 *
 * O que estes testes NÃO cobrem, e é honesto dizer: o manual vestido pela
 * marca nas rotas reais. Isso exige uma marca no banco e uma sessão real, e o
 * projeto tem zero usuários. A renderização vestida está coberta em
 * /dev/marcas, que usa os mesmos componentes e o mesmo tradutor de linha.
 * Aqui o que se prova é a moldura, a navegação e o comportamento.
 *
 * As rotas carregam o contexto desde o M1: /w/<conta>/b/<marca>/docs. Os
 * segmentos abaixo são de laboratório — no preview local não há sessão nem
 * banco, e o que estes testes verificam é a moldura, que é a mesma. Manter as
 * URLs antigas aqui provaria que a estrutura antiga ainda monta, que é
 * justamente o que deixou de ser verdade.
 */

const CONTEXTO = "/w/laboratorio/b/exemplo";
const ROTAS_DO_MANUAL = [`${CONTEXTO}/docs`];
/*
 * Só a biblioteca.
 *
 * Chat, análise, histórico e configurações passaram a ser CONTRATADAS por
 * marca, e uma porta no servidor as fecha com 404 quando a marca não as
 * declara. No preview local não existe marca, logo elas não existem — e é o
 * comportamento certo, não uma limitação do teste.
 *
 * A biblioteca não é utilidade contratável: ela é o acervo da marca, e existe
 * sempre que a marca existe.
 *
 * A moldura NAS utilidades continua coberta, em /dev/marcas, onde há marca com
 * utilidades declaradas — mesma moldura, mesmos componentes. E o fechamento
 * por URL é o assunto de utilidades-contratadas.spec.ts.
 */
const ROTAS_UTILITARIAS = [`${CONTEXTO}/docs/biblioteca`];
const TODAS = [...ROTAS_DO_MANUAL, ...ROTAS_UTILITARIAS];

async function molduraV2(page: Page) {
  // A barra da plataforma é a assinatura da V2.
  await expect(page.getByRole("banner", { name: "Brennimark" })).toBeVisible();
}

for (const rota of TODAS) {
  test(`${rota} monta a V2, e não o DocsNav`, async ({ page }) => {
    const resposta = await page.goto(rota);
    expect(resposta?.status()).toBe(200);
    await molduraV2(page);

    // O rail de siglas de duas letras era a marca registrada da V1.
    const railDaV1 = await page.evaluate(() =>
      Boolean(document.querySelector('[data-docsnav], nav[aria-label="Guia da marca"]')),
    );
    expect(railDaV1, "a V1 ainda está montada nesta rota").toBe(false);
  });
}

test("as rotas utilitárias são superfícies da plataforma, fora do canvas", async ({ page }) => {
  for (const rota of ROTAS_UTILITARIAS) {
    await page.goto(rota);
    // Administração, IA, biblioteca e histórico são instrumentos do produto:
    // eles não podem estar dentro do escopo de tema da marca.
    const dentroDoCanvas = await page.evaluate(() =>
      Boolean(document.querySelector("[data-brand-canvas] h1")),
    );
    expect(dentroDoCanvas, `${rota} está vestida pela marca`).toBe(false);
  }
});

test("sem capacidade não há destino nenhum, e isso é a regra funcionando", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${CONTEXTO}/docs`);

  // O preview local não concede papel — nem `consultar`. Um destino DA MARCA
  // aqui seria link que termina em 403, e nenhum aparece.
  //
  // Mudou em 18/09 (plano da interface §2): a moldura existe sempre, e
  // "Marcas" é da PLATAFORMA — o lugar de onde se escolhe a marca. Ele não
  // depende de capacidade em marca nenhuma, então é o único destino aqui.
  await expect(page.locator("[data-nav-destination]")).toHaveCount(1);
  await expect(page.locator('[data-item-da-coluna="marcas"]')).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);
  await expect(page.locator('[data-grupo-da-coluna="gestao"]'), "gestão sem ser administrador da conta").toHaveCount(0);
});

test("a sessão vive na barra, não numa faixa própria", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${CONTEXTO}/docs`);
  // A V1 empilhava um cabeçalho só para o e-mail acima do conteúdo.
  const faixas = await page.locator("header").count();
  expect(faixas, "sobrou uma faixa de sessão da V1").toBe(1);
});

// ─── Promoção × gaveta × rota filha × largura ──────────────────────────────

test("sem capacidade na marca, a moldura ainda leva de volta a Marcas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${CONTEXTO}/docs/chat`);
  await molduraV2(page);

  /*
   * Até 18/09 esta regra era o contrário: sem destino, sem gaveta, porque uma
   * gaveta vazia sugere que algo falhou. Ela continua valendo — mas a gaveta
   * não está mais vazia. "Marcas" é da plataforma e existe sempre: é a saída
   * de qualquer tela, e foi a falta dela que deixou o ensaio de 18/09 "sem
   * saída" dentro de um manual.
   */
  await expect(page.getByRole("button", { name: "Abrir navegação" })).toHaveCount(1);
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await expect(page.getByRole("dialog").getByRole("link", { name: "Marcas" })).toBeVisible();
});

/**
 * A gaveta ABERTA numa rota filha — navegar por dentro dela, fechar, conferir
 * URL e foco — precisa de destinos, e destinos precisam de capacidade, que o
 * preview local não concede por decisão de produto. Esse cruzamento está
 * coberto em moldura-universal.spec, na rota de fixtures, com os mesmos
 * componentes e capacidades de owner.
 *
 * Nas rotas reais ele depende de uma sessão de verdade — o mesmo bloqueio do
 * manual vestido pela marca.
 */

for (const [largura, nome] of [
  [390, "mobile"],
  [1440, "desktop"],
] as const) {
  for (const rota of [`${CONTEXTO}/docs`, `${CONTEXTO}/docs/biblioteca`]) {
    test(`carregar ${rota} direto em ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width: largura, height: 844 });
      const resposta = await page.goto(rota);
      expect(resposta?.status()).toBe(200);
      await molduraV2(page);

      // Geometria e foco de partida, na rota real.
      const medida = await page.evaluate(() => ({
        documento: document.documentElement.scrollWidth,
        janela: window.innerWidth,
        focoNoCorpo: document.activeElement === document.body,
      }));
      expect(medida.documento).toBeLessThanOrEqual(medida.janela);
      expect(medida.focoNoCorpo, "a moldura roubou o foco no carregamento").toBe(true);

      // A coluna existe sempre desde 18/09 (plano da interface §2) — no
      // desktop visível, no celular escondida atrás do botão da gaveta. Sem
      // capacidade, ela só oferece "Marcas". A regra de breakpoint está em
      // moldura-universal.spec.
      if (nome === "desktop") {
        await expect(page.getByRole("navigation", { name: "Navegação principal" })).toHaveCount(1);
      } else {
        await expect(page.getByRole("button", { name: "Abrir navegação" })).toHaveCount(1);
      }
    });
  }
}
