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

  // Páginas viram SEÇÕES, não uma página de manual cada. A terceira, vazia,
  // não entra em seção nenhuma e aparece com motivo.
  await expect(page.getByText(/3 páginas no PDF/)).toBeVisible();
  await expect(page.getByText(/1 sem texto/)).toBeVisible();

  await expect(page.getByLabel("Título da seção").first()).toHaveValue("Cores");
});

test("cada seção mostra de quais páginas veio e como foi detectada", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', PDF);

  // Procedência visível antes de publicar: sem ela, ninguém consegue conferir
  // a seção contra o original.
  await expect(page.getByText(/Páginas 1/).first()).toBeVisible();
  // O método de detecção aparece como rótulo — aqui não há índice no PDF.
  await expect(page.getByText(/^(Título|Faixa)$/).first()).toBeVisible();
});

test("a página sem texto vira registro, não conteúdo inventado", async ({ page }) => {
  await page.goto("/dev/importar");
  await page.setInputFiles('input[type="file"]', PDF);

  await page.getByText(/páginas sem texto/).click();
  await expect(page.getByText(/Provavelmente são imagens/)).toBeVisible();
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

  // A recusa deixou de olhar o MIME e passou a olhar os bytes — a mensagem
  // acompanhou. Os casos de assinatura estão em importador-leitura.spec.
  await expect(page.getByText(/não é um PDF/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: /nada foi gravado ainda/i })).toHaveCount(0);
});
