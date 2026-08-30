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

  await page.getByRole("dialog").getByRole("link", { name: "Visão geral" }).click();
  await expect(page.getByRole("dialog", { name: "Navegação principal" })).toBeHidden();
});
