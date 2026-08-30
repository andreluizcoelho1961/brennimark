import { expect, test } from "@playwright/test";
import path from "node:path";

const PDF = path.join(process.cwd(), "e2e/fixtures/manual-de-teste.pdf");

/**
 * O importador é a porta de entrada do produto: é por ele que um manual deixa
 * de ser PDF e vira sistema.
 *
 * Estes testes cobrem o que acontece ANTES de qualquer escrita — a leitura do
 * arquivo e a prévia — que é a parte que nenhum teste de unidade alcança,
 * porque depende do pdfjs rodando num navegador de verdade.
 *
 * A autorização, a atomicidade e o conflito de marca repetida estão provados
 * em SQL contra a RPC, com sessões simuladas de owner, member e anônimo.
 */

test("a rota real de importação exige quem administra", async ({ page }) => {
  // O preview local não concede papel nenhum. Sem capacidade, a porta fecha.
  await page.goto("/docs/importar");
  await expect(page).toHaveURL(/\/docs$/);
});

test("ler o PDF produz prévia, e nada é gravado", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', PDF);

  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();

  // Duas páginas com texto viram documentos; a terceira, vazia, não.
  await expect(page.getByText("3 páginas no PDF")).toBeVisible();
  await expect(page.getByText("2 virariam páginas do manual")).toBeVisible();
  await expect(page.getByText("1 sem texto")).toBeVisible();

  await expect(page.getByText("Cores", { exact: true })).toBeVisible();
  await expect(page.getByText("/cores")).toBeVisible();
  await expect(page.getByText("Tipografia", { exact: true })).toBeVisible();
});

test("toda página importada aparece como rascunho na prévia", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', PDF);

  // Extração automática não é aprovação, e a prévia diz isso antes de alguém
  // decidir publicar.
  const selos = page.getByText("Rascunho", { exact: true });
  await expect(selos).toHaveCount(2);
  await expect(page.getByText("Pronto", { exact: true })).toHaveCount(0);
});

test("a página sem texto vira aviso, não conteúdo inventado", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', PDF);

  await page.getByRole("group").first().isVisible().catch(() => {});
  await page.getByText(/avisos$/).click();
  await expect(page.getByText(/Página 3: Nenhum texto extraível/)).toBeVisible();
});

test("o idioma do manual é campo próprio, separado do idioma da interface", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', PDF);

  // Uma pessoa com a interface em português pode importar um manual em inglês.
  // Derivar um do outro faria o assistente traduzir termos que a marca definiu.
  const opcoes = page.getByRole("radio");
  await expect(opcoes).toHaveCount(2);
  await expect(page.getByRole("radio", { name: "Português" })).toBeChecked();

  await page.getByRole("radio", { name: "Inglês" }).check();
  await expect(page.getByRole("radio", { name: "Inglês" })).toBeChecked();
  // E a interface segue em português.
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toBeVisible();
});

test("as funcionalidades são escolha explícita, e nenhuma vem marcada", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', PDF);

  // O PDF não decide o que a instalação contratou.
  const caixas = page.getByRole("checkbox");
  await expect(caixas).toHaveCount(4);
  for (let i = 0; i < 4; i += 1) await expect(caixas.nth(i)).not.toBeChecked();
});

test("o nome da marca vira chave, e ela aparece antes de publicar", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', PDF);

  const nome = page.getByLabel("Nome da marca");
  await nome.fill("Território Ação");
  await expect(page.getByText("chave: territorio-acao")).toBeVisible();
});

test("um arquivo que não é PDF é recusado antes de qualquer leitura", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', {
    name: "nao-e-pdf.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("isto não é um PDF"),
  });

  await expect(page.getByText("O arquivo precisa ser um PDF.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toHaveCount(0);
});
