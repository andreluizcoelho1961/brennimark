import { expect, test, type Page } from "@playwright/test";
import { abrirAdministracao } from "./abrir-administracao";

/**
 * A tipografia da marca, na administração (14/10/2026).
 *
 * As APIs são interceptadas, como na paleta: quem pode editar e aprovar está
 * provado em SQL (`prova-tipografia-da-marca.sh`, 49 verificações). O que se
 * prova aqui é o caminho pela interface — cada papel vê só o que pode
 * (ADR-0002), salvar devolve a fonte a rascunho, a leitura da IA entra
 * marcada, e a recusa do servidor aparece.
 */

function secao(page: Page) {
  return page.getByRole("region", { name: "Tipografia da marca" });
}

const TITULO = "f0000000-0000-4000-8000-000000000001";
const TEXTO = "f0000000-0000-4000-8000-000000000002";

test("a ficha mostra cada uso, a fonte, as medidas e a situação", async ({ page }) => {
  await abrirAdministracao(page);
  const s = secao(page);
  await expect(s.locator("[data-resumo-da-tipografia]")).toHaveText(
    "3 fontes · 1 aprovada, 2 em rascunho · sem fonte: Subtítulo, Destaque, Apoio",
  );
  const linhas = s.locator("[data-fonte-da-marca]");
  await expect(linhas).toHaveCount(3);
  await expect(linhas.nth(0)).toContainText("Título");
  await expect(linhas.nth(0)).toContainText("Inter Bold");
  await expect(linhas.nth(0)).toContainText("PostScript Inter-Bold · 32/36 pt · espacejamento -10 · substituta Arial · p. 30");
  await expect(linhas.nth(0).locator("[data-status-da-fonte]")).toHaveText("Aprovada");
  await expect(linhas.nth(0).locator("[data-origem-ia]")).toHaveCount(0);
  await expect(linhas.nth(1)).toContainText("9,5/12 pt");
  await expect(linhas.nth(1).locator("[data-origem-ia]")).toHaveText("lida pela IA");
  await expect(linhas.nth(2)).toContainText("digital");
  await expect(linhas.nth(2)).toContainText("caixa alta");
  // Aprovada não se remove; rascunho, sim.
  await expect(linhas.nth(0).locator("[data-remover-fonte]")).toHaveCount(0);
  await expect(linhas.nth(1).locator("[data-remover-fonte]")).toBeVisible();
});

test("quem edita e não aprova não vê Aprovar; quem aprova e não edita só aprova", async ({ page }) => {
  await abrirAdministracao(page, "/dev/admin-panel?papel=editora");
  await expect(secao(page).locator("[data-adicionar-fonte]")).toBeVisible();
  await expect(secao(page).locator("[data-leitura-da-tipografia]")).toBeVisible();
  await expect(secao(page).locator("[data-aprovar-fonte]")).toHaveCount(0);

  await abrirAdministracao(page, "/dev/admin-panel?papel=aprovadora");
  const s = secao(page);
  await expect(s.locator("[data-adicionar-fonte]")).toHaveCount(0);
  await expect(s.locator("[data-editar-fonte]")).toHaveCount(0);
  await expect(s.locator("[data-leitura-da-tipografia]")).toHaveCount(0);
  await expect(s.locator("[data-aprovar-fonte]")).toHaveCount(2);
});

test("aprovar manda o id e a fonte vira aprovada", async ({ page }) => {
  let corpo: unknown = null;
  await page.route("**/api/admin/tipografia/aprovar**", async (rota) => {
    corpo = rota.request().postDataJSON();
    await rota.fulfill({
      status: 200,
      json: { aprovadas: [{ id: TEXTO, uso: "texto", segmento: "", familia: "Inter", estilo: "Regular", postscript: null, substituta: "Arial", corpo: 9.5, entrelinha: 12, espacejamento: null, caixaAlta: null, descricao: "", pagina: 30, ordem: 1, origem: "ia", status: "ready", aprovadoEm: "2026-10-14T13:00:00.000Z" }] },
    });
  });
  await abrirAdministracao(page, "/dev/admin-panel?papel=aprovadora");
  const s = secao(page);
  const texto = s.locator(`[data-fonte-da-marca="${TEXTO}"]`);
  await texto.locator("[data-aprovar-fonte]").click();
  expect(corpo).toEqual({ ids: [TEXTO] });
  await expect(texto.locator("[data-status-da-fonte]")).toHaveText("Aprovada");
  await expect(s.getByRole("status")).toHaveText("1 fonte aprovada.");
});

test("adicionar uma fonte manda os campos, começa no primeiro uso vazio e entra como rascunho", async ({ page }) => {
  let corpo: Record<string, unknown> | null = null;
  await page.route("**/api/admin/tipografia", async (rota) => {
    if (rota.request().method() !== "POST") return rota.fallback();
    corpo = rota.request().postDataJSON();
    await rota.fulfill({
      status: 201,
      json: { fonte: { id: "f0000000-0000-4000-8000-000000000009", uso: "subtitulo", segmento: "", familia: "Inter", estilo: "Semi Bold", postscript: null, substituta: null, corpo: 18, entrelinha: null, espacejamento: null, caixaAlta: null, descricao: "", pagina: 30, ordem: 3, origem: "pessoa", status: "draft", aprovadoEm: null } },
    });
  });
  await abrirAdministracao(page);
  const s = secao(page);
  await s.locator("[data-adicionar-fonte]").click();
  const f = s.locator("[data-formulario-da-fonte]");
  await expect(f.getByLabel("Uso")).toHaveValue("subtitulo");
  await f.getByLabel("Família").fill("Inter");
  await f.getByLabel("Estilo").fill("Semi Bold");
  await f.getByLabel("Corpo, pt (opcional)").fill("18");
  await f.getByLabel("Página do manual").fill("30");
  await f.locator("[data-salvar-fonte]").click();

  await expect(s.getByRole("status")).toHaveText("Fonte guardada como rascunho.");
  expect(corpo).toMatchObject({ uso: "subtitulo", familia: "Inter", estilo: "Semi Bold", corpo: "18", pagina: "30", caixa_alta: "" });
  // Subtítulo entra entre Título e Texto.
  await expect(s.locator("[data-fonte-da-marca]").nth(1)).toContainText("Inter Semi Bold");
  await expect(f).toHaveCount(0);
});

test("editar não deixa trocar o uso, e a recusa do servidor aparece com o formulário aberto", async ({ page }) => {
  await page.route("**/api/admin/tipografia", async (rota) => {
    if (rota.request().method() !== "PATCH") return rota.fallback();
    await rota.fulfill({ status: 400, json: { message: "O nome PostScript não tem espaço: letras, números e hífen, como BradescoSans-Bold." } });
  });
  await abrirAdministracao(page);
  const s = secao(page);
  await s.locator(`[data-fonte-da-marca="${TITULO}"] [data-editar-fonte]`).click();
  const f = s.locator("[data-formulario-da-fonte]");
  await expect(f.getByLabel("Uso")).toBeDisabled();
  await expect(f.getByLabel("Família")).toHaveValue("Inter");
  await f.getByLabel("Nome PostScript (opcional)").fill("Inter Bold");
  await f.locator("[data-salvar-fonte]").click();
  await expect(s.getByRole("status")).toContainText("O nome PostScript não tem espaço");
  await expect(f).toBeVisible();
});

test("ler do manual manda as páginas, e as fontes lidas entram marcadas como da IA", async ({ page }) => {
  let corpo: unknown = null;
  await page.route("**/api/admin/tipografia/ler**", async (rota) => {
    corpo = rota.request().postDataJSON();
    await rota.fulfill({
      status: 200,
      json: {
        fontes: [
          { id: TITULO, uso: "titulo", segmento: "", familia: "Inter", estilo: "Bold", postscript: "Inter-Bold", substituta: "Arial", corpo: 32, entrelinha: 36, espacejamento: -10, caixaAlta: null, descricao: "", pagina: 30, ordem: 0, origem: "pessoa", status: "ready", aprovadoEm: "2026-10-14T12:00:00.000Z" },
          { id: "f0000000-0000-4000-8000-000000000031", uso: "apoio", segmento: "", familia: "Merriweather", estilo: "Italic", postscript: null, substituta: "Georgia", corpo: null, entrelinha: null, espacejamento: null, caixaAlta: null, descricao: "Fonte secundária.", pagina: 31, ordem: 3, origem: "ia", status: "draft", aprovadoEm: null },
        ],
        encontradas: 2, lidas: 1, repetidas: 1, paginas: [30, 31], cortada: false, semImagem: [],
      },
    });
  });
  await abrirAdministracao(page);
  const s = secao(page);
  await s.getByLabel("Páginas de tipografia (opcional)").fill("30, 31");
  await s.locator("[data-ler-tipografia]").click();
  expect(corpo).toEqual({ paginas: "30, 31" });
  await expect(s.getByRole("status")).toHaveText(
    "1 fonte lida das páginas 30, 31, como rascunho — confira cada nome na página antes de aprovar. 1 uso já tinha fonte e foi mantido.",
  );
  const apoio = s.locator('[data-fonte-da-marca="f0000000-0000-4000-8000-000000000031"]');
  await expect(apoio).toContainText("Merriweather Italic");
  await expect(apoio.locator("[data-origem-ia]")).toHaveText("lida pela IA");
});

test("leitura recusada ou cortada diz o que aconteceu, e os botões voltam", async ({ page }) => {
  let vez = 0;
  await page.route("**/api/admin/tipografia/ler**", (rota) => {
    vez += 1;
    return vez === 1
      ? rota.fulfill({ status: 429, json: { error: "leitura_recente", message: "A IA já procurou a tipografia nas últimas 24 horas. Para ler de novo agora, digite as páginas de tipografia." } })
      : rota.fulfill({ status: 200, json: { encontradas: 0, lidas: 0, repetidas: 0, paginas: [30], cortada: true, semImagem: [] } });
  });
  await abrirAdministracao(page);
  const s = secao(page);
  await s.locator("[data-ler-tipografia]").click();
  await expect(s.getByRole("status")).toContainText("últimas 24 horas");
  await expect(s.locator("[data-ler-tipografia]")).toBeEnabled();
  await s.locator("[data-ler-tipografia]").click();
  await expect(s.getByRole("status")).toHaveText("A resposta da IA foi cortada antes de qualquer fonte. Rode de novo com menos páginas.");
  await expect(s.locator("[data-fonte-da-marca]")).toHaveCount(3);
});
