import { expect, test, type Page } from "@playwright/test";

/**
 * A experiência de ler o manual.
 *
 * ─── O que mudou, e por que os casos mudaram com ele ────────────────────────
 *
 * Até aqui a barra listava as SEÇÕES EXTRAÍDAS do PDF, agrupadas e cortadas por
 * lote, e metade destes casos media essa lista. Ela saiu da navegação quando o
 * PDF passou a ser o manual: navegar por 122 seções propostas por heurística
 * competia com o sumário que o próprio documento já tem.
 *
 * O que os casos medem agora é o que ficou de pé:
 *
 *   - a coluna e a gaveta oferecem os MESMOS destinos, e o manual vem primeiro;
 *   - uma seção extraída que não está mais na barra continua ALCANÇÁVEL pela
 *     busca — esta é a garantia nova, e é o contrapeso da remoção: sem ela, a
 *     extração teria sido escondida em vez de reposicionada;
 *   - teclado, foco e 404 continuam exatamente como eram.
 *
 * O agrupamento e o corte por lote continuam cobertos por teste de unidade
 * (`documentos.test.ts`): o módulo segue no repositório para a curadoria do
 * Studio, e é lá que ele volta a ter tela.
 *
 * Fora de cobertura aqui, e dito de propósito: `/docs` redirecionar para
 * `/docs/original` exige marca resolvida, e a suíte roda sem banco. Essa
 * passagem é verificada na bancada e em produção.
 *
 * A rota de fixtures é usada de propósito: ela monta a MESMA moldura, com os
 * mesmos componentes, sobre páginas que existem sem banco.
 *
 * ─── Armadilha da bancada: o endereço aqui NÃO é o de produção ──────────────
 *
 * A bancada passa `basePath="/dev/marcas"`, e `withBase` reescreve o prefixo
 * `/docs` dos destinos canônicos. O destino do manual, que em produção é
 * `/w/<conta>/b/<marca>/docs/original`, aqui é `/dev/marcas/original`.
 *
 * Por isso os seletores casam o FIM do href (`$='/original'`) e não o caminho
 * inteiro: a primeira versão destes casos procurava `/docs/original` e falhou
 * nove vezes — três casos nos três motores — apontando defeito onde não havia.
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

test("a barra leva ao manual, e o manual é o PDF", async ({ page }) => {
  await desktop(page);
  // Desde 18/09 o manual mora no segmentado da barra de cima — a barra do
  // CONTEÚDO da marca (plano da interface §2) —, e não mais na coluna.
  const navegacao = page.getByRole("navigation", { name: /Conteúdo da marca|Brand content/ });
  await expect(navegacao).toBeVisible();

  // O destino do manual aponta para o documento-fonte, não para uma seção
  // remontada. Se algum dia voltar a apontar para `/docs`, a pessoa volta a
  // entrar pela interpretação da máquina sem nada avisar.
  const manual = navegacao.locator("[data-parte-do-segmentado='manual'][href$='/original']");
  await expect(manual).toHaveCount(1);
  await expect(manual).toBeVisible();
});

test("a barra não lista mais as seções extraídas", async ({ page }) => {
  await desktop(page);
  // Não é limpeza de teste: é a decisão. A lista de seções propostas pela
  // máquina saiu da navegação, e o caso existe para que ela não volte por
  // acidente junto com outra mudança.
  await expect(page.locator("[data-doc-destino]")).toHaveCount(0);
});

test("o manual vem antes dos materiais no segmentado", async ({ page }) => {
  /*
   * A ordem na tela é a ordem que a pessoa lê. O teste mede posição real, e
   * não a ordem do array: um `order` de CSS ou um flex invertido mudaria a
   * tela sem mudar a estrutura, e o teste continuaria verde.
   *
   * Até 18/09 media a posição VERTICAL na coluna; o manual e os materiais
   * passaram para o segmentado da barra de cima, então a medida é horizontal.
   */
  await desktop(page);

  const posicaoDe = (seletor: string) =>
    page.evaluate(
      (s) => document.querySelector(s)?.getBoundingClientRect().left ?? Infinity,
      seletor,
    );

  const manual = await posicaoDe("[data-parte-do-segmentado='manual']");
  const materiais = await posicaoDe("[data-parte-do-segmentado='materiais']");

  expect(manual, "o manual precisa existir no segmentado").toBeLessThan(Infinity);
  expect(manual, "o manual está depois dos materiais").toBeLessThan(materiais);
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
      document.activeElement?.hasAttribute("data-nav-destination") ?? false,
    );
    if (chegou) return;
  }
  throw new Error(`nenhum destino da navegação recebeu foco com ${tecla}`);
});

test("o foco fica visível em cada destino", async ({ page }) => {
  await desktop(page);
  const primeiro = page.locator("[data-nav-destination]").first();
  await primeiro.focus();
  // Contorno de foco não é decoração: sem ele, quem navega por teclado não
  // sabe onde está.
  const contorno = await primeiro.evaluate((el) => {
    const estilo = getComputedStyle(el, ":focus-visible");
    return { largura: estilo.outlineWidth, estilo: estilo.outlineStyle };
  });
  expect(contorno.estilo).not.toBe("none");
});

test("a gaveta mobile oferece os mesmos destinos da coluna", async ({ page }) => {
  await mobile(page);
  await page.getByRole("button", { name: /navega|navigation/i }).click();
  const gaveta = page.getByRole("dialog");
  await expect(gaveta.locator("[data-nav-destination][href$='/original']")).toBeVisible();
  // Duas navegações diferentes para o mesmo produto seriam dois produtos: o que
  // saiu da coluna precisa ter saído da gaveta também. Foi assim que as páginas
  // excluídas sumiram do mobile no patch 2, em sentido contrário.
  await expect(gaveta.locator("[data-doc-destino]")).toHaveCount(0);
});

test("escolher um destino fecha a gaveta", async ({ page }) => {
  await mobile(page);
  await page.getByRole("button", { name: /navega|navigation/i }).click();
  await page.getByRole("dialog").locator("[data-nav-destination]").first().click();
  // Gaveta aberta por cima do conteúdo que a pessoa acabou de pedir é o
  // defeito mais comum de menu mobile.
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a busca ainda encontra uma seção que saiu da barra", async ({ page }) => {
  await desktop(page);
  await abrirBuscaPeloAtalho(page);
  const busca = page.getByRole("dialog");
  /*
   * Esta é a garantia que sustenta a remoção.
   *
   * "Aplicação 15" não está mais em nenhuma lista da moldura. Se a busca também
   * deixasse de encontrá-la, a extração teria sido ESCONDIDA — e o produto
   * passaria a responder "não achei" sobre algo que existe, que é o pior dos
   * dois erros, porque não avisa.
   */
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

    // A tela genérica do Next tira a pessoa do produto: sem barra, sem destino,
    // e a única saída é o botão de voltar do navegador.
    await expect(page.getByText("This page could not be found")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: /não está neste manual|não existe/i }),
    ).toBeVisible();
  });
}
