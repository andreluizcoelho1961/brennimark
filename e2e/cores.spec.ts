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
  // As cores pegas na tela são da pessoa, não da marca: exportar não chama o registro.
  let registros = 0;
  await page.route("**/api/cores/paleta/baixada", (r) => { registros += 1; return r.fulfill({ json: { ok: true } }); });
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
  expect(registros).toBe(0);
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
  const registrados: unknown[] = [];
  await page.route("**/api/cores/paleta/baixada", (r) => { registrados.push(r.request().postDataJSON()); return r.fulfill({ json: { ok: true } }); });
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
  // O clique grava o formato e quantas cores foram (as 2 aprovadas), antes do arquivo.
  expect(registrados).toEqual([{ formato: "css", cores: 2 }]);
});

test("no assinante: se o download da paleta não puder ser registrado, nada é baixado e a tela diz por quê", async ({ page }) => {
  await page.route("**/api/cores/paleta", (r) => r.fulfill({ json: {
    marca: "Brennimark",
    paleta: [{ nome: "Brasa", hex: "#FF4103", status: "ready", pagina: 13, cmyk: null, pms: null, rgb: null }],
  } }));
  await page.route("**/api/cores/paleta/baixada", (r) => r.fulfill({ status: 503, json: { message: "Não foi possível registrar o download, então ele não foi iniciado. Tente de novo." } }));
  await page.goto("/dev/cores-assinante");
  let baixou = false;
  page.on("download", () => { baixou = true; });
  await page.locator("[data-cores-exportar=ase]").click();
  await expect(page.locator("[data-cores-erro-do-download]")).toContainText("não foi iniciado");
  await page.waitForTimeout(500);
  expect(baixou, "sem linha em Registros, o arquivo não sai").toBe(false);
});

test("sem conta-gotas de tela (Safari): o botão abre o seletor de cores do sistema, e a cor escolhida é medida", async ({ page }) => {
  // Como o Safari no Mac: sem EyeDropper.
  await page.addInitScript(() => {
    delete (window as unknown as { EyeDropper?: unknown }).EyeDropper;
    Object.defineProperty(navigator, "userAgent", { get: () => "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" });
  });
  await page.goto("/ferramentas/cores");
  await expect(page.locator("[data-cores-conta-gotas]")).toHaveCount(0);
  await expect(page.getByText("Conta-gotas do Mac", { exact: true })).toBeVisible();
  const passos = page.locator("[data-cores-passos-do-mac] li");
  await expect(passos).toHaveCount(4);
  await expect(passos.nth(1)).toContainText("Mostrar cores…");
  await expect(passos.nth(1)).toContainText("Show Colors…");
  await expect(passos.nth(2)).toContainText("lupa");

  // A dica (tooltip): aparece ao passar o mouse, some no clique.
  const dica = page.locator("[data-cores-dica]");
  await expect(dica).toBeHidden();
  await page.locator("[data-cores-seletor-do-sistema]").hover();
  await expect(dica).toBeVisible();
  await expect(dica).toContainText("Show Colors…");
  await page.mouse.move(0, 0);
  await expect(dica).toBeHidden();
  await page.locator("[data-cores-seletor-do-sistema]").fill("#0b4f9e");
  await expect(page.locator("[data-cores-hex]")).toHaveText("#0B4F9E");
});

test("com conta-gotas de tela (Chrome): o botão é o conta-gotas, não o seletor do sistema", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { EyeDropper: unknown }).EyeDropper = class { open() { return Promise.resolve({ sRGBHex: "#ff4103" }); } };
  });
  await page.goto("/ferramentas/cores");
  await expect(page.locator("[data-cores-seletor-do-sistema]")).toHaveCount(0);
  await page.locator("[data-cores-conta-gotas]").click();
  await expect(page.locator("[data-cores-hex]")).toHaveText("#FF4103");
});

test("no assinante: a cor da vez é medida contra todas as cores da marca, com rascunho identificado e a tabela completa", async ({ page }) => {
  await page.route("**/api/cores/paleta", (r) => r.fulfill({ json: {
    marca: "Brennimark",
    paleta: [
      { nome: "Brasa", hex: "#FF4103", status: "ready", pagina: 13, cmyk: null, pms: null, rgb: null },
      { nome: "Noite Polar", hex: "#001621", status: "ready", pagina: 13, cmyk: null, pms: null, rgb: null },
      { nome: "Azul de apoio", hex: "#0B4F9E", status: "draft", pagina: 14, cmyk: null, pms: null, rgb: null },
    ],
  } }));
  await page.goto("/dev/cores-assinante");
  await page.locator("[data-cores-codigo]").fill("#FFFFFF");
  await page.locator("[data-cores-codigo]").press("Enter");

  const bloco = page.locator("[data-cores-sobre-a-paleta]");
  await expect(bloco).toBeVisible();
  const linhas = bloco.locator("[data-cor-sobre-a-paleta]");
  await expect(linhas).toHaveCount(3);
  // Branco sobre Noite Polar (#001621): contraste altíssimo, passa em tudo.
  const noite = linhas.filter({ hasText: "Noite Polar" });
  expect(Number(await noite.getAttribute("data-razao"))).toBeGreaterThan(15);
  await expect(noite.locator("[data-passa=nao]")).toHaveCount(0);
  // O rascunho é medido, mas vem identificado, e a linha não é afirmada.
  const azul = linhas.filter({ hasText: "Azul de apoio" });
  await expect(azul.locator("[data-cor-em-rascunho]")).toBeVisible();
  await expect(azul).toHaveAttribute("data-afirmado", "nao");
  await expect(noite).toHaveAttribute("data-afirmado", "sim");
  // Aprovado e reprovado se dizem por palavra e sinal, não só por cor.
  await expect(noite).toContainText("✓");

  // A tabela completa da paleta (a mesma da ficha) abre sem sair da ferramenta.
  await bloco.locator("[data-cores-tabela-da-paleta] > summary").click();
  await expect(bloco.locator("[data-contraste-da-paleta]")).toBeVisible();
});

test("fora do assinante, o bloco de contraste com a paleta não existe", async ({ page }) => {
  await page.goto("/ferramentas/cores");
  await expect(page.locator("[data-cores]")).toBeVisible();
  await expect(page.locator("[data-cores-sobre-a-paleta]")).toHaveCount(0);
});

test("a simulação de daltonismo diz que é simulação, não sugestão de cor", async ({ page }) => {
  await page.goto("/ferramentas/cores");
  await expect(page.locator("[data-cores-daltonismo-nota]")).toContainText("não uma sugestão de cor");
});

test("no assinante: o ajuste sugere só cores APROVADAS da marca, nunca rascunho nem cor de fora", async ({ page }) => {
  await page.route("**/api/cores/paleta", (r) => r.fulfill({ json: {
    marca: "Brennimark",
    paleta: [
      { nome: "Brasa", hex: "#FF4103", status: "ready", pagina: 13, cmyk: null, pms: null, rgb: null },
      { nome: "Noite Polar", hex: "#001621", status: "ready", pagina: 13, cmyk: null, pms: null, rgb: null },
      { nome: "Verde de teste", hex: "#00AA00", status: "draft", pagina: 14, cmyk: null, pms: null, rgb: null },
    ],
  } }));
  await page.goto("/dev/cores-assinante");
  await page.locator("[data-cores-codigo]").fill("#FF4103");
  await page.locator("[data-cores-codigo]").press("Enter");

  // Brasa com texto branco: 3,49:1, não passa em texto comum, e o ajuste oferece a Noite Polar.
  const ajuste = page.locator("[data-cores-ajuste]");
  await expect(ajuste.locator("[data-cores-ajuste-estado=sugestoes]")).toBeVisible();
  await expect(ajuste.locator("[data-cores-sugestao][data-hex='#001621']").first()).toBeVisible();
  // Rascunho nunca é sugerido, e nada fora da paleta aparece.
  await expect(ajuste.locator("[data-cores-sugestao][data-hex='#00AA00']")).toHaveCount(0);
  const hexes = await ajuste.locator("[data-cores-sugestao]").evaluateAll((els) => els.map((e) => e.getAttribute("data-hex")));
  for (const h of hexes) expect(["#001621", "#FF4103"]).toContain(h);

  // Para texto grande o par já passa (3,49 ≥ 3): a tela diz isso, sem sugerir.
  await ajuste.locator("[data-cores-ajuste-uso=texto-grande]").click();
  await expect(ajuste.locator("[data-cores-ajuste-estado=ja-passa]")).toBeVisible();
});

test("no assinante: sem cor aprovada que resolva, o Cores diz isso e não inventa cor", async ({ page }) => {
  await page.route("**/api/cores/paleta", (r) => r.fulfill({ json: {
    marca: "Brennimark",
    paleta: [
      { nome: "Brasa", hex: "#FF4103", status: "ready", pagina: 13, cmyk: null, pms: null, rgb: null },
      // Um preto em RASCUNHO resolveria o par, mas rascunho não é sugerido.
      { nome: "Preto de teste", hex: "#000000", status: "draft", pagina: 14, cmyk: null, pms: null, rgb: null },
    ],
  } }));
  await page.goto("/dev/cores-assinante");
  await page.locator("[data-cores-codigo]").fill("#FF4103");
  await page.locator("[data-cores-codigo]").press("Enter");
  const ajuste = page.locator("[data-cores-ajuste]");
  await expect(ajuste.locator("[data-cores-ajuste-estado=nenhuma]")).toContainText("não inventa cor fora da paleta");
  await expect(ajuste.locator("[data-cores-sugestao]")).toHaveCount(0);
});

test("fora do assinante, o ajuste com cores da marca não existe", async ({ page }) => {
  await page.goto("/ferramentas/cores");
  await expect(page.locator("[data-cores]")).toBeVisible();
  await expect(page.locator("[data-cores-ajuste]")).toHaveCount(0);
});
