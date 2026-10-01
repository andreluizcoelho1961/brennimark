import { expect, test, type Page } from "@playwright/test";

/**
 * Complementos — o terceiro segmento da barra (01/10/2026, direção §20).
 *
 * `/api/complementos` é fingido: quem lê o quê — rascunho só de quem edita,
 * publicado para quem consulta, arquivado fora — está provado no banco
 * (`scripts/prova-complementos.sh`). O que se prova aqui é o caminho da tela:
 * ler, escrever com prévia, publicar com confirmação, arquivar, histórico, e
 * a âncora para onde leva a citação do Vini.
 */

const PUBLICADO = {
  id: "11111111-1111-4111-8111-111111111111", slug: "simbolo-sobre-foto", versao: 2,
  titulo: "Símbolo sobre foto", texto: "Use o símbolo **só** em áreas escuras.\n\n## Fundo\n- Sem textura\n- Nunca sobre rosto",
  publicado_em: "2026-10-01T13:00:00Z", publicado_por_email: "editor@agencia.com", arquivado_em: null, rascunho: null,
};
const COM_EDICAO = {
  id: "22222222-2222-4222-8222-222222222222", slug: "emojis", versao: 1, titulo: "Emojis", texto: "Use com parcimônia.",
  publicado_em: "2026-09-30T13:00:00Z", publicado_por_email: "editor@agencia.com", arquivado_em: null,
  rascunho: { titulo: "Emojis", texto: "Use com parcimônia, nunca em título.", atualizado_em: "2026-10-01T14:00:00Z", atualizado_por_email: "editor@agencia.com" },
};
const SO_RASCUNHO = {
  id: "33333333-3333-4333-8333-333333333333", slug: "bordado", versao: 0, titulo: null, texto: null,
  publicado_em: null, publicado_por_email: null, arquivado_em: null,
  rascunho: { titulo: "Bordado", texto: "Versão monocromática.", atualizado_em: "2026-10-01T15:00:00Z", atualizado_por_email: "editor@agencia.com" },
};
const ARQUIVADO = { ...PUBLICADO, id: "44444444-4444-4444-8444-444444444444", slug: "antigo", titulo: "Antigo", arquivado_em: "2026-10-01T16:00:00Z" };

type Pedido = { url: URL; metodo: string; corpo: Record<string, unknown> | null };

async function fingir(page: Page, podeEditar: boolean, pedidos: Pedido[], respostaDaAcao?: { status: number; json: unknown }) {
  await page.route("**/api/complementos**", async (rota) => {
    const url = new URL(rota.request().url());
    const metodo = rota.request().method();
    pedidos.push({ url, metodo, corpo: metodo === "POST" ? rota.request().postDataJSON() : null });
    if (/\/versoes$/.test(url.pathname)) {
      return rota.fulfill({ json: { versoes: [
        { id: "v2", versao: 2, acao: "publicado", titulo: "Símbolo sobre foto", texto: "Texto da versão 2", autor_email: "editor@agencia.com", created_at: "2026-10-01T13:00:00Z" },
        { id: "v1", versao: 1, acao: "publicado", titulo: "Símbolo sobre foto", texto: "Texto da versão 1", autor_email: "editor@agencia.com", created_at: "2026-09-29T13:00:00Z" },
      ] } });
    }
    if (metodo === "POST") return rota.fulfill(respostaDaAcao ?? { status: 200, json: { ok: true } });
    // Quem consulta só recebe o publicado e não arquivado — como o banco entrega.
    const complementos = podeEditar ? [PUBLICADO, COM_EDICAO, SO_RASCUNHO, ARQUIVADO] : [PUBLICADO, { ...COM_EDICAO, rascunho: null }];
    return rota.fulfill({ json: { podeEditar, complementos } });
  });
}

test("quem consulta lê os publicados, formatados, sem nenhum controle de edição", async ({ page }) => {
  await fingir(page, false, []);
  await page.goto("/dev/complementos");
  const c = page.locator('[data-complemento="simbolo-sobre-foto"]');
  await expect(c.getByRole("heading", { name: "Símbolo sobre foto" })).toBeVisible();
  await expect(c.locator("strong")).toHaveText("só");
  await expect(c.getByRole("listitem")).toHaveText(["Sem textura", "Nunca sobre rosto"]);
  await expect(c).toContainText("Versão 2 · publicada em 01/10/2026");
  // O e-mail de quem publicou é informação de quem edita.
  await expect(c).not.toContainText("editor@agencia.com");
  await expect(page.locator("[data-complemento]")).toHaveCount(2);
  await expect(page.locator("[data-novo-complemento], [data-acao], [data-rascunho], [data-selo]")).toHaveCount(0);
});

test("quem edita vê rascunho, edição pendente e arquivado, cada um dito com todas as letras", async ({ page }) => {
  await fingir(page, true, []);
  await page.goto("/dev/complementos");
  await expect(page.locator('[data-complemento="bordado"] [data-selo="rascunho"]')).toHaveText("Rascunho · só quem edita vê");
  await expect(page.locator('[data-complemento="emojis"] [data-selo="edicao"]')).toHaveText("Edição não publicada");
  // O publicado segue valendo, e a edição aparece à parte.
  await expect(page.locator('[data-complemento="emojis"]')).toContainText("Use com parcimônia.");
  await expect(page.locator('[data-complemento="emojis"] [data-rascunho]')).toContainText("nunca em título");
  await expect(page.locator('[data-complemento="antigo"] [data-selo="arquivado"]')).toContainText("fora da leitura e do Vini");
  await expect(page.locator('[data-complemento="antigo"] [data-acao="reativar"]')).toBeVisible();
  await expect(page.locator('[data-complemento="antigo"] [data-acao="editar"]')).toHaveCount(0);
});

test("escrever: a prévia formata enquanto digita, e salvar cria só o rascunho", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, true, pedidos);
  await page.goto("/dev/complementos");
  await page.locator("[data-novo-complemento]").click();
  const editor = page.locator("[data-editor-de-complemento]");
  await editor.locator("[data-titulo-do-complemento]").fill("Tom em redes sociais");
  await editor.locator("[data-texto-do-complemento]").fill("## Regra\n- **Direto**\n- Sem gíria");
  const previa = editor.locator("[data-previa]");
  await expect(previa.getByRole("heading", { name: "Regra" })).toBeVisible();
  await expect(previa.locator("strong")).toHaveText("Direto");
  await editor.locator("[data-salvar-rascunho]").click();
  const criar = pedidos.find((p) => p.metodo === "POST")!;
  expect(criar.url.pathname).toBe("/api/complementos");
  expect(criar.corpo).toEqual({ titulo: "Tom em redes sociais", texto: "## Regra\n- **Direto**\n- Sem gíria" });
});

test("editar um publicado parte do texto atual e salva como rascunho dele", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, true, pedidos);
  await page.goto("/dev/complementos");
  await page.locator('[data-complemento="simbolo-sobre-foto"] [data-acao="editar"]').click();
  const editor = page.locator("[data-editor-de-complemento]");
  await expect(editor.locator("[data-texto-do-complemento]")).toHaveValue(PUBLICADO.texto);
  await editor.locator("[data-texto-do-complemento]").fill("Texto novo");
  await editor.locator("[data-salvar-rascunho]").click();
  const salvar = pedidos.find((p) => p.metodo === "POST")!;
  expect(salvar.url.pathname).toBe(`/api/complementos/${PUBLICADO.id}`);
  expect(salvar.corpo).toEqual({ acao: "salvar", titulo: "Símbolo sobre foto", texto: "Texto novo" });
});

test("publicar pede confirmação dizendo que o Vini passa a usar o texto", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, true, pedidos);
  await page.goto("/dev/complementos");
  const c = page.locator('[data-complemento="emojis"]');
  await c.locator('[data-acao="publicar"]').click();
  await expect(c).toContainText("o Vini passa a usar este texto");
  expect(pedidos.filter((p) => p.metodo === "POST")).toHaveLength(0);
  await c.locator('[data-confirmar="publicar"]').click();
  await expect.poll(() => pedidos.find((p) => p.metodo === "POST")?.corpo).toEqual({ acao: "publicar" });
});

test("arquivar avisa que sai do Vini e que nada se apaga", async ({ page }) => {
  const pedidos: Pedido[] = [];
  await fingir(page, true, pedidos);
  await page.goto("/dev/complementos");
  const c = page.locator('[data-complemento="simbolo-sobre-foto"]');
  await c.locator('[data-acao="arquivar"]').click();
  await expect(c).toContainText("Sai da leitura e do Vini; o texto e o histórico ficam.");
  await c.locator('[data-confirmar="arquivar"]').click();
  await expect.poll(() => pedidos.find((p) => p.metodo === "POST")?.corpo).toEqual({ acao: "arquivar" });
});

test("o histórico mostra cada versão, com autor, data e o texto daquela versão", async ({ page }) => {
  await fingir(page, true, []);
  await page.goto("/dev/complementos");
  await page.locator('[data-complemento="simbolo-sobre-foto"] [data-ver-historico]').click();
  const historico = page.locator('[data-historico="simbolo-sobre-foto"]');
  await expect(historico.locator("[data-versao]")).toHaveCount(2);
  await historico.locator('[data-versao="1-publicado"] summary').click();
  await expect(historico.locator('[data-versao="1-publicado"]')).toContainText("Texto da versão 1");
});

test("a recusa do servidor aparece com a frase dele", async ({ page }) => {
  await fingir(page, true, [], { status: 400, json: { message: "Este complemento está arquivado. Reative-o antes de editar." } });
  await page.goto("/dev/complementos");
  const c = page.locator('[data-complemento="antigo"]');
  await c.locator('[data-acao="reativar"]').click();
  await expect(c.getByRole("alert")).toHaveText("Este complemento está arquivado. Reative-o antes de editar.");
});

test("a citação do Vini leva à âncora do complemento", async ({ page }) => {
  await fingir(page, false, []);
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto("/dev/complementos#emojis");
  await expect(page.locator('[data-complemento="emojis"]')).toBeInViewport();
});

test("com a marca aberta, o segmento Complementos acende e leva à página", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/dev/marcas");
  const barra = page.getByRole("navigation", { name: /Conteúdo da marca|Brand content/ });
  await expect(barra.locator("[data-parte-do-segmentado='complementos']")).toHaveAttribute("href", /\/complementos$/);
  await expect(barra.locator("[data-parte-apagada]")).toHaveCount(0);
});
