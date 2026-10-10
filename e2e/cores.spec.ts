import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { zlibSync } from "fflate";

/**
 * O Brennimark Cores (10/10/2026). A matemática (conversões, nome, contraste,
 * ΔE 2000, ASE) está provada em `src/lib/cores/cores.test.ts`; aqui, a tela.
 */

/** Um PNG de uma cor só, montado à mão — para provar que o clique no print pega a cor exata. */
function pngDeUmaCor(hex: string, lado = 8): Buffer {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const crcTabela = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf: Uint8Array) => { let c = 0xffffffff; for (const x of buf) c = crcTabela[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const bloco = (tipo: string, dados: Uint8Array) => {
    const corpo = new Uint8Array([...Buffer.from(tipo, "ascii"), ...dados]);
    const saida = Buffer.alloc(12 + dados.length);
    saida.writeUInt32BE(dados.length, 0); Buffer.from(corpo).copy(saida, 4); saida.writeUInt32BE(crc(corpo), 8 + dados.length);
    return saida;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0); ihdr.writeUInt32BE(lado, 4); ihdr[8] = 8; ihdr[9] = 2;
  const linhas = new Uint8Array(lado * (1 + lado * 3));
  for (let y = 0; y < lado; y++) for (let x = 0; x < lado; x++) linhas.set([r, g, b], y * (1 + lado * 3) + 1 + x * 3);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco("IHDR", ihdr), bloco("IDAT", zlibSync(linhas)), bloco("IEND", new Uint8Array())]);
}

test("o código digitado vira nome, códigos e CMYK aproximado; o papel troca o CMYK", async ({ page }) => {
  await page.goto("/ferramentas/cores");
  await page.locator("[data-cores-codigo]").fill("rgb(0, 22, 33)");
  await page.locator("[data-cores-codigo]").press("Enter");
  await expect(page.locator("[data-cores-hex]")).toHaveText("#001621");
  await expect(page.locator("[data-cores-nome]")).toHaveText("azul muito escuro");
  await expect(page.locator("[data-cores-valor=rgb]")).toHaveText("0 22 33");
  const couche = await page.locator("[data-cores-valor=cmyk]").textContent();
  await page.locator("[data-cores-papel=offset]").click();
  await expect(page.locator("[data-cores-valor=cmyk]")).not.toHaveText(couche!);
  await expect(page.locator("[data-cores]")).toContainText("aproximado · offset");

  await page.locator("[data-cores-codigo]").fill("Brasa");
  await page.locator("[data-cores-codigo]").press("Enter");
  await expect(page.locator("[data-cores] [role=alert]")).toContainText("Não reconheci esse código");
});

test("o contraste dá o veredito, e a área da marca convida a assinar", async ({ page }) => {
  await page.goto("/ferramentas/cores");
  await page.locator("[data-cores-codigo]").fill("#001621");
  await page.locator("[data-cores-codigo]").press("Enter");
  await page.locator("[data-cores-texto='#FFFFFF']").click();
  await expect(page.locator("[data-cores-contraste]")).toHaveText("Contraste 18,47 : 1");
  await expect(page.locator("[data-cores-veredito]")).toContainText("AAA");
  await expect(page.locator("[data-cores-daltonismo]")).toHaveCount(3);
  await expect(page.locator("[data-cores-marca]")).toContainText("No Brennimark, o Cores diz se essa é a cor da sua marca");
});

test("clicar no print pega a cor exata; a cor entra no histórico e sobrevive a recarregar; o CSS sai com ela", async ({ page }) => {
  await page.goto("/ferramentas/cores");
  await page.locator("[data-cores-print]").setInputFiles({ name: "print.png", mimeType: "image/png", buffer: pngDeUmaCor("#0B4F9E") });
  await page.locator("[data-cores-imagem]").click({ position: { x: 3, y: 3 } });
  await expect(page.locator("[data-cores-hex]")).toHaveText("#0B4F9E");
  await expect(page.locator("[data-cores-historico] button")).toHaveCount(1);

  await page.reload();
  await expect(page.locator("[data-cores-hex]")).toHaveText("#0B4F9E");

  const baixando = page.waitForEvent("download");
  await page.locator("[data-cores-exportar=css]").click();
  const download = await baixando;
  expect(download.suggestedFilename()).toBe("cores-pegas.css");
  expect(await readFile((await download.path())!, "utf8")).toContain(": #0B4F9E;");
});

test("no assinante: é a cor da marca, com a página e o CMYK do manual; rascunho aparece identificado", async ({ page }) => {
  await page.route("**/api/cores/paleta", (r) => r.fulfill({ json: {
    marca: "Brennimark",
    paleta: [
      { nome: "Brasa", hex: "#FF4103", status: "ready", pagina: 13, cmyk: "0 85 100 0", pms: "Declarado 172", rgb: null },
      { nome: "Noite Polar", hex: "#001621", status: "ready", pagina: 13, cmyk: null, pms: null, rgb: null },
      { nome: "Azul de apoio", hex: "#0B4F9E", status: "draft", pagina: 14, cmyk: null, pms: null, rgb: null },
    ],
  } }));
  await page.goto("/dev/cores-assinante");
  await page.locator("[data-cores-codigo]").fill("#FF4103");
  await page.locator("[data-cores-codigo]").press("Enter");
  await expect(page.locator("[data-cores-comparacao]")).toHaveText("É Brasa (#FF4103), aprovada — manual, p. 13.");
  await expect(page.locator("[data-cores-valor=cmyk]")).toHaveText("0 85 100 0");
  await expect(page.locator("[data-cores]")).toContainText("do manual, p. 13");
  await expect(page.locator("[data-cores-valor=pantone]")).toHaveText("Declarado 172");
  await expect(page.getByRole("link", { name: "Ver no manual, p. 13" })).toHaveAttribute("href", "/docs/original?pagina=13");

  await page.locator("[data-cores-paleta='#0B4F9E']").click();
  await expect(page.locator("[data-cores-comparacao]")).toContainText("ainda está em RASCUNHO");
  // A exportação leva a paleta APROVADA da marca, não as cores pegas.
  const baixando = page.waitForEvent("download");
  await page.locator("[data-cores-exportar=css]").click();
  const css = await readFile((await (await baixando).path())!, "utf8");
  expect(css).toContain("--brasa: #FF4103;");
  expect(css).not.toContain("#0B4F9E");
});
