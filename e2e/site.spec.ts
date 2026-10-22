import { expect, test, type Page } from "@playwright/test";
import { CAPITULOS_DA_HOME, PAGINAS_DO_SITE } from "../src/lib/site/paginas";

/**
 * O site público, remontado do protótipo (29/09/2026) — fatia 1: a home e a
 * porta para a plataforma.
 *
 * A suíte roda com `BRENNIMARK_DEV_SKIP_AUTH`, que desliga o `proxy`: aqui não
 * se prova quem passa sem sessão (isso é `caminhos-publicos.test.ts`), e sim o
 * que o site faz no navegador.
 *
 * A fidelidade visual ao protótipo foi medida elemento a elemento na
 * remontagem (616 caixas, em quatro larguras); estes testes guardam o
 * comportamento, que é o que uma refatoração quebra sem ninguém ver.
 */

/**
 * Abre uma página do site e espera o JavaScript DELE estar ligado.
 *
 * Não espera `load` nem `domcontentloaded` — só a resposta começar a chegar
 * (`commit`). Medido em 10/10/2026, no rastro de uma falha: com a suíte inteira
 * em paralelo, o documento da home respondeu em 0,4 s, mas o corpo continuou
 * chegando por mais de 30 s (o servidor de desenvolvimento entregava scripts
 * em 9–14 s e imagens em até 8 s), e `domcontentloaded` só dispara quando o
 * corpo termina. O teste estourava o tempo no `goto`, e as asserções, rodando
 * depois, passavam todas. `load` (29/09/2026) era o mesmo defeito, maior.
 *
 * O que estes testes precisam é o comportamento ligado, e `data-site-vivo`
 * diz exatamente isso.
 */
async function abrir(page: Page, url: string) {
  const resposta = await page.goto(url, { waitUntil: "commit" });
  await expect(page.locator("html")).toHaveAttribute("data-site-vivo", "", { timeout: 25_000 });
  return resposta;
}

/**
 * Um teste do site de cada vez (10/10/2026), medido: quatro navegadores
 * abrindo a home ao mesmo tempo no servidor de desenvolvimento fazem o
 * documento levar 30 s para terminar de chegar, e os scripts, 17 s — um
 * pedido sozinho termina em 0,4 s. Em produção a home é estática e nada disso
 * existe; aqui, a disputa era entre os próprios testes deste arquivo (rodando
 * só "as setas andam" 40 vezes em quatro processos, 11 falharam). Os outros
 * arquivos seguem em paralelo.
 */
// `default`, e não `serial`: um de cada vez, mas uma falha não pula os seguintes.
test.describe.configure({ mode: "default" });

/**
 * Aquece a home e uma página interna ANTES dos testes, com folga.
 *
 * No servidor de desenvolvimento a primeira visita compila a página. Com a
 * suíte inteira em paralelo (e o Supabase local no Docker disputando
 * processador), essa compilação a frio já levou 40 s (30/09/2026) — os quatro
 * primeiros testes estouravam o tempo no `goto`, com todas as asserções
 * verdes. Em produção a página é estática e não compila nada.
 */
test.beforeAll(async ({ request }) => {
  test.setTimeout(180_000);
  await request.get("/", { timeout: 170_000 });
  await request.get("/vini", { timeout: 170_000 });
});

async function semErros(page: Page) {
  const erros: string[] = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  return erros;
}

test("a home abre na primeira seção, com o título inteiro visível", async ({ page }) => {
  const erros = await semErros(page);
  await abrir(page, "/");
  await expect(page).toHaveTitle("Brennimark · Plataforma de gestão de marca");
  const titulo = page.getByRole("heading", { level: 1 });
  await expect(titulo).toHaveText("Uma marca passa por muitas mãos. A ideia tem que passar por todas.");
  // A animação termina com cada palavra no lugar; um título preso no ponto de
  // partida é texto invisível para quem visita.
  await expect(titulo).toHaveClass(/\bin\b/);
  expect(erros).toEqual([]);
});

test("Entrar leva ao login; com sessão, a porta vira Abrir a plataforma", async ({ page, context }) => {
  // Abrir e recarregar compilam páginas do `next dev` pela primeira vez; com a
  // máquina carregada, passa dos 30 s padrão (achado em 01/10/2026).
  test.setTimeout(90_000);
  await abrir(page, "/vini");
  const porta = page.locator(".site-head [data-porta]");
  await expect(porta).toHaveText("Entrar");
  await expect(porta).toHaveAttribute("href", "/login");

  // O rótulo lê o cookie de sessão do Supabase; quem autoriza é o `proxy`.
  await context.addCookies([{ name: "sb-127-auth-token", value: "base64-e30", url: page.url() }]);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(porta).toHaveText("Abrir a plataforma");
  await expect(porta).toHaveAttribute("href", "/docs");
});

test("o diálogo de demonstração abre no centro e fecha", async ({ page }) => {
  await abrir(page, "/");
  await page.locator(".site-head").getByRole("button", { name: /Agendar demonstração/ }).click();
  const dialogo = page.getByRole("dialog", { name: "Vamos mostrar o Brennimark funcionando." });
  await expect(dialogo).toBeVisible();
  const caixa = await dialogo.boundingBox();
  const tela = page.viewportSize()!;
  expect(Math.abs(caixa!.x + caixa!.width / 2 - tela.width / 2)).toBeLessThan(2);
  await dialogo.getByRole("button", { name: "Fechar" }).click();
  await expect(dialogo).toBeHidden();
});

test("o menu Plataforma leva a uma página com endereço próprio", async ({ page }) => {
  // O clique leva a /vini, que o `next dev` pode estar compilando pela primeira
  // vez: com a máquina carregada, a navegação passou dos 5 s da asserção três
  // vezes em 01/10/2026. O prazo maior vale só para a navegação.
  test.setTimeout(90_000);
  await abrir(page, "/");
  await page.locator(".site-head").getByRole("button", { name: /Plataforma/ }).hover();
  const menu = page.locator("#m-plat");
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: /Vini Max/ }).click();
  await expect(page).toHaveURL(/\/vini$/, { timeout: 30_000 });
  await expect(page).toHaveTitle("Vini Max · Brennimark");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("O Vini Max ajuda você a trabalhar com a marca.");

  // A migalha "Plataforma · Vini Max" abre o menu do cabeçalho, sem navegar.
  await page.locator(".crumb").getByRole("link", { name: "Plataforma" }).click();
  await expect(page.locator("#m-plat")).toBeVisible();
  await expect(page).toHaveURL(/\/vini$/);
});

test("cada página do site responde, com o próprio título", async ({ page }) => {
  // Dezesseis aberturas seguidas; sob a suíte inteira, cada uma pode levar segundos.
  test.setTimeout(120_000);
  // Sem erro no console: a conversão do protótipo para JSX é onde nasceria um
  // erro de hidratação (tabela sem <tbody>, atributo trocado).
  const erros = await semErros(page);
  for (const { slug, titulo } of PAGINAS_DO_SITE) {
    const resposta = await abrir(page, `/${slug}`);
    expect(resposta?.status(), `/${slug}`).toBe(200);
    await expect(page).toHaveTitle(`${titulo} · Brennimark`);
  }
  expect(erros).toEqual([]);
});

test("o site fica fora dos buscadores, e a prévia de link funciona", async ({ page, request }) => {
  // Decisão do André (29/09/2026): no ar para teste, fora dos buscadores até a
  // divulgação. A prévia (WhatsApp, LinkedIn) não depende de indexação.
  test.setTimeout(120_000);
  for (const rota of ["/", ...PAGINAS_DO_SITE.map((p) => `/${p.slug}`)]) {
    await abrir(page, rota);
    await expect(page.locator('meta[name="robots"]'), rota).toHaveAttribute("content", /noindex/);
    await expect(page.locator('meta[property="og:title"]'), rota).toHaveAttribute("content", await page.title());
    await expect(page.locator('meta[property="og:description"]'), rota).toHaveAttribute("content", /.{20,}/);
    await expect(page.locator('meta[name="twitter:card"]'), rota).toHaveAttribute("content", "summary_large_image");
  }
  const imagem = await page.locator('meta[property="og:image"]').getAttribute("content");
  const resposta = await request.get(new URL(imagem!).pathname);
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["content-type"]).toBe("image/png");
});

test("todo depoimento leva a marcação de fictício, sem nome de pessoa", async ({ page }) => {
  // Busca as 17 páginas; sob a suíte inteira, cada compilação leva segundos.
  test.setTimeout(120_000);
  // Decisão do André (29/09/2026): o site pode ir ao ar para teste ainda com
  // depoimentos de layout, e ninguém pode tomá-los por verdadeiros.
  await abrir(page, "/");
  const semMarcacao = await page.evaluate(async (rotas) => {
    const faltas: string[] = [];
    for (const rota of rotas) {
      const doc = new DOMParser().parseFromString(await (await fetch(rota)).text(), "text/html");
      doc.querySelectorAll(".bm-site figure.quote, .bm-site figure.big-quote").forEach((f) => {
        if (!f.querySelector("figcaption")?.textContent?.includes("Depoimento fictício")) faltas.push(rota);
      });
    }
    return faltas;
  }, ["/", ...PAGINAS_DO_SITE.map((p) => `/${p.slug}`)]);
  expect(semMarcacao).toEqual([]);
  // A home deixou de ter depoimentos em 22/10/2026 (texto de marcação não vende);
  // as páginas internas que ainda os tenham seguem obrigadas à marcação acima.
});

test("nenhuma classe do site coincide com uma regra de fora dele", async ({ page }) => {
  // Busca as 17 páginas; sob a suíte inteira, cada compilação leva segundos.
  test.setTimeout(120_000);
  // O site usa os nomes do protótipo (`grow`, `wrap`, `tag`…) e a plataforma
  // gera utilitários do Tailwind com nomes curtos. `grow` já colidiu uma vez
  // (29/09/2026) e esticou os botões das maquetes. Esta guarda acusa a próxima.
  await abrir(page, "/");
  const colisoes = await page.evaluate(async (rotas) => {
    const alheias = new Set<string>();
    const percorrer = (regras: CSSRuleList) => {
      for (const r of Array.from(regras)) {
        const regra = r as CSSStyleRule & { cssRules?: CSSRuleList };
        if (regra.cssRules && !regra.selectorText) percorrer(regra.cssRules);
        if (!regra.selectorText || regra.selectorText.includes("bm-site")) continue;
        for (const m of regra.selectorText.matchAll(/\.((?:\\.|[\w-])+)/g)) alheias.add(m[1].replace(/\\/g, ""));
      }
    };
    for (const folha of Array.from(document.styleSheets)) {
      try {
        percorrer(folha.cssRules);
      } catch {
        // Folha de outra origem: não é da plataforma.
      }
    }
    const achadas: string[] = [];
    for (const rota of rotas) {
      const doc = new DOMParser().parseFromString(await (await fetch(rota)).text(), "text/html");
      doc.querySelectorAll(".bm-site [class]").forEach((el) =>
        el.classList.forEach((c) => alheias.has(c) && achadas.push(`${rota} .${c}`)),
      );
    }
    return [...new Set(achadas)];
  }, ["/", ...PAGINAS_DO_SITE.map((p) => `/${p.slug}`)]);
  expect(colisoes).toEqual([]);
});

test.describe("movimento reduzido", () => {
  test("nada fica escondido à espera de animação", async ({ page }) => {
    // Antes de abrir: o script da moldura decide na primeira pintura.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await abrir(page, "/");
    await expect(page.locator("html")).not.toHaveAttribute("data-site-movimento", /.*/);
    const palavra = page.locator(".hero h1 .w > span").first();
    await expect(palavra).toHaveCSS("transform", "none");
  });
});

test.describe("celular", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("a foto do topo ocupa a largura, e o menu abre e fecha", async ({ page }) => {
    await abrir(page, "/");
    const foto = page.locator(".hero-photo");
    await expect.poll(async () => (await foto.boundingBox())?.width).toBe(390);

    const alternador = page.getByRole("button", { name: "Menu" });
    await alternador.click();
    const menu = page.locator("#mnav");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/login");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });
});

test("os planos levam à assinatura com o plano escolhido; o Corporativo e a nota levam à conversa", async ({ page }) => {
  await abrir(page, "/");
  for (const plano of ["basico", "medio", "premium"]) {
    await expect(page.locator(`[data-assinar="${plano}"]`)).toHaveAttribute("href", `/assinar?plano=${plano}`);
    await expect(page.locator(`[data-assinar="${plano}"]`)).toHaveText("Assinar");
  }
  await expect(page.locator("#planos").getByRole("button", { name: "Falar com a equipe" }).first()).toHaveAttribute("data-open", "dlg-demo");
  await expect(page.locator(".plans-note [data-open='dlg-demo']")).toHaveText("Fale com a equipe");
});

test("Termos e Privacidade mostram o texto com a versão, e o /assinar aponta para os dois", async ({ page }) => {
  for (const caminho of ["/termos", "/privacidade"]) {
    // `commit`: as asserções abaixo esperam o que precisam (ver `abrir`).
    await page.goto(caminho, { waitUntil: "commit" });
    const doc = page.locator("[data-documento-legal]");
    await expect(doc).toHaveAttribute("data-versao", /^\d{4}-\d{2}-\d{2}$/);
    await expect(doc.locator("h2").first()).toHaveText(/^1\. /);
  }
  await page.goto("/dev/assinar", { waitUntil: "commit" });
  await expect(page.locator("[data-aceite-dos-termos] a[href='/termos']")).toBeVisible();
  await expect(page.locator("[data-aceite-dos-termos] a[href='/privacidade']")).toBeVisible();
});

test("revisão dos Termos: aviso de renovação no /assinar, empresa no rodapé, link entre os documentos", async ({ page }) => {
  await page.goto("/dev/assinar", { waitUntil: "commit" });
  await expect(page.locator("[data-aviso-de-renovacao]")).toContainText("Assinatura mensal com renovação automática");
  await page.goto("/privacidade", { waitUntil: "commit" });
  await expect(page.locator("[data-empresa]")).toContainText("CNPJ 47.924.458/0001-09");
  const link = page.locator("[data-documento-legal] a", { hasText: "Dados tratados em nome do assinante" });
  await expect(link).toHaveAttribute("href", "/termos#dados-tratados-em-nome-do-assinante");
  await link.click();
  await expect(page.locator("#dados-tratados-em-nome-do-assinante li")).toHaveCount(5);
});

test("a home rola na vertical: todas as seções, na ordem, sem rolagem de lado", async ({ page }) => {
  await abrir(page, "/");
  const ids = await page.locator(".home-flow > .panel").evaluateAll((els) => els.map((e) => e.id));
  expect(ids).toEqual(CAPITULOS_DA_HOME.map((c) => c.id));
  // Sem trilho, sem barra de capítulos, sem depoimento de marcação.
  await expect(page.locator("#track, .chapnav, #depoimentos")).toHaveCount(0);
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
});

test("'Planos' do cabeçalho leva à seção de planos, na mesma página", async ({ page }) => {
  await abrir(page, "/");
  await page.evaluate(() => ((window as unknown as { __mesmaPagina: boolean }).__mesmaPagina = true));
  await page.locator(".site-head .nav-link", { hasText: "Planos" }).click();
  await expect(page).toHaveURL(/\/#planos$/);
  await expect(page.locator("#planos")).toBeInViewport();
  expect(await page.evaluate(() => (window as unknown as { __mesmaPagina?: boolean }).__mesmaPagina)).toBe(true);
});

test("as funcionalidades e as ferramentas da home levam a páginas que existem", async ({ page, request }) => {
  await abrir(page, "/");
  const destinos = await page.locator("#funcionalidades a, #ferramentas a").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")));
  expect(destinos.length).toBeGreaterThanOrEqual(9);
  for (const href of new Set(destinos)) {
    const r = await request.get(href as string);
    expect(r.status(), String(href)).toBe(200);
  }
});
