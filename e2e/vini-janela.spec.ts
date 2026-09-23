import { expect, test, type Page } from "@playwright/test";

/**
 * A janela do Vini — fatia 4a.
 *
 * O que o ensaio de 18/09 pediu: a conversa acontece DENTRO da janela, a
 * resposta chega formatada (e não com `###` e `**` crus), e a citação leva o
 * PDF à página sem fechar a conversa.
 *
 * Rede fingida, como no resto da suíte. A marca "festival" chama o rascunho de
 * "Under review" — a citação precisa ser reconhecida no vocabulário DELA.
 */
const MARCA = "/dev/marcas?marca=festival";

const RESPOSTA = [
  "The guide doesn't name a single primary color, but it defines two:",
  "",
  "### Provisional rules",
  "",
  "* **Principle colours:** black and support colour [Fonte: Cores — UNDER REVIEW · /docs/cores]",
  "* **Logo:** white on black [Fonte: Logo — UNDER REVIEW · /docs/logo]",
  "",
  "*Interpretation: \"principle colours\" is the manual's term.*",
].join("\n");

async function comResposta(page: Page, corpo = RESPOSTA, enviados?: unknown[]) {
  await page.route("**/api/ai/chat**", async (rota) => {
    enviados?.push(rota.request().postDataJSON());
    await rota.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      // Só "/docs/cores" tem página: o trecho do logo veio sem ela.
      headers: { "X-Brennimark-Paginas": encodeURIComponent(JSON.stringify({ "/docs/cores": 12 })) },
      body: corpo,
    });
  });
}

async function perguntar(page: Page, texto: string) {
  await page.locator("[data-botao-do-vini]").click();
  const campo = page.getByRole("textbox", { name: "Pergunta para o Vini" });
  await campo.fill(texto);
  await campo.press("Enter");
}

test("a pergunta sai da janela e a resposta volta formatada, dentro dela", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comResposta(page, RESPOSTA, enviados);
  await page.goto(MARCA);
  const url = page.url();

  await perguntar(page, "what is the primary color?");

  const resposta = page.locator("[data-vini-janela] [data-resposta-do-vini]");
  await expect(resposta).toBeVisible();
  // Nada de navegar: a conversa acontece aqui.
  expect(page.url()).toBe(url);
  expect(enviados[0]).toEqual({ messages: [{ role: "user", content: "what is the primary color?" }] });

  // Formatado: título, negrito, itálico e lista — sem os símbolos crus.
  await expect(resposta.getByRole("heading", { name: "Provisional rules" })).toBeVisible();
  await expect(resposta.locator("strong", { hasText: "Principle colours:" })).toBeVisible();
  await expect(resposta.locator("em")).toContainText("principle colours");
  await expect(resposta.locator("li")).toHaveCount(2);
  await expect(resposta).not.toContainText("###");
  await expect(resposta).not.toContainText("**");
});

test("a citação leva ao manual NA PÁGINA — e a página vem do servidor, não do texto", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comResposta(page);
  await page.goto(MARCA);
  await perguntar(page, "cores?");

  const citacoes = page.locator("[data-vini-janela] [data-citacao]");
  await expect(citacoes).toHaveCount(2);

  // Com página conhecida: o manual, naquela página, e a página à vista.
  const cores = citacoes.filter({ hasText: "Cores" });
  await expect(cores).toHaveAttribute("href", /\/dev\/marcas\/original\?pagina=12&ir=/);
  await expect(cores).toContainText("p. 12");
  // O selo fala o vocabulário da marca.
  await expect(cores).toContainText("UNDER REVIEW");

  // Sem página conhecida: o manual, sem página inventada.
  const logo = citacoes.filter({ hasText: "Logo" });
  await expect(logo).toHaveAttribute("href", "/dev/marcas/original");
  await expect(logo).not.toContainText("p.");
});

test("clicar fora não fecha: a pessoa lê a resposta e confere no manual", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comResposta(page);
  await page.goto(MARCA);
  await perguntar(page, "cores?");
  await expect(page.locator("[data-resposta-do-vini]")).toBeVisible();

  await page.mouse.click(400, 400);
  await expect(page.locator("[data-vini-janela]")).toBeVisible();

  // Recolher e abrir de novo não perde a conversa.
  await page.locator("[data-botao-do-vini]").click();
  await expect(page.locator("[data-vini-janela]")).toHaveCount(0);
  await page.locator("[data-botao-do-vini]").click();
  await expect(page.locator("[data-resposta-do-vini]")).toBeVisible();
});

test("Shift+Enter quebra a linha; Enter envia", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comResposta(page, RESPOSTA, enviados);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();

  const campo = page.getByRole("textbox", { name: "Pergunta para o Vini" });
  await campo.type("linha um");
  await campo.press("Shift+Enter");
  await campo.type("linha dois");
  expect(enviados).toEqual([]);
  await campo.press("Enter");

  await expect.poll(() => enviados.length).toBe(1);
  expect(enviados[0]).toEqual({ messages: [{ role: "user", content: "linha um\nlinha dois" }] });
});

test("a recusa do servidor aparece como ele a escreveu, com como tentar de novo", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/ai/chat**", (rota) => rota.fulfill({
    status: 503, contentType: "application/json",
    body: JSON.stringify({ message: "A IA desta conta ainda não está configurada." }),
  }));
  await page.goto(MARCA);
  await perguntar(page, "cores?");

  const erro = page.locator("[data-vini-erro]");
  await expect(erro).toContainText("ainda não está configurada");
  await expect(erro.getByRole("button", { name: "Tentar de novo" })).toBeVisible();
});

test("no celular a janela cabe na tela", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await comResposta(page);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();

  const caixa = await page.locator("[data-vini-janela]").boundingBox();
  expect(caixa).not.toBeNull();
  expect(caixa!.x).toBeGreaterThanOrEqual(0);
  expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(375);
});

test("resposta que o provedor interrompeu aparece como incompleta, nunca como inteira", async ({ page }) => {
  // O caso do ensaio de 19/09: o Vini parou em "(such as the Sony" e a janela
  // mostrou o pedaço como resposta. O servidor acrescenta a marca de fim
  // (`lib/ai/fim-da-resposta.ts`) quando o motivo não é "terminou".
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comResposta(page, "A decision needs to be made (such as the Sony⁣[[brennimark:incompleta:content-filter]]", enviados);
  await page.goto(MARCA);
  await perguntar(page, "what is the primary logo?");

  const resposta = page.locator("[data-vini-janela] [data-incompleta]");
  await expect(resposta).toContainText("(such as the Sony");
  await expect(resposta).toContainText("Resposta incompleta");
  // A marca é do sistema: não aparece para a pessoa.
  await expect(page.locator("[data-vini-janela]")).not.toContainText("brennimark:incompleta");

  const aviso = page.locator("[data-vini-aviso]");
  await expect(aviso).toContainText("parou antes de terminar");
  await expect(aviso).toContainText("filtro de conteúdo");

  // Tentar de novo refaz a PERGUNTA, sem o pedaço interrompido.
  await aviso.getByRole("button", { name: "Tentar de novo" }).click();
  await expect.poll(() => enviados.length).toBe(2);
  expect(enviados[1]).toEqual({ messages: [{ role: "user", content: "what is the primary logo?" }] });
});

test("resposta inteira não ganha aviso nenhum", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comResposta(page);
  await page.goto(MARCA);
  await perguntar(page, "cores?");
  await expect(page.locator("[data-resposta-do-vini]")).toBeVisible();
  await expect(page.locator("[data-incompleta]")).toHaveCount(0);
  await expect(page.locator("[data-vini-aviso]")).toHaveCount(0);
});

// ─── Fatia 4b: analisar a peça dentro da janela ────────────────────────────

const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function comAnalise(page: Page, veredito: string, enviados?: unknown[]) {
  await page.route("**/api/ai/analyze**", async (rota) => {
    enviados?.push(rota.request().postDataJSON());
    const linhas = [
      { type: "progress", stage: "preparing", message: "Preparando", elapsedMs: 0 },
      { type: "progress", stage: "consulting", message: "Consultando", elapsedMs: 10 },
      {
        type: "complete",
        analysis: {
          verdict: veredito,
          evidence: ["Cluster em vermelho no canto"],
          rules: ["Clusters devem ser sempre azuis [Fonte: Cluster Colours — UNDER REVIEW · /docs/cluster]"],
          problems: ["O cluster está vermelho [Fonte: Cluster Colours — UNDER REVIEW · /docs/cluster]"],
          impact: "", correction: "Trocar o cluster para o azul.", confidence: "Alta",
          sources: [], raw: "",
        },
        isDemo: false, provider: "google", model: "gemini-3.6-flash", fallbackUsed: false, elapsedMs: 20,
        attempts: [], historyId: "h1", historySaved: true, imageSaved: true,
        paginas: { "/docs/cluster": 12 },
      },
    ];
    await rota.fulfill({
      status: 200, contentType: "application/x-ndjson",
      body: linhas.map((l) => JSON.stringify(l)).join("\n") + "\n",
    });
  });
}

test("a peça entra pelo clipe, a janela alarga e a análise aparece nela", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comAnalise(page, "Desalinhada", enviados);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();
  const janela = page.locator("[data-vini-janela]");
  const estreita = (await janela.boundingBox())!.width;

  await page.locator("[data-arquivo-da-peca]").setInputFiles({ name: "cartaz.png", mimeType: "image/png", buffer: PNG_1PX });

  await expect(janela).toHaveAttribute("data-modo", "analise");
  await expect(janela.getByRole("img", { name: "Peça: cartaz.png" })).toBeVisible();
  expect((await janela.boundingBox())!.width, "a janela não alargou para a análise").toBeGreaterThan(estreita + 100);

  await janela.getByRole("textbox", { name: "Pergunta sobre a peça" }).fill("o cluster está certo?");
  await janela.getByRole("button", { name: "Analisar" }).click();

  const resultado = janela.locator("[data-analise-resultado]");
  await expect(resultado.locator("[data-veredito]")).toHaveAttribute("data-veredito", "misaligned");
  await expect(resultado.locator("[data-veredito]")).toHaveText("Desalinhada");
  await expect(resultado.getByRole("heading", { name: "Problemas" })).toBeVisible();
  await expect(resultado).toContainText("Trocar o cluster para o azul.");
  // A citação da análise também leva à página.
  await expect(resultado.locator("[data-citacao]").first()).toHaveAttribute("href", /original\?pagina=12/);
  await expect(resultado).toContainText("Guardada no histórico");
  // Nada de navegar: a análise acontece na janela.
  await expect(page).toHaveURL(/\/dev\/marcas/);

  const corpo = enviados[0] as { fileName: string; question: string; imageBase64: string };
  expect(corpo.fileName).toBe("cartaz.png");
  expect(corpo.question).toBe("o cluster está certo?");
  expect(corpo.imageBase64).toMatch(/^data:image\/png;base64,/);

  // Voltar à conversa não perde nada, e a janela volta ao tamanho de conversa.
  await janela.locator("[data-voltar-a-conversa]").click();
  await expect(janela).toHaveAttribute("data-modo", "conversa");
});

test("o que passa fica em tinta; só o que reprova ganha cor forte", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comAnalise(page, "Alinhada");
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();
  await page.locator("[data-arquivo-da-peca]").setInputFiles({ name: "ok.png", mimeType: "image/png", buffer: PNG_1PX });
  await page.getByRole("button", { name: "Analisar" }).click();
  const selo = page.locator("[data-veredito]");
  await expect(selo).toHaveAttribute("data-veredito", "aligned");
  await expect(selo).not.toHaveClass(/platform-danger/);
});

test("soltar a peça na janela também serve", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comAnalise(page, "Alinhada");
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();

  const transferencia = await page.evaluateHandle((b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer();
    dt.items.add(new File([bytes], "solta.png", { type: "image/png" }));
    return dt;
  }, PNG_1PX.toString("base64"));
  await page.locator("[data-vini-janela]").dispatchEvent("drop", { dataTransfer: transferencia });

  await expect(page.locator("[data-vini-janela]")).toHaveAttribute("data-modo", "analise");
  await expect(page.getByRole("img", { name: "Peça: solta.png" })).toBeVisible();
});

test("peça recusada diz qual limite barrou, e nada vai ao servidor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comAnalise(page, "Alinhada", enviados);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();

  await page.locator("[data-arquivo-da-peca]").setInputFiles({ name: "manual.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.locator("[data-analise-erro]")).toContainText("este arquivo é application/pdf");

  await page.locator("[data-arquivo-da-peca]").setInputFiles({
    name: "enorme.png", mimeType: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.locator("[data-analise-erro]")).toContainText("o limite é 10 MB por imagem");
  await expect(page.getByRole("button", { name: "Analisar" })).toBeDisabled();
  expect(enviados).toEqual([]);
});

test("marca sem análise contratada não oferece o clipe", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/marcas?marca=institucional");
  await page.locator("[data-botao-do-vini]").click();
  await expect(page.locator("[data-clipe-da-peca]")).toHaveCount(0);
  await expect(page.locator("[data-arquivo-da-peca]")).toHaveCount(0);
});

test("a imagem com as correções baixa como PNG: a peça intacta e o painel ao lado", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await comAnalise(page, "Desalinhada");
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();
  await page.locator("[data-arquivo-da-peca]").setInputFiles({ name: "Campanha Outono.png", mimeType: "image/png", buffer: PNG_1PX });
  await page.getByRole("button", { name: "Analisar" }).click();
  await expect(page.locator("[data-analise-resultado]")).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("[data-baixar-prancha]").click(),
  ]);
  expect(download.suggestedFilename()).toBe("Campanha-Outono-analise.png");

  const bytes = await (await import("node:fs/promises")).readFile(await download.path());
  // Assinatura PNG, e as dimensões do cabeçalho IHDR.
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  const largura = bytes.readUInt32BE(16);
  const altura = bytes.readUInt32BE(20);
  // Peça de 1 px + painel de no mínimo 560 px + margens: a prancha é o painel,
  // não a peça esticada.
  expect(largura).toBeGreaterThanOrEqual(560 + 3 * 56);
  expect(altura).toBeGreaterThan(200);
});

// ─── Fatia 4c: o copiloto de criação (ADR-0004 §3.1 e §3.2) ────────────────

async function comCopiloto(page: Page, respostas: { aprovadas?: unknown[]; rascunhos?: unknown[] }, enviados: unknown[]) {
  await page.route("**/api/ai/prompt**", async (rota) => {
    const corpo = rota.request().postDataJSON();
    enviados.push(corpo);
    if (corpo.etapa === "regras") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ aprovadas: respostas.aprovadas ?? [], rascunhos: respostas.rascunhos ?? [] }) });
    }
    const usadas = [
      ...(respostas.aprovadas ?? []),
      ...((respostas.rascunhos ?? []) as { slug: string }[]).filter((r) => (corpo.rascunhos ?? []).includes(r.slug)),
    ];
    return rota.fulfill({
      status: 200, contentType: "text/plain; charset=utf-8",
      headers: { "X-Brennimark-Regras": encodeURIComponent(JSON.stringify(usadas)) },
      body: "Studio product photo of a slim laptop on a light background, VAIO black #000000 accents, minimal composition. Avoid saturated colours.",
    });
  });
}

const FOTOGRAFIA = { slug: "fotografia", titulo: "VAIO Photographic Style", status: "draft", pagina: 20 };
const CORES = { slug: "cores", titulo: "VAIO Logo Formats and Colours", status: "draft", pagina: 8 };

test("sem regra aprovada, nada entra em silêncio: os rascunhos aparecem desmarcados", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comCopiloto(page, { rascunhos: [FOTOGRAFIA, CORES] }, enviados);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();
  await page.locator("[data-abrir-prompt]").click();

  const janela = page.locator("[data-vini-janela]");
  await expect(janela).toHaveAttribute("data-modo", "prompt");
  await janela.getByRole("textbox", { name: "O que você vai criar" }).fill("foto de produto do notebook para Instagram");
  await janela.getByRole("button", { name: "Ver as regras" }).click();

  await expect(janela.locator("[data-regras-aprovadas]")).toContainText("Nenhuma regra aprovada");
  const caixas = janela.locator("[data-regras-rascunho] input[type=checkbox]");
  await expect(caixas).toHaveCount(2);
  for (const caixa of await caixas.all()) await expect(caixa).not.toBeChecked();
  // O rascunho é dito no vocabulário da marca ("Under review" na festival).
  await expect(janela.locator("[data-regras-rascunho]")).toContainText(/under review/i);
});

test("gerar manda só a descrição e os rascunhos marcados — nunca o conteúdo das regras", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comCopiloto(page, { rascunhos: [FOTOGRAFIA, CORES] }, enviados);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();
  await page.locator("[data-abrir-prompt]").click();
  const janela = page.locator("[data-vini-janela]");
  await janela.getByRole("textbox", { name: "O que você vai criar" }).fill("foto de produto");
  await janela.getByRole("button", { name: "Ver as regras" }).click();

  await janela.getByLabel(/VAIO Photographic Style/).check();
  await janela.getByRole("button", { name: "Gerar prompt" }).click();

  await expect(janela.locator("[data-prompt-texto]")).toContainText("VAIO black #000000");
  expect(enviados.at(-1)).toEqual({ descricao: "foto de produto", tipo: "imagem", etapa: "gerar", rascunhos: ["fotografia"] });

  // A procedência: o que o prompt usou, e o rascunho dito como rascunho.
  await expect(janela.locator("[data-regras-usadas]")).toContainText("VAIO Photographic Style");
  await expect(janela.locator("[data-regras-usadas]")).not.toContainText("Logo Formats");
  await expect(janela.locator("[data-prompt-usa-rascunho]")).toContainText("regra em rascunho");
  await expect(janela.getByRole("button", { name: "Copiar prompt" })).toBeVisible();
});

test("regra aprovada entra sozinha, sem caixa para marcar", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  const APROVADA = { slug: "cores", titulo: "Cores", status: "ready", pagina: 8 };
  await comCopiloto(page, { aprovadas: [APROVADA] }, enviados);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();
  await page.locator("[data-abrir-prompt]").click();
  const janela = page.locator("[data-vini-janela]");
  await janela.getByRole("textbox", { name: "O que você vai criar" }).fill("banner");
  await janela.getByRole("button", { name: "Ver as regras" }).click();

  await expect(janela.locator("[data-regras-aprovadas]")).toContainText("Cores");
  await expect(janela.locator("[data-regras-rascunho]")).toHaveCount(0);
  await janela.getByRole("button", { name: "Gerar prompt" }).click();
  await expect(janela.locator("[data-prompt-texto]")).toContainText("laptop");
  // Só aprovada: nada de aviso de rascunho.
  await expect(janela.locator("[data-prompt-usa-rascunho]")).toHaveCount(0);
});

test("mudar a descrição apaga as regras da pergunta anterior", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const enviados: unknown[] = [];
  await comCopiloto(page, { rascunhos: [FOTOGRAFIA] }, enviados);
  await page.goto(MARCA);
  await page.locator("[data-botao-do-vini]").click();
  await page.locator("[data-abrir-prompt]").click();
  const janela = page.locator("[data-vini-janela]");
  const campo = janela.getByRole("textbox", { name: "O que você vai criar" });
  await campo.fill("foto de produto");
  await janela.getByRole("button", { name: "Ver as regras" }).click();
  await expect(janela.locator("[data-regras-rascunho]")).toBeVisible();

  await campo.fill("vídeo curto de lançamento");
  await expect(janela.locator("[data-regras-rascunho]")).toHaveCount(0);
  await expect(janela.getByRole("button", { name: "Ver as regras" })).toBeVisible();
});
