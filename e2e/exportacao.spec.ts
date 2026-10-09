import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

/**
 * A exportação na aba Plano (08/10/2026). As APIs e o Storage são fingidos; o
 * papel (só a dona), o isolamento entre contas, o prazo de 6 horas e o limite
 * diário estão provados no banco (`scripts/prova-exportar.sh`, e o pedido de
 * reserva em `scripts/prova-exportacao.sh`).
 */
const PLANO = {
  assinada: true, plano: "Básico", acesso: "so_leitura", marcas: { usadas: 1, maximo: 5 },
  pagoAte: "2026-11-01T12:00:00Z", cancelaNoFim: false, soLeituraAPartirDe: null, titular: "dona@agencia.com",
};

const MANIFESTO = {
  id: "00000000-0000-4000-8000-00000000e001", iniciada_em: "2026-10-08T15:00:00Z", arquivos: 3, bytes: 30, conta: "Agência",
  marcas: [{
    id: "m1", nome: "Marca Um", chave: "marca-um",
    arquivos: [
      { chave: "documento:1", tipo: "manual", nome: "Manual (v1)", bytes: 10, detalhes: { situacao: "ativa" } },
      { chave: "material:1", tipo: "material", nome: "logo.svg", bytes: 10, detalhes: { item: "Logotipo", status: "ready" } },
      { chave: "material:2", tipo: "material", nome: "sumiu.svg", bytes: 10, detalhes: { item: "Logotipo", status: "ready" } },
    ],
    complementos: [{ slug: "tom-de-voz", titulo: "Tom de voz", versao: 1, texto: "Falamos simples.", publicado_em: "2026-10-01T00:00:00Z" }],
    links: [],
  }],
};

async function fingir(page: Page, opcoes: { pedido?: unknown; iniciar?: { status: number; json: unknown } } = {}) {
  const contagem = { pedidos: 0, lotes: [] as string[][], concluidas: 0 };
  await page.route("**/api/configuracoes/consumo**", (r) => r.fulfill({ status: 500, json: { message: "fora do teste" } }));
  await page.route("**/api/configuracoes/plano**", (r) => r.fulfill({ json: PLANO }));
  await page.route("**/api/configuracoes/exportacao**", async (r) => {
    const url = new URL(r.request().url());
    if (url.pathname.endsWith("/iniciar")) return r.fulfill(opcoes.iniciar ?? { status: 200, json: { manifesto: MANIFESTO } });
    if (url.pathname.endsWith("/enderecos")) {
      const { chaves } = r.request().postDataJSON() as { chaves: string[] };
      contagem.lotes.push(chaves);
      return r.fulfill({ json: { enderecos: Object.fromEntries(chaves.map((c) => [c, `https://storage.prova.test/${c.replace(":", "-")}`])) } });
    }
    if (url.pathname.endsWith("/concluir")) {
      contagem.concluidas += 1;
      return r.fulfill({ json: { ok: true } });
    }
    if (r.request().method() === "POST") {
      contagem.pedidos += 1;
      return r.fulfill({ json: { pedido: { pedidoEm: "2026-10-08T15:00:00Z", prazo: "2026-10-23T15:00:00Z", entregueEm: null } } });
    }
    return r.fulfill({ json: { pedido: opcoes.pedido ?? null, ultimaExportacao: null } });
  });
  // O Storage: dois arquivos existem, o terceiro não.
  await page.route("https://storage.prova.test/**", (r) => {
    const nome = new URL(r.request().url()).pathname.slice(1);
    if (nome === "material-2") return r.fulfill({ status: 404, headers: { "Access-Control-Allow-Origin": "*" }, body: "" });
    return r.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, body: `conteudo de ${nome}` });
  });
  return contagem;
}

test("a dona exporta: o navegador salva um ZIP por marca, com os originais, o índice e o aviso do que faltou", async ({ page }) => {
  const contagem = await fingir(page);
  await page.goto("/dev/configuracoes?parte=plano");
  const secao = page.locator("[data-exportacao]");
  await expect(secao).toContainText("um arquivo .zip por marca");

  const baixando = page.waitForEvent("download");
  await secao.locator("[data-exportar]").click();
  const download = await baixando;
  expect(download.suggestedFilename()).toBe("brennimark-marca-um-2026-10-08.zip");

  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  expect(Object.keys(zip).sort()).toEqual([
    "FALTARAM.txt", "LEIA-ME.txt", "complementos/tom-de-voz.md", "indice.csv",
    "manuais/Manual (v1).pdf", "materiais/Logotipo/logo.svg",
  ]);
  expect(strFromU8(zip["materiais/Logotipo/logo.svg"])).toBe("conteudo de material-1");
  expect(strFromU8(zip["FALTARAM.txt"])).toContain("materiais/Logotipo/sumiu.svg");
  expect(strFromU8(zip["indice.csv"])).toContain('"materiais/Logotipo/sumiu.svg"');

  await expect(secao.locator("[data-exportacao-pronta]")).toContainText("1 arquivo(s) não puderam ser baixados");
  // O navegador pede por CHAVE, nunca por caminho; e exportação com falta não é anotada como concluída.
  expect(contagem.lotes).toEqual([["documento:1", "material:1", "material:2"]]);
  expect(contagem.concluidas).toBe(0);
});

test("sem faltas, a exportação é anotada como concluída", async ({ page }) => {
  const contagem = await fingir(page);
  await page.route("https://storage.prova.test/material-2", (r) =>
    r.fulfill({ headers: { "Access-Control-Allow-Origin": "*" }, body: "agora veio" }));
  await page.goto("/dev/configuracoes?parte=plano");
  const baixando = page.waitForEvent("download");
  await page.locator("[data-exportar]").click();
  await baixando;
  await expect(page.locator("[data-exportacao-pronta]")).toHaveText("Pronto: 1 arquivo(s) .zip salvo(s) no seu computador.");
  await expect.poll(() => contagem.concluidas).toBe(1);
});

test("o limite diário chega à tela com a explicação do servidor", async ({ page }) => {
  await fingir(page, { iniciar: { status: 429, json: { message: "Esta conta já exportou 5 vezes nas últimas 24 horas. Tente de novo amanhã." } } });
  await page.goto("/dev/configuracoes?parte=plano");
  await page.locator("[data-exportar]").click();
  await expect(page.locator("[data-exportacao] [role=alert]")).toHaveText("Esta conta já exportou 5 vezes nas últimas 24 horas. Tente de novo amanhã.");
  await expect(page.locator("[data-exportar]")).toBeEnabled();
});

test("a reserva: quem não conseguir pede, e vê o prazo de 15 dias", async ({ page }) => {
  const contagem = await fingir(page);
  await page.goto("/dev/configuracoes?parte=plano");
  const secao = page.locator("[data-exportacao]");
  await secao.locator("[data-pedir-exportacao]").click();
  await expect(secao.locator("[data-exportacao-pedida]")).toHaveText("Exportação pedida em 8 de outubro de 2026. Entregamos até 23 de outubro de 2026.");
  await expect(secao.locator("[data-pedir-exportacao]")).toHaveCount(0);
  expect(contagem.pedidos).toBe(1);
});

test("com pedido aberto, mostra o pedido e não oferece outro; a exportação pelo navegador continua", async ({ page }) => {
  await fingir(page, { pedido: { pedidoEm: "2026-10-01T12:00:00Z", prazo: "2026-10-16T12:00:00Z", entregueEm: null } });
  await page.goto("/dev/configuracoes?parte=plano");
  await expect(page.locator("[data-exportacao-pedida]")).toContainText("Entregamos até 16 de outubro de 2026");
  await expect(page.locator("[data-pedir-exportacao]")).toHaveCount(0);
  await expect(page.locator("[data-exportar]")).toBeEnabled();
});

test("depois de entregue, diz quando foi e deixa pedir de novo", async ({ page }) => {
  await fingir(page, { pedido: { pedidoEm: "2026-09-01T12:00:00Z", prazo: "2026-09-16T12:00:00Z", entregueEm: "2026-09-10T12:00:00Z" } });
  await page.goto("/dev/configuracoes?parte=plano");
  await expect(page.locator("[data-exportacao-entregue]")).toContainText("entregue em 10 de setembro de 2026");
  await expect(page.locator("[data-pedir-exportacao]")).toBeEnabled();
});
