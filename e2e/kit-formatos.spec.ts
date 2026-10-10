import { expect, test, type Page } from "@playwright/test";

/**
 * O Kit abre PDF e AI (10/10/2026) — nos três motores, porque é PDF.js em
 * canvas, e foi no Safari que o André viu o Bradesco sem logotipo.
 *
 * O arquivo de prova é um PDF de verdade, montado aqui: uma prancheta A4 com
 * um desenho pequeno de 200 × 50 pt (proporção 4 : 1) perto do canto. Se o
 * Kit desenhasse a página inteira, viria um retângulo em pé; o recorte em
 * duas passadas tem de devolver só o desenho, deitado e em alta resolução.
 */
function pdfDeProva(): Buffer {
  const conteudo = "0.04 0.31 0.62 rg 80 700 50 50 re f 140 700 140 50 re f";
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>",
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
  ];
  let corpo = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((o, i) => { posicoes.push(corpo.length); corpo += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = corpo.length;
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) corpo += `${String(p).padStart(10, "0")} 00000 n \n`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corpo, "latin1");
}

async function proporcaoDaPrevia(page: Page) {
  const img = page.locator("label:has([data-kit-arquivo=logo]) img");
  await expect(img).toHaveCount(1);
  return img.evaluate((el: HTMLImageElement) => new Promise<{ largura: number; altura: number }>((ok) => {
    const ler = () => ok({ largura: el.naturalWidth, altura: el.naturalHeight });
    if (el.complete && el.naturalWidth) ler(); else el.onload = ler;
  }));
}

for (const [nome, mimeType] of [["acme-logo.ai", "application/pdf"], ["acme-logo.pdf", "application/pdf"], ["acme-logo.ai", "application/postscript"]] as const) {
  test(`abre ${nome} (${mimeType}): só o desenho, sem a prancheta, em alta resolução`, async ({ page }) => {
    await page.goto("/ferramentas/kit");
    await page.locator("[data-kit-arquivo=logo]").setInputFiles({ name: nome, mimeType, buffer: pdfDeProva() });
    // A primeira abertura compila o PDF.js no servidor de desenvolvimento.
    await expect(page.locator("[data-kit-miniatura]").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("[data-kit-nome]")).toHaveValue("acme");
    await expect(page.locator("p[role=alert]")).toHaveCount(0);
    const { largura, altura } = await proporcaoDaPrevia(page);
    expect(largura, "o desenho em alta resolução, não a página reduzida").toBeGreaterThan(2500);
    expect(largura / altura).toBeGreaterThan(3.7);
    expect(largura / altura).toBeLessThan(4.3);
    await expect(page.locator("[data-kit-baixar-tudo]")).toBeEnabled();
  });
}

test("EPS e .ai sem compatibilidade PDF: a tela diz o formato e o que fazer", async ({ page }) => {
  await page.goto("/ferramentas/kit");
  const entrada = page.locator("[data-kit-arquivo=logo]");
  await entrada.setInputFiles({ name: "logo.eps", mimeType: "application/postscript", buffer: Buffer.from("%!PS-Adobe-3.0 EPSF-3.0\n") });
  await expect(page.locator("p[role=alert]")).toContainText("EPS");
  await expect(page.locator("p[role=alert]")).toContainText("SVG ou PDF");

  await entrada.setInputFiles({ name: "logo.ai", mimeType: "application/postscript", buffer: Buffer.from("%!PS-Adobe-3.0\n%%Creator: Adobe Illustrator\n") });
  await expect(page.locator("p[role=alert]")).toContainText("compatibilidade PDF");

  await entrada.setInputFiles({ name: "logo.afdesign", mimeType: "application/octet-stream", buffer: Buffer.from("\u0000ÿKiw") });
  await expect(page.locator("p[role=alert]")).toContainText("Affinity");
  await expect(page.locator("[data-kit-baixar-tudo]")).toBeDisabled();
});

test("no Kit do assinante, o .ai dos Materiais abre", async ({ page }) => {
  await page.route("**/api/kit/regras/ler", (r) => r.fulfill({ json: { regras: [], lidas: 0, paginas: [] } }));
  await page.route("**/api/kit/regras", (r) => r.fulfill({ json: {
    marca: "Acme", regras: [], coresDaMarca: [], podeEditar: false, podeAprovar: false,
    desenhos: {
      logo: { id: "v1", itemId: "i1", tipo: "logo", arquivo: "Acme_Logo horizontal versão preferencial.ai", mime: "application/pdf", hierarquia: "principal", lockup: "horizontal", cor: "colorido", polaridade: "positivo", espacoDeCor: "rgb" },
      simbolo: null, negativo: null, semLogoPorque: null,
    },
  } }));
  await page.route("**/api/assets/kit", (r) => r.fulfill({ json: { nome: "kit.zip", arquivos: [{ url: "https://storage.prova.test/acme.ai", caminho: "acme.ai" }] } }));
  await page.route("https://storage.prova.test/**", (r) => r.fulfill({ headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/pdf" }, body: pdfDeProva() }));
  await page.goto("/dev/kit-assinante");
  await expect(page.locator("[data-kit-dos-materiais]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-kit-miniatura]").first()).toBeVisible();
  await expect(page.locator("[data-kit-sem-logo]")).toHaveCount(0);
});

test("no Kit do assinante, logotipo só em EPS: diz o arquivo e o motivo", async ({ page }) => {
  await page.route("**/api/kit/regras/ler", (r) => r.fulfill({ json: { regras: [], lidas: 0, paginas: [] } }));
  await page.route("**/api/kit/regras", (r) => r.fulfill({ json: {
    marca: "Acme", regras: [], coresDaMarca: [], podeEditar: false, podeAprovar: false,
    desenhos: {
      logo: null, simbolo: null, negativo: null,
      semLogoPorque: "O logotipo nos Materiais (acme.eps) não abre aqui. O arquivo está em EPS, que o Kit ainda não abre. Quem edita a marca pode exportar em SVG ou PDF e enviar nos Materiais.",
    },
  } }));
  await page.goto("/dev/kit-assinante");
  await expect(page.locator("[data-kit-sem-logo]")).toContainText("acme.eps");
  await expect(page.locator("[data-kit-sem-logo]")).not.toContainText("ainda não tem o logotipo");
});
