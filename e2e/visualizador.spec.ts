import { expect, test, type Page } from "@playwright/test";

/**
 * O visualizador do manual original, nos três motores.
 *
 * Estes casos existem porque **sete defeitos passaram** por lint, tipos, 626
 * testes de unidade e 252 de navegador antes de aparecerem na primeira abertura
 * de um manual real. Nenhum era sutil no efeito — um deles tornava impossível
 * abrir qualquer manual acima de 4 MiB — e nenhum era alcançável sem um PDF de
 * verdade dentro de um navegador de verdade.
 *
 * A fixture de mil páginas é o sujeito porque a virtualização só tem sentido em
 * escala: com cinco páginas, montar tudo e montar uma janela dão o mesmo
 * resultado, e o teste passaria com a virtualização desligada.
 */

const MANUAL = "/dev/visualizador?fixture=mil-paginas.pdf";

async function abrir(page: Page) {
  await page.goto(MANUAL);
  // A primeira página pintada é o sinal de que documento, transporte e
  // renderização se entenderam. `getPage()` resolver não é página visível.
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".textLayer span").first()).toBeVisible({ timeout: 30_000 });
}

/** Quantos canvases têm dimensão de verdade — os liberados vão a zero. */
async function montados(page: Page): Promise<number> {
  return page.evaluate(
    () => [...document.querySelectorAll("canvas")].filter((c) => c.width > 10).length,
  );
}

/**
 * A medida da primeira página DESENHADA — canvas com tamanho de verdade.
 *
 * `abrir` espera um canvas VISÍVEL, e visível não é desenhado: o elemento
 * entra na árvore antes de o PDF.js pintar, com 0×0. Medir nesse instante dá
 * 0/0 = NaN. Foi o que derrubou "a página mantém a proporção" no Firefox em
 * 19/09/2026, só na suíte inteira — a mesma corrida de carga de 09/09. Aqui
 * se espera um canvas com pixels E com caixa na tela, e é ESSE que se mede.
 */
async function medirPaginaDesenhada(page: Page) {
  const desenhado = () => page.evaluate(() => {
    const c = [...document.querySelectorAll("canvas")].find((el) => {
      const r = el.getBoundingClientRect();
      return el.width > 10 && el.height > 10 && r.width > 0 && r.height > 0;
    });
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return {
      largura: r.width,
      proporcaoNaTela: r.height / r.width,
      proporcaoDoCanvas: c.height / c.width,
      rolagemHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
  // A medida devolvida é a MESMA que satisfez a espera. Medir de novo depois
  // abriria outra corrida: o visualizador libera canvases (volta a 0×0) ao
  // reciclar páginas, e entre as duas chamadas o desenhado pode sumir — foi o
  // que a suíte inteira pegou na primeira versão desta função.
  let medida: Awaited<ReturnType<typeof desenhado>> = null;
  await expect.poll(async () => (medida = await desenhado()), {
    timeout: 30_000, message: "nenhuma página chegou a ser desenhada",
  }).not.toBeNull();
  return medida!;
}

async function irPara(page: Page, numero: number) {
  const campo = page.locator("#pagina-atual");
  await campo.fill(String(numero));
  await campo.press("Enter");
  await page.waitForTimeout(2500);
}

test("o documento abre e declara todas as páginas", async ({ page }) => {
  await abrir(page);
  await expect(page.getByText("de 1000")).toBeVisible();
});

/**
 * A regressão que este teste tranca: sem virtualização, mil páginas viram mil
 * canvases, e um canvas custa largura × altura × 4 bytes de memória de vídeo
 * que `performance.memory` não enxerga. A aba cai sem deixar rastro.
 */
test("mil páginas não viram mil canvases", async ({ page }) => {
  await abrir(page);
  expect(await montados(page)).toBeLessThanOrEqual(8);
});

/**
 * A regressão: com layout em fluxo e alturas estimadas, montar uma página
 * mudava a altura do documento e deslocava tudo abaixo — inclusive a posição
 * para onde a rolagem tinha acabado de ir. Pedir a 700 entregava a 705, sem
 * erro nenhum. O texto da fixture nomeia a própria página, então o teste
 * verifica o CONTEÚDO, não a intenção.
 */
test("o salto para uma página distante cai na página pedida", async ({ page }) => {
  await abrir(page);

  for (const alvo of [700, 1, 437, 1000]) {
    await irPara(page, alvo);
    await expect(page.locator(`.textLayer:has-text("Secao ${alvo}")`).first()).toBeVisible({
      timeout: 15_000,
    });
    expect(await montados(page)).toBeLessThanOrEqual(8);
  }
});

/**
 * A regressão: o botão de AUMENTAR diminuía a página. Vindo de "ajustar à
 * largura", a escala efetiva era ~1,8 e o passo saltava para 1,25; e o de
 * diminuir não fazia nada, por comparação não estrita.
 */
test("o zoom anda nos dois sentidos", async ({ page }) => {
  await abrir(page);
  const largura = () => page.evaluate(() => document.querySelector("canvas")!.width);

  const inicial = await largura();

  await page.getByRole("button", { name: /Aumentar zoom|Zoom in/ }).click();
  await page.waitForTimeout(2000);
  const maior = await largura();
  expect(maior).toBeGreaterThan(inicial);

  await page.getByRole("button", { name: /Diminuir zoom|Zoom out/ }).click();
  await page.waitForTimeout(2000);
  expect(await largura()).toBeLessThan(maior);
});

/**
 * A camada de texto é o que separa "imagem do manual" de "documento": sem ela
 * o canvas é opaco para leitor de tela, ninguém seleciona nem copia, e a busca
 * não acha palavra nenhuma.
 */
test("a camada de texto existe e acompanha a página", async ({ page }) => {
  await abrir(page);
  await irPara(page, 300);
  const texto = await page.locator(".textLayer").first().innerText();
  expect(texto).toContain("Secao");
});

/**
 * A página é do cliente: proporção original, sem recorte e sem reenquadramento.
 * Um `object-cover` em qualquer ponto desta árvore quebra este teste.
 */
test("a página mantém a proporção e não estoura a largura", async ({ page }) => {
  await abrir(page);

  const medida = await medirPaginaDesenhada(page);

  expect(Math.abs(medida.proporcaoNaTela - medida.proporcaoDoCanvas)).toBeLessThan(0.02);
  expect(medida.rolagemHorizontal).toBe(false);
});

test("em 375px a página continua inteira, sem remontar o documento", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await abrir(page);

  const medida = await medirPaginaDesenhada(page);

  expect(medida.largura).toBeLessThanOrEqual(375);
  expect(medida.rolagemHorizontal).toBe(false);
  // Mobile mantém o layout ORIGINAL: a proporção da página não muda com a tela.
  expect(medida.proporcaoNaTela).toBeGreaterThan(1);
});

/**
 * A regressão mais cara: a primeira requisição do PDF.js vai deliberadamente
 * SEM `Range`, para ler os cabeçalhos e decidir que pode pedir intervalos. A
 * rota media o tamanho dessa resposta contra o teto de fatia e devolvia 413 —
 * tornando impossível abrir qualquer manual acima de 4 MiB.
 */
/**
 * A invariante que protege PRODUÇÃO, e ela custou uma sessão para aparecer.
 *
 * Passando `url` ao PDF.js, ele faz uma primeira requisição **sem `Range`**
 * para descobrir se o servidor aceita intervalos, e aborta o corpo depois. Em
 * localhost isso é inofensivo. Numa função da Vercel é fatal: a rota começa a
 * repassar o arquivo inteiro, a função estoura a duração, o corpo chega
 * truncado, e o manual passa **sessenta segundos sem abrir** — medido em
 * produção.
 *
 * Este teste não verifica desempenho, que varia com a máquina. Verifica a
 * FORMA das requisições: se alguma sair sem `Range`, o defeito voltou.
 */
test("nenhuma requisição sem Range chega ao transporte", async ({ page }) => {
  const semIntervalo: string[] = [];
  const status: number[] = [];

  page.on("request", (r) => {
    if (!r.url().includes("/dev/fixture/")) return;
    // `HEAD` é o único legítimo sem `Range`: ele traz o tamanho e não tem
    // corpo, então nenhum byte atravessa a função.
    if (r.method() !== "HEAD" && !r.headers()["range"]) semIntervalo.push(r.method());
  });
  page.on("response", (r) => {
    if (r.url().includes("/dev/fixture/")) status.push(r.status());
  });

  await abrir(page);
  await irPara(page, 500);

  expect(semIntervalo).toEqual([]);
  expect(status.every((s) => s === 200 || s === 206)).toBe(true);
  expect(status).toContain(206);
});

/**
 * O manual ACIMA DO TETO DE FATIA.
 *
 * Esta é a regressão mais cara da rota, e ela era de desenho: o teto recusava
 * com 413 em vez de aparar. O PDF.js pede o documento inteiro num único
 * intervalo em algumas situações, recebia a recusa e caía numa sequência de
 * tentativas — um manual real de 4,07 MiB, apenas 70 KB acima do teto, abria
 * "super lento" em produção e às vezes não abria.
 *
 * `acima-do-teto.pdf` reproduz a PROPRIEDADE do manual real (4,12 MiB) sem
 * carregar material de cliente para o repositório. É o que torna este caso
 * repetível: o manual que expôs o defeito não pode ser versionado.
 */
test.describe("manual acima do teto de fatia", () => {
  const ACIMA = "/dev/visualizador?fixture=acima-do-teto.pdf";

  test("abre e desenha, sem recusa de intervalo", async ({ page }) => {
    const status: number[] = [];
    const semIntervalo: string[] = [];
    page.on("response", (r) => {
      if (r.url().includes("/dev/fixture/")) status.push(r.status());
    });
    page.on("request", (r) => {
      if (!r.url().includes("/dev/fixture/")) return;
      if (r.method() !== "HEAD" && !r.headers()["range"]) semIntervalo.push(r.method());
    });

    await page.goto(ACIMA);
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".textLayer span").first()).toBeVisible({ timeout: 30_000 });

    // 413 é a recusa que fechava a porta. Nenhuma resposta pode trazê-la.
    expect(status).not.toContain(413);
    expect(status.every((s) => s === 200 || s === 206)).toBe(true);
    // E o arquivo inteiro nunca é pedido de uma vez — é o que matava a função
    // em produção justamente com manual deste tamanho.
    expect(semIntervalo).toEqual([]);
  });

  test("um intervalo maior que o teto volta APARADO, e diz o que traz", async ({ page }) => {
    await page.goto(ACIMA);

    const r = await page.evaluate(async () => {
      const resp = await fetch("/dev/fixture/acima-do-teto.pdf", {
        headers: { Range: "bytes=0-99999999" },
        cache: "no-store",
      });
      return {
        status: resp.status,
        contentRange: resp.headers.get("content-range"),
        recebido: (await resp.arrayBuffer()).byteLength,
      };
    });

    const TETO = 4 * 1024 * 1024;
    expect(r.status).toBe(206);
    expect(r.recebido).toBe(TETO);
    // O `Content-Range` descreve EXATAMENTE o que veio. É isso que separa
    // "prometer menos" de "entregar menos do que se promete".
    expect(r.contentRange).toMatch(new RegExp(`^bytes 0-${TETO - 1}/\\d+$`));
  });

  test("a página não estoura a largura da coluna", async ({ page }) => {
    await page.goto(ACIMA);
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });

    const estoura = await page.evaluate(() => {
      const rolo = [...document.querySelectorAll("div")].find(
        (d) => d.scrollHeight > d.clientHeight + 50,
      );
      return rolo ? rolo.scrollWidth > rolo.clientWidth + 1 : false;
    });
    expect(estoura).toBe(false);
  });
});

/**
 * Sair da tela ANTES de o documento abrir não deixa carregamento correndo.
 *
 * Achado da revisão de 22/09: a limpeza de saída só destruía um documento JÁ
 * aberto. Fechar no meio do carregamento deixava os pedidos de intervalo
 * seguindo (até 20 s cada), o documento terminando de abrir sem dono e o
 * worker vivo. A bancada fecha o visualizador SEM recarregar — como trocar de
 * tela no produto —, e os pedaços chegam devagar para o fechamento cair no
 * meio do carregamento.
 */
test("fechar no meio do carregamento para todos os pedidos", async ({ page }) => {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));

  let fechado = false;
  let depoisDeFechar = 0;
  let pedidos = 0;
  page.on("request", (r) => {
    if (!r.url().includes("/dev/fixture/") || r.method() !== "GET") return;
    pedidos += 1;
    if (fechado) depoisDeFechar += 1;
  });
  // Cada pedaço demora: o fechamento pega o carregamento no meio.
  await page.route("**/dev/fixture/**", async (rota) => {
    if (rota.request().method() === "GET") await new Promise((r) => setTimeout(r, 700));
    await rota.continue().catch(() => undefined);
  });

  await page.goto("/dev/visualizador?fixture=mil-paginas.pdf&desmontavel=1");
  // Premissa: o carregamento começou e ainda não terminou.
  await expect.poll(() => pedidos, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.locator("canvas")).toHaveCount(0);

  await page.locator("[data-fechar-visualizador]").click();
  fechado = true;
  await expect(page.locator("[data-visualizador-fechado]")).toBeVisible();

  // Tempo de sobra para três pedaços atrasados chegarem e pedirem os próximos.
  await page.waitForTimeout(3_000);
  expect(depoisDeFechar, "o carregamento seguiu pedindo pedaços depois de a tela sair").toBe(0);
  expect(erros).toEqual([]);
});
