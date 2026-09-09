import { expect, test, type Page } from "@playwright/test";

/**
 * As fronteiras de erro, exercitadas com um erro de verdade.
 *
 * Fronteira de erro é a peça que, por definição, nunca aparece quando tudo vai
 * bem — e por isso é a que mais facilmente está quebrada sem ninguém saber.
 * Verificar só que os arquivos existem provaria que alguém os escreveu, não que
 * o React os monta no lugar certo.
 *
 * A rota `dev-falha` lança de propósito e é fechada em produção, pelo mesmo
 * padrão de `/dev/shell-v2`. A mensagem que ela lança contém texto que NÃO pode
 * chegar à tela — é assim que se testa o vazamento em vez de confiar nele.
 */
const FALHA = "/w/conta/b/marca/docs/dev-falha";

async function abrirAFalha(page: Page, largura: number) {
  await page.setViewportSize({ width: largura, height: 844 });
  await page.goto(FALHA);
  await expect(page.locator("[data-limite-de-erro]")).toBeVisible();
}

for (const [largura, nome] of [[390, "mobile"], [1440, "desktop"]] as const) {
  test(`a falha vira tela de produto em ${nome}`, async ({ page }) => {
    await abrirAFalha(page, largura);

    // A copy é do produto, não do framework.
    await expect(
      page.getByRole("heading", { name: /Não foi possível abrir/i }),
    ).toBeVisible();
    // A tela genérica do Next não aparece.
    await expect(page.getByText("Application error")).toHaveCount(0);
    await expect(page.getByText("Unhandled Runtime Error")).toHaveCount(0);
  });

  test(`a falha oferece saída segura em ${nome}`, async ({ page }) => {
    await abrirAFalha(page, largura);
    // Dois caminhos: tentar de novo e ir para outro lugar. Só o primeiro
    // deixaria a pessoa presa numa tela cujo único botão não funciona.
    await expect(page.locator("[data-tentar-de-novo]")).toBeVisible();
    await expect(page.locator("[data-saida-segura]")).toBeVisible();
  });
}

test("o erro técnico NÃO chega à tela", async ({ page }) => {
  await abrirAFalha(page, 1440);
  const texto = await page.evaluate(() => document.body.innerText);

  // A mensagem lançada carrega um caminho e um trecho de SQL. Nenhum dos dois
  // pode aparecer: a tela é o lugar mais público onde isso sairia, inclusive
  // numa captura colada num chat de equipe.
  expect(texto).not.toContain("hunter2");
  expect(texto).not.toContain("SELECT");
  expect(texto).not.toContain("manual_do_cliente");
  expect(texto).not.toContain("falha deliberada");
});

test("o erro técnico também não vai para o console do navegador", async ({ page }) => {
  const registrado: string[] = [];
  page.on("console", (m) => registrado.push(m.text()));
  await abrirAFalha(page, 1440);

  /**
   * Espera o log CHEGAR, em vez de supor que já chegou.
   *
   * `abrirAFalha` espera a fronteira de erro ficar visível, e a leitura do
   * console acontecia no instante seguinte. Os dois eventos são próximos mas
   * não ordenados: o log sai do tratamento de erro do React, e nada garante
   * que ele preceda a pintura.
   *
   * O sintoma foi um vermelho só em WebKit no CI, que passava três de três
   * localmente — a diferença sendo carga. Uma suíte que só passa em máquina
   * folgada não diz nada sobre o produto; diz sobre a máquina.
   */
  await expect
    .poll(() => registrado.filter((l) => l.includes("falha ao renderizar")).length, {
      timeout: 10_000,
    })
    .toBeGreaterThan(0);

  // Log de navegador vai para relatório de suporte e para captura de tela.
  const nosso = registrado.filter((l) => l.includes("falha ao renderizar"));
  expect(nosso.join(" ")).not.toContain("hunter2");
  expect(nosso.join(" ")).not.toContain("manual_do_cliente");
});

test("a falha fica contida: a moldura continua montada", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(FALHA);
  await expect(page.locator("[data-limite-de-erro]")).toBeVisible();

  // O ponto de a fronteira viver DENTRO do layout: quem estava lendo continua
  // com a barra e a navegação, e a falha ocupa só a área de conteúdo.
  await expect(page.getByRole("banner", { name: "Brennimark" })).toBeVisible();
});

test("a fronteira que pegou é a do manual, e não a da aplicação", async ({ page }) => {
  await abrirAFalha(page, 1440);
  // Fronteiras aninhadas: a mais próxima do erro é a que deve pegar. Se a raiz
  // pegasse, a moldura teria sido derrubada junto.
  await expect(page.locator("[data-limite-de-erro='manual']")).toBeVisible();
});
