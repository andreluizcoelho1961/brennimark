import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

/**
 * O Brennimark Kit gratuito (09/10/2026): sobe o logo, vê as prévias, baixa o
 * .zip — e o .zip é aberto e conferido aqui, arquivo por arquivo. As contas de
 * encaixe (círculo, área segura, margem) estão provadas em `pacote.test.ts`.
 */
const LOGO = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 120"><circle cx="60" cy="60" r="50" fill="#0b4f9e"/>`
  + `<rect x="130" y="20" width="370" height="80" fill="#0b4f9e"/></svg>`,
);
const SIMBOLO = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="#0b4f9e"/></svg>`);
// 1 × 1, opaco: pequeno demais para as capas.
const PNG_PEQUENO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

/** Largura e altura de um PNG, lidas do cabeçalho IHDR. */
function medidas(png: Uint8Array) {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { largura: v.getUint32(16), altura: v.getUint32(20) };
}

test("sobe o logo e o símbolo, vê as prévias e baixa o pacote completo, conferido arquivo por arquivo", async ({ page }) => {
  await page.goto("/ferramentas/kit");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Todos os tamanhos do seu logo");
  await expect(page.locator("[data-kit-baixar-tudo]")).toBeDisabled();

  await page.locator("[data-kit-arquivo=logo]").setInputFiles({ name: "acme-logo.svg", mimeType: "image/svg+xml", buffer: LOGO });
  await page.locator("summary").click();
  await page.locator("[data-kit-arquivo=simbolo]").setInputFiles({ name: "acme-simbolo.svg", mimeType: "image/svg+xml", buffer: SIMBOLO });

  // O nome vem do arquivo, sem "logo"; as prévias do site aparecem.
  await expect(page.locator("[data-kit-nome]")).toHaveValue("acme");
  await expect(page.locator("[data-kit-miniatura]")).toHaveCount(8);
  await page.locator("[data-kit-aba=redes]").click();
  await expect(page.locator("[data-kit-miniatura]")).toHaveCount(12);

  const total = Number((await page.locator("[data-kit-total]").textContent())!.match(/\d+/)![0]);
  const baixando = page.waitForEvent("download");
  await page.locator("[data-kit-baixar-tudo]").click();
  const download = await baixando;
  expect(download.suggestedFilename()).toBe("kit-acme.zip");

  const zip = unzipSync(new Uint8Array(await readFile((await download.path())!)));
  const nomes = Object.keys(zip);
  expect(nomes.length, "o botão promete o número exato de arquivos").toBe(total);
  for (const esperado of [
    "site/favicon.ico", "site/favicon.svg", "site/apple-touch-icon.png", "site/site.webmanifest", "site/COLE-NO-SITE.html",
    "redes/instagram-perfil-1080.png", "redes/youtube-banner-2560x1440.png",
    "endomarketing/glassdoor-capa-2880x550.png", "endomarketing/viva-engage-capa-1400x524.png",
    "email/assinatura-logo-600.png", "email/assinatura.html",
    "apresentacao/logotipo-2000.png", "apresentacao/simbolo-2000.png", "apresentacao/logotipo.svg", "LEIA-ME.txt",
  ]) expect(nomes, esperado).toContain(esperado);

  // Cada PNG tem o tamanho que o nome promete.
  expect(medidas(zip["redes/instagram-perfil-1080.png"])).toEqual({ largura: 1080, altura: 1080 });
  expect(medidas(zip["redes/linkedin-capa-1128x191.png"])).toEqual({ largura: 1128, altura: 191 });
  expect(medidas(zip["apresentacao/logotipo-2000.png"]).largura).toBe(2000);
  // O favicon.ico leva três imagens; o favicon.svg é o SÍMBOLO enviado.
  expect(new DataView(zip["site/favicon.ico"].buffer, zip["site/favicon.ico"].byteOffset).getUint16(4, true)).toBe(3);
  expect(strFromU8(zip["site/favicon.svg"])).toBe(SIMBOLO.toString());
  expect(strFromU8(zip["LEIA-ME.txt"])).toContain("entrou o símbolo");
  expect(strFromU8(zip["email/assinatura.html"])).toContain('src="assinatura-logo-600.png"');
});

test("só um grupo baixa só aquela pasta", async ({ page }) => {
  await page.goto("/ferramentas/kit");
  await page.locator("[data-kit-arquivo=logo]").setInputFiles({ name: "acme.svg", mimeType: "image/svg+xml", buffer: LOGO });
  await page.locator("[data-kit-aba=email]").click();
  const baixando = page.waitForEvent("download");
  await page.locator("[data-kit-baixar-grupo]").click();
  const download = await baixando;
  expect(download.suggestedFilename()).toBe("kit-acme-email.zip");
  const nomes = Object.keys(unzipSync(new Uint8Array(await readFile((await download.path())!))));
  expect(nomes.sort()).toEqual(["LEIA-ME.txt", "email/assinatura-logo-600.png", "email/assinatura.html"]);
});

test("imagem pequena avisa que vai sair borrada; fundo escuro avisa da versão em branco", async ({ page }) => {
  await page.goto("/ferramentas/kit");
  await page.locator("[data-kit-arquivo=logo]").setInputFiles({ name: "pequeno.png", mimeType: "image/png", buffer: PNG_PEQUENO });
  await expect(page.locator("[data-kit-aviso]").first()).toContainText("1 × 1 px");
  await page.locator("[data-kit-fundo=escuro]").click();
  await expect(page.locator("[data-kit-aviso]").filter({ hasText: "fundo escuro" })).toBeVisible();
});

test("a assinatura mostra o que a pessoa digita, sem executar marcação", async ({ page }) => {
  await page.goto("/ferramentas/kit");
  await page.locator("[data-kit-arquivo=logo]").setInputFiles({ name: "acme.svg", mimeType: "image/svg+xml", buffer: LOGO });
  await page.locator("[data-kit-aba=email]").click();
  await page.locator("[data-kit-assinatura=nome]").fill("Ana <img src=x onerror=alert(1)>");
  const previa = page.locator("[data-kit-assinatura-previa]");
  await expect(previa).toContainText("Ana <img src=x onerror=alert(1)>");
  await expect(previa.locator("img")).toHaveCount(1); // só o logo
});

test("as regras informadas pela pessoa: área de proteção aplicada e redução mínima avisada no arquivo e no LEIA-ME", async ({ page }) => {
  await page.goto("/ferramentas/kit");
  await page.locator("[data-kit-arquivo=logo]").setInputFiles({ name: "acme.svg", mimeType: "image/svg+xml", buffer: LOGO });
  await page.locator("summary").click();
  await page.locator("[data-kit-arquivo=simbolo]").setInputFiles({ name: "acme-simbolo.svg", mimeType: "image/svg+xml", buffer: SIMBOLO });
  await expect(page.locator("[data-kit-abaixo]")).toHaveCount(0);

  await page.locator("[data-kit-protecao]").fill("25");
  await page.locator("[data-kit-reducao-simbolo]").fill("24");
  // O símbolo no favicon de 16 px fica abaixo dos 24 px; no ícone do iPhone (180), não.
  await expect(page.locator("[data-kit-miniatura='favicon-16.png'] [data-kit-abaixo]")).toHaveText("abaixo da redução mínima (24 px)");
  await expect(page.locator("[data-kit-miniatura='apple-touch-icon.png'] [data-kit-abaixo]")).toHaveCount(0);
  await expect(page.locator("[data-kit-aviso]").filter({ hasText: "abaixo da redução mínima" })).toBeVisible();

  const baixando = page.waitForEvent("download");
  await page.locator("[data-kit-baixar-tudo]").click();
  const zip = unzipSync(new Uint8Array(await readFile((await (await baixando).path())!)));
  const leia = strFromU8(zip["LEIA-ME.txt"]);
  expect(leia).toContain("Área de proteção aplicada: 25% da altura do logo");
  expect(leia).toContain("Redução mínima do símbolo: 24 px");
  expect(leia).toContain("site/favicon-16.png");
  expect(leia).not.toContain("site/apple-touch-icon.png (");
});
