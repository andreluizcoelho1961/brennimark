import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { readFileSync } from "node:fs";

const fixture = (nome: string) => path.join(process.cwd(), "e2e/fixtures", nome);

/**
 * A leitura do PDF, no navegador de verdade.
 *
 * Estes casos não são simuláveis fora daqui: dependem do PDF.js executando
 * sobre bytes reais. As fixtures são construídas por
 * scripts/gerar-fixtures-pdf.py — um PDF de cliente não pode entrar no
 * repositório, e um "PDF de exemplo" da internet muda sem aviso.
 */

async function escolher(page: Page, nome: string) {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', fixture(nome));
}

// ─── Assinatura, e não MIME ─────────────────────────────────────────────────

test("PDF válido com MIME vazio é aceito", async ({ page }) => {
  await page.goto("/dev/importar");
  // Alguns navegadores e sistemas de arquivos não declaram tipo. O arquivo
  // continua sendo um PDF, e recusá-lo por causa disso seria recusar por
  // metadado em vez de por conteúdo.
  await page.setInputFiles('input[type="file"]', {
    name: "sem-mime.pdf",
    mimeType: "",
    buffer: readFileSync(fixture("manual-de-teste.pdf")),
  });
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();
});

test("arquivo que se declara PDF mas não é, é recusado", async ({ page }) => {
  await page.goto("/dev/importar");
  // O caso que a extensão e o MIME não pegam: os dois dizem PDF, os bytes não.
  await page.setInputFiles('input[type="file"]', {
    name: "mentiroso.pdf",
    mimeType: "application/pdf",
    buffer: readFileSync(fixture("nao-e-pdf.pdf")),
  });
  await expect(page.getByText(/não é um PDF/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toHaveCount(0);
});

test("arquivo com extensão .pdf e conteúdo de página web é recusado", async ({ page }) => {
  await escolher(page, "nao-e-pdf.pdf");
  await expect(page.getByText(/não é um PDF/i)).toBeVisible();
});

// ─── Falhas com mensagem própria ────────────────────────────────────────────

test("PDF protegido por senha diz que é senha", async ({ page }) => {
  await escolher(page, "protegido.pdf");
  // "Não foi possível ler" mandaria a pessoa procurar o problema no lugar
  // errado. A ação aqui é salvar uma cópia sem proteção.
  await expect(page.getByText(/protegido por senha/i)).toBeVisible();
});

test("PDF corrompido não é confundido com arquivo de outro formato", async ({ page }) => {
  await escolher(page, "corrompido.pdf");
  const mensagem = page.locator('[role="status"]').first();
  await expect(mensagem).toBeVisible();
  // A assinatura é válida — o que quebrou foi a estrutura interna.
  await expect(page.getByText(/não é um PDF/i)).toHaveCount(0);
});

test("PDF sem texto extraível fala em digitalização, não em erro", async ({ page }) => {
  await escolher(page, "sem-texto.pdf");
  // Ele foi lido com sucesso: o problema é que não há texto para virar manual.
  await expect(page.getByText(/Nenhuma página do PDF tem texto extraível/i)).toBeVisible();
});

// ─── Geometria e estrutura ──────────────────────────────────────────────────

test("cabeçalho repetido e número de página não viram seção", async ({ page }) => {
  await escolher(page, "cabecalho-repetido.pdf");
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();

  // 14 páginas com "Brand Guidelines" no topo e números 1..14 no pé. Nenhum
  // dos dois pode virar título — e os números precisam colidir na mesma chave
  // de repetição, senão "12" e "13" passariam como textos distintos.
  await expect(page.getByText("Brand Guidelines", { exact: true })).toHaveCount(0);
  for (const numero of ["12", "13"]) {
    await expect(page.getByText(numero, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByText("Conteudo da pagina 12", { exact: true })).toBeVisible();
});

test("o índice declarado pelo PDF é preservado", async ({ page }) => {
  await escolher(page, "com-outline.pdf");
  // O índice é a estrutura que o autor do manual declarou — a fonte de seção
  // mais confiável que existe, acima de qualquer heurística visual.
  await expect(page.getByText(/índice com 2 entradas/i)).toBeVisible();
});

test("PDF sem índice não inventa um", async ({ page }) => {
  await escolher(page, "manual-de-teste.pdf");
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();
  await expect(page.getByText(/índice com/i)).toHaveCount(0);
});

// ─── Leitura única ──────────────────────────────────────────────────────────

test("o arquivo é lido uma vez só", async ({ page }) => {
  await page.goto("/dev/importar");

  // Num PDF de 100 MiB, uma segunda leitura significa 200 MiB de buffer cru
  // antes de o parser começar. O contador vive na página porque é o único
  // lugar onde dá para observar a chamada real.
  await page.evaluate(() => {
    const original = Blob.prototype.arrayBuffer;
    (window as unknown as { __leituras: number }).__leituras = 0;
    Blob.prototype.arrayBuffer = function (this: Blob) {
      (window as unknown as { __leituras: number }).__leituras += 1;
      return original.call(this);
    };
  });

  await page.setInputFiles('input[type="file"]', fixture("manual-de-teste.pdf"));
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();

  const leituras = await page.evaluate(
    () => (window as unknown as { __leituras: number }).__leituras,
  );
  expect(leituras, "hash e parser precisam compartilhar o mesmo buffer").toBe(1);
});
