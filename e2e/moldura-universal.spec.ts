import { expect, test, type Page } from "@playwright/test";

/**
 * A moldura é a mesma para qualquer marca — e nada atravessa entre elas.
 *
 * Estes testes existem por causa de uma classe de defeito que já apareceu
 * quatro vezes neste repositório e passou por CI verde todas: herança de um
 * cliente sobrevivendo dentro do que deveria ser universal. Aqui a verificação
 * é de pixel medido, não de leitura de código.
 *
 * As quatro marcas são opostas de propósito: preta sobre moldura escura,
 * branca institucional, saturada que vibra contra filete, e multicolorida em
 * inglês com vocabulário editorial próprio.
 */

const MARCAS = [
  { key: "sobria", nome: "Sóbria", acento: "rgb(232, 232, 232)" },
  { key: "institucional", nome: "Institucional", acento: "rgb(11, 79, 158)" },
  { key: "mercado", nome: "Mercado", acento: "rgb(255, 198, 41)" },
  { key: "festival", nome: "Festival", acento: "rgb(255, 45, 149)" },
] as const;

const LARGURAS = [320, 375, 390, 768, 1024, 1440];

function corDe(page: Page, seletor: string, prop: string) {
  return page.evaluate(
    ([s, p]) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el).getPropertyValue(p).trim() : "";
    },
    [seletor, prop] as const,
  );
}

// ─── Isolamento entre as camadas ───────────────────────────────────────────

for (const marca of MARCAS) {
  test(`a marca ${marca.nome} veste o canvas e não a moldura`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/dev/marcas?marca=${marca.key}`);

    // O canvas recebeu o tema da marca...
    const acentoNoCanvas = await corDe(page, "[data-brand-canvas]", "--brand-accent");
    expect(acentoNoCanvas.toLowerCase()).not.toBe("");

    // ...e a moldura não. Um token da marca definido na raiz significaria que
    // a próxima marca herdaria a anterior.
    const acentoNaRaiz = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--brand-accent").trim(),
    );
    expect(acentoNaRaiz, "nenhum token de marca pode viver no documento").toBe("");

    // A barra da plataforma usa o fundo da plataforma, seja qual for a marca.
    const fundoDaBarra = await corDe(page, "header", "background-color");
    const fundoDaPlataforma = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--platform-bg").trim(),
    );
    expect(fundoDaPlataforma).not.toBe("");
    expect(fundoDaBarra, "a barra mudou de cor com a marca").toBe(
      await page.evaluate((v) => {
        const d = document.createElement("div");
        d.style.color = v;
        document.body.appendChild(d);
        const c = getComputedStyle(d).color;
        d.remove();
        return c;
      }, fundoDaPlataforma),
    );
  });
}

test("a moldura é idêntica nas quatro marcas", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const medidas: string[] = [];

  for (const marca of MARCAS) {
    await page.goto(`/dev/marcas?marca=${marca.key}`);
    medidas.push(
      JSON.stringify({
        barra: await corDe(page, "header", "background-color"),
        textoDaBarra: await corDe(page, "header", "color"),
        borda: await corDe(page, "header", "border-bottom-color"),
        navegacao: await corDe(page, "nav", "background-color"),
      }),
    );
  }

  // Sem CSS por marca: se houvesse, uma dessas medidas destoaria.
  expect(new Set(medidas).size, `a moldura variou entre marcas: ${medidas.join(" | ")}`).toBe(1);
});

test("a marca em inglês não traduz a interface, e o selo fala a língua dela", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/marcas?marca=festival");

  // Manual em inglês, com vocabulário próprio.
  await expect(page.getByText("Documented").first()).toBeVisible();
  // Interface em português mesmo assim.
  await expect(page.getByRole("button", { name: "Buscar" })).toBeVisible();
});

// ─── Geometria ──────────────────────────────────────────────────────────────

for (const largura of LARGURAS) {
  test(`sem overflow horizontal em ${largura}px, nas quatro marcas`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });

    for (const marca of MARCAS) {
      await page.goto(`/dev/marcas?marca=${marca.key}`);
      const medida = await page.evaluate(() => ({
        documento: document.documentElement.scrollWidth,
        janela: window.innerWidth,
      }));
      expect(medida.documento, `${marca.nome} transborda em ${largura}px`).toBeLessThanOrEqual(
        medida.janela,
      );
    }
  });
}

test("a coluna do desktop não existe no mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=institucional");

  // 224px de coluna fixa numa tela de 390 deixavam 166px para o manual.
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir navegação" })).toBeVisible();
});

test("a coluna do desktop existe a partir de 1024px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/dev/marcas?marca=institucional");

  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir navegação" })).toBeHidden();
});

test("os controles da moldura têm alvo de toque de 44px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=mercado");

  for (const nome of ["Abrir navegação", "Buscar"]) {
    const caixa = await page.getByRole("button", { name: nome }).boundingBox();
    expect(caixa, `${nome} não foi encontrado`).not.toBeNull();
    expect(caixa!.width, `${nome} é estreito demais`).toBeGreaterThanOrEqual(44);
    expect(caixa!.height, `${nome} é baixo demais`).toBeGreaterThanOrEqual(44);
  }
});

// ─── A gaveta ───────────────────────────────────────────────────────────────

async function abrirGaveta(page: Page) {
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await expect(page.getByRole("dialog", { name: "Navegação principal" })).toBeVisible();
}

test("a gaveta prende o foco enquanto está aberta", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");
  await abrirGaveta(page);

  // Tabular muitas vezes precisa continuar dentro da gaveta. Sem prender o
  // foco, a pessoa sai para o conteúdo coberto — visualmente escondido e
  // ainda alcançável, que é o pior dos dois mundos.
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press("Tab");
    const dentro = await page.evaluate(() =>
      Boolean(document.activeElement?.closest("[data-drawer]")),
    );
    expect(dentro, `o foco escapou da gaveta na tabulação ${i + 1}`).toBe(true);
  }
});

test("Escape fecha a gaveta e devolve o foco ao botão", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");
  await abrirGaveta(page);

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Navegação principal" })).toBeHidden();

  const focoNoBotao = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label"),
  );
  expect(focoNoBotao, "o foco precisa voltar para quem abriu").toBe("Abrir navegação");
});

test("o véu fecha a gaveta", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");
  await abrirGaveta(page);

  // Clique na área descoberta à direita: o centro do véu fica sob a gaveta.
  await page.mouse.click(375, 400);
  await expect(page.getByRole("dialog", { name: "Navegação principal" })).toBeHidden();
});

test("a gaveta trava a rolagem do corpo e destrava ao fechar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");

  await abrirGaveta(page);
  // No iOS a página de trás rola sob a gaveta e a pessoa perde o lugar.
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");

  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("navegar fecha a gaveta", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");
  await abrirGaveta(page);

  // "Manual" é o destino do PDF. Era "Visão geral", que levava à primeira
  // seção remontada e saiu quando o PDF passou a ser o manual.
  await page.getByRole("dialog").getByRole("link", { name: "Manual", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Navegação principal" })).toBeHidden();
});

// ─── Um modal por vez ───────────────────────────────────────────────────────

/**
 * Os dois instrumentos modais da moldura são a gaveta e a busca, e ⌘K funciona
 * em qualquer lugar. Com a gaveta aberta, o atalho abria a busca por cima
 * dela: dois diálogos na página, ambos declarando aria-modal, e o foco preso
 * em um enquanto o outro continuava visível.
 *
 * Nenhum teste anterior cruzava os dois — cada um verificava o seu.
 */
test("abrir a busca com a gaveta aberta deixa exatamente um diálogo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");
  await abrirGaveta(page);

  await page.keyboard.press("ControlOrMeta+k");

  const dialogos = page.getByRole("dialog");
  await expect(dialogos).toHaveCount(1);
  await expect(page.getByRole("dialog", { name: "Navegação principal" })).toBeHidden();
  // E o foco está dentro do que sobrou.
  const dentro = await page.evaluate(() =>
    Boolean(document.activeElement?.closest('[role="dialog"]')),
  );
  expect(dentro, "o foco precisa estar dentro do único modal aberto").toBe(true);
});

test("fechar a busca aberta por cima da gaveta devolve o foco de forma coerente", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");
  await abrirGaveta(page);
  await page.keyboard.press("ControlOrMeta+k");
  await page.keyboard.press("Escape");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Abrir navegação" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );

  // "O botão está visível" não é devolução de foco: passaria com o foco no
  // corpo do documento, que é onde ele cai quando ninguém o recolhe.
  const focado = await page.evaluate(() => ({
    marcador: document.activeElement?.tagName,
    rotulo: document.activeElement?.getAttribute("aria-label"),
    noCorpo: document.activeElement === document.body,
  }));
  expect(focado.noCorpo, "o foco caiu no corpo em vez de voltar a um controle").toBe(false);
  expect(focado.marcador).toBe("BUTTON");
  expect(focado.rotulo).toBe("Abrir navegação");
});

test("o botão da navegação declara se ela está aberta", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");

  const botao = page.getByRole("button", { name: "Abrir navegação" });
  await expect(botao).toHaveAttribute("aria-expanded", "false");

  await botao.click();
  await expect(page.getByRole("dialog", { name: "Navegação principal" })).toBeVisible();
  // O valor `false` sozinho passaria mesmo se o atributo fosse constante.
  await expect(botao).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(botao).toHaveAttribute("aria-expanded", "false");
});

test("com a gaveta aberta, o resto da aplicação fica inerte", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");
  await abrirGaveta(page);

  // Prender o foco não impede a navegação virtual de um leitor de tela, que
  // percorre a árvore independente do foco.
  const conteudoInerte = await page.evaluate(() => {
    const main = document.querySelector("main");
    return Boolean(main?.closest("[inert]"));
  });
  expect(conteudoInerte, "o conteúdo coberto continua alcançável por leitor de tela").toBe(true);
});

test("o véu não entra na ordem de foco nem na árvore acessível", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");
  await abrirGaveta(page);

  // Como botão, ele gastava uma parada de teclado antes do primeiro destino e
  // anunciava "Fechar navegação" duas vezes.
  await expect(page.getByRole("button", { name: "Fechar navegação" })).toHaveCount(1);
  await page.keyboard.press("Tab");
  const primeiro = await page.evaluate(() => document.activeElement?.getAttribute("aria-hidden"));
  expect(primeiro).not.toBe("true");
});

/**
 * Área segura.
 *
 * O que dá para verificar aqui é o que depende do código: a declaração de
 * viewport, sem a qual o navegador reserva as margens do recorte por conta
 * própria e TODOS os env() chegam zerados ao CSS; e o fato de os max() da
 * moldura continuarem entregando o espaçamento normal quando não há recorte.
 *
 * O valor real do inset depende do aparelho e não é simulável aqui. Injetar
 * um recorte falso por CSS testaria o CSS injetado, não a moldura.
 */
test("a página declara viewport-fit cover", async ({ page }) => {
  await page.goto("/dev/marcas?marca=sobria");
  const viewport = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(viewport, "sem cover, env(safe-area-inset-*) vale zero em todo lugar").toContain(
    "viewport-fit=cover",
  );
});

test("sem recorte, os recuos da moldura continuam sendo os normais", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");

  // max(env(...), 16px) precisa cair em 16px quando o inset é zero. Um erro
  // aqui deixaria os controles encostados na borda em aparelho sem recorte.
  const barra = page.getByRole("banner", { name: "Brennimark" });
  expect(parseFloat(await barra.evaluate((el) => getComputedStyle(el).paddingLeft))).toBe(16);
  expect(parseFloat(await barra.evaluate((el) => getComputedStyle(el).paddingRight))).toBe(16);

  const botao = await page.getByRole("button", { name: "Abrir navegação" }).boundingBox();
  expect(botao!.x, "o controle não pode nascer fora da tela").toBeGreaterThanOrEqual(0);
});

test("a barra usa os insets do aparelho, e não valores fixos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=sobria");

  // A regra tem que MENCIONAR env(): é o que faz o recuo existir no aparelho
  // com recorte. Computar 16px não distingue "max(env, 16px)" de "16px".
  const usaEnv = await page.evaluate(() => {
    const header = document.querySelector('header[aria-label="Brennimark"]');
    if (!header) return false;
    return header.className.includes("safe-area-inset");
  });
  expect(usaEnv, "a barra ignora o recorte do aparelho").toBe(true);
});

// ─── Estado modal contra breakpoint ─────────────────────────────────────────

/**
 * Girar o aparelho com a navegação aberta travava o aplicativo.
 *
 * A gaveta era escondida por CSS acima de 1024px — e escondida não é fechada.
 * O estado continuava "nav", o resto seguia inerte, e a única coisa capaz de
 * destravar a tela tinha desaparecido: nenhum diálogo na página, nada
 * clicável, navegação de desktop visível e inerte.
 *
 * Nenhum teste pegava porque nenhum cruzava estado modal com largura: os de
 * gaveta ficavam em 390 e os de desktop nunca abriam a gaveta.
 */
test("girar para desktop com a gaveta aberta não trava o aplicativo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=institucional");
  await abrirGaveta(page);

  await page.setViewportSize({ width: 1024, height: 800 });

  // Ou ela continua visível, ou foi fechada. O que não pode existir é o meio
  // do caminho: inerte sem nada para fechar.
  const gaveta = page.getByRole("dialog", { name: "Navegação principal" });
  const aindaAberta = await gaveta.isVisible();
  const inerte = await page.locator("[inert]").count();

  if (inerte > 0) {
    expect(aindaAberta, "aplicação inerte sem caminho visível para destravar").toBe(true);
  }

  if (aindaAberta) {
    await page.keyboard.press("Escape");
    await expect(gaveta).toBeHidden();
  }

  // E, fechada, a aplicação volta inteira.
  await expect(page.locator("[inert]")).toHaveCount(0);
});

test("ao destravar depois da rotação, o foco vai para algo visível", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=institucional");
  await abrirGaveta(page);

  await page.setViewportSize({ width: 1024, height: 800 });
  await page.keyboard.press("Escape");

  await expect(page.locator("[inert]")).toHaveCount(0);

  // NADA de .focus() antes desta verificação: chamar foco no teste prova que o
  // elemento aceita foco, não que a moldura o devolveu. A origem — o botão da
  // navegação mobile — continua no documento e some acima de 1024px, então
  // devolver para ela manda o foco ao corpo e a pessoa perde a posição.
  const foco = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      corpo: el === document.body,
      comCaixa: (el?.getClientRects().length ?? 0) > 0,
      naNavegacao: Boolean(el?.closest("[data-nav-destination]")),
      noConteudo: Boolean(el?.closest("[data-shell-main]")),
    };
  });

  expect(foco.corpo, "quem usa teclado perdeu a posição").toBe(false);
  expect(foco.comCaixa, "o foco foi para um elemento sem caixa").toBe(true);
  expect(
    foco.naNavegacao || foco.noConteudo,
    "o foco precisa cair na navegação do desktop ou no conteúdo",
  ).toBe(true);
});

test("a navegação do desktop continua clicável depois de destravar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=institucional");
  await abrirGaveta(page);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.keyboard.press("Escape");

  // A moldura inteira destrava — coluna e barra de cima. Os materiais moram
  // no segmentado da barra desde 18/09 (plano da interface §2).
  const coluna = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(coluna).toBeVisible();
  await page.getByRole("navigation", { name: "Conteúdo da marca" }).getByRole("link", { name: "Materiais" }).click();
  await expect(page).toHaveURL(/biblioteca/);
});

test("no mobile, fechar normalmente devolve o foco ao botão que abriu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/marcas?marca=institucional");
  await abrirGaveta(page);
  await page.keyboard.press("Escape");

  // Sem mudança de largura, a origem continua visível e é para lá que se volta.
  const foco = await page.evaluate(() => ({
    rotulo: document.activeElement?.getAttribute("aria-label"),
    corpo: document.activeElement === document.body,
  }));
  expect(foco.corpo).toBe(false);
  expect(foco.rotulo).toBe("Abrir navegação");
});

test("a busca aberta direto devolve o foco a quem a abriu", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/marcas?marca=institucional");

  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");

  const foco = await page.evaluate(() => ({
    rotulo: document.activeElement?.getAttribute("aria-label"),
    corpo: document.activeElement === document.body,
  }));
  expect(foco.corpo).toBe(false);
  expect(foco.rotulo).toBe("Buscar");
});

// ─── Carregar não é restaurar ───────────────────────────────────────────────

/**
 * A moldura devolve o foco depois de um modal. Ela não escolhe onde o foco
 * começa.
 *
 * O efeito de devolução também roda na montagem, e sem uma saída explícita ele
 * caía na cadeia de reserva: a página carregava e já focava a navegação (no
 * desktop) ou o conteúdo (no mobile). Isso atropela a ordem natural do teclado
 * e faz um leitor de tela começar no meio da página, sem o anúncio que
 * normalmente precede.
 */
for (const [largura, nome] of [
  [390, "mobile"],
  [1440, "desktop"],
] as const) {
  test(`ao carregar em ${nome}, a moldura não rouba o foco`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: 844 });
    await page.goto("/dev/marcas?marca=institucional");

    // Espera a hidratação: o defeito é de efeito do React, e antes dela não
    // haveria o que verificar.
    await expect(page.getByRole("button", { name: "Buscar" })).toBeVisible();
    await page.waitForTimeout(300);

    const foco = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return {
        marcador: el?.tagName ?? null,
        naNavegacao: Boolean(el?.closest("[data-nav-destination]")),
        noConteudo: Boolean(el?.closest("[data-shell-main]")),
      };
    });

    expect(foco.noConteudo, "a página focou o conteúdo sozinha").toBe(false);
    expect(foco.naNavegacao, "a página focou a navegação sozinha").toBe(false);
    // O foco de partida é do documento, como em qualquer página.
    expect(["BODY", "HTML"]).toContain(foco.marcador);
  });
}

// ─── As funcionalidades pertencem à marca ───────────────────────────────────

/**
 * Cada fixture declara um conjunto diferente de funcionalidades, e elas
 * atravessam parseBrandRow como o resto. A seleção vinha da instância global —
 * `unconfigured`, com zero utilidades —, então a seção "Inteligência" ficava
 * vazia para qualquer marca.
 */
test("cada marca mostra as funcionalidades que declarou, e só elas", async ({ page }) => {
  /*
   * Desde 18/09 as funcionalidades de IA moram no Vini, no canto inferior
   * direito — não na coluna. A regra que este caso protege continua a mesma:
   * cada marca oferece o que declarou, e nada herdado da anterior.
   */
  await page.setViewportSize({ width: 1440, height: 900 });
  const vini = async () => {
    await page.locator("[data-botao-do-vini]").click();
    return page.locator("[data-vini-lista]");
  };

  await page.goto("/dev/marcas?marca=institucional"); // só chat
  let lista = await vini();
  await expect(lista.getByRole("link", { name: "Perguntar" })).toBeVisible();
  await expect(lista.getByRole("link", { name: "Analisar peça" })).toHaveCount(0);

  await page.goto("/dev/marcas?marca=mercado"); // análise e histórico, sem chat
  lista = await vini();
  await expect(lista.getByRole("link", { name: "Analisar peça" })).toBeVisible();
  await expect(lista.getByRole("link", { name: "Histórico" })).toBeVisible();
  await expect(lista.getByRole("link", { name: "Perguntar" })).toHaveCount(0);

  await page.goto("/dev/marcas?marca=festival"); // todas
  lista = await vini();
  for (const destino of ["Perguntar", "Analisar peça", "Histórico"]) {
    await expect(lista.getByRole("link", { name: destino })).toBeVisible();
  }
  // Provedores de IA é configuração, não conversa: fica na coluna até
  // Configurações existir.
  const coluna = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(coluna.getByRole("link", { name: "Provedores de IA" })).toBeVisible();
  // E nada de IA sobrou na coluna.
  await expect(coluna.getByRole("link", { name: "Chat da marca" })).toHaveCount(0);
  await expect(coluna.getByRole("link", { name: "Análise de aplicações" })).toHaveCount(0);

  // E a volta: a marca só com chat não herdou nada das anteriores.
  await page.goto("/dev/marcas?marca=institucional");
  lista = await vini();
  await expect(lista.getByRole("link", { name: "Histórico" })).toHaveCount(0);
});

test("o Vini fecha com Esc e devolve o foco ao botão", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/marcas?marca=festival");
  await page.locator("[data-botao-do-vini]").click();
  await expect(page.locator("[data-vini-lista]")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-vini-lista]")).toHaveCount(0);
  await expect(page.locator("[data-botao-do-vini]")).toBeFocused();
});

test("sem marca aberta não há Vini: não há sobre o que perguntar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/moldura");
  await expect(page.locator("[data-botao-do-vini]")).toHaveCount(0);
});

test("marca sem funcionalidades não mostra a seção Inteligência", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/marcas?marca=sobria");

  const coluna = page.getByRole("navigation", { name: "Navegação principal" });
  await expect(coluna).toBeVisible();
  await expect(coluna.getByText("Inteligência")).toHaveCount(0);
  // A navegação continua existindo: a marca tem manual e acervo — que moram
  // no segmentado da barra de cima desde 18/09, e não mais na coluna.
  const conteudo = page.getByRole("navigation", { name: "Conteúdo da marca" });
  await expect(conteudo.getByRole("link", { name: "Manual", exact: true })).toBeVisible();
  await expect(conteudo.getByRole("link", { name: "Materiais" })).toBeVisible();
});
