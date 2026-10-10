import assert from "node:assert/strict";
import test from "node:test";
import { GRUPOS_DO_KIT, ITENS_DO_KIT } from "./tamanhos";
import {
  alturaDoItem, assinaturaHtml, avisosDoArquivo, encaixe, enderecoDoSite, escaparHtml, favicoIco, leiaMe, manifestDoSite, trechoDoHead,
} from "./pacote";

// ─── A tabela ──────────────────────────────────────────────────────────────

test("a tabela: nomes de arquivo únicos, legíveis, e cada item num grupo conhecido", () => {
  const nomes = ITENS_DO_KIT.map((i) => i.arquivo);
  assert.equal(new Set(nomes).size, nomes.length, "arquivo repetido");
  const grupos = new Set(GRUPOS_DO_KIT.map((g) => g.id));
  for (const i of ITENS_DO_KIT) {
    assert.match(i.arquivo, /^[a-z0-9-]+\.png$/, i.arquivo);
    assert.ok(grupos.has(i.grupo), i.arquivo);
    assert.ok(i.largura > 0 && i.altura >= 0, i.arquivo);
    assert.ok(i.altura > 0 || i.formato === "transparente", `${i.arquivo}: altura automática só em transparente`);
  }
});

test("a tabela: Gupy, Glassdoor, Viva Engage, evento do LinkedIn e Workspace têm medida conferida, com a página", () => {
  for (const i of ITENS_DO_KIT.filter((x) => /gupy|glassdoor|viva-engage|linkedin-evento|google-workspace/.test(x.arquivo))) {
    assert.equal(i.fonte.tipo, "conferido", i.arquivo);
    if (i.fonte.tipo === "conferido") assert.match(i.fonte.url, /^https:\/\//);
  }
});

test("a tabela: as plataformas de vagas sem medida confirmada ficam fora", () => {
  assert.ok(!ITENS_DO_KIT.some((i) => /indeed|vagas|catho|infojobs|workplace/.test(i.arquivo)));
});

test("a tabela: o favicon.ico leva 16, 32 e 48", () => {
  assert.deepEqual(ITENS_DO_KIT.filter((i) => i.ico).map((i) => i.largura), [16, 32, 48]);
});

// ─── O encaixe ─────────────────────────────────────────────────────────────

const LOGO = { largura: 400, altura: 100 }; // 4:1
const SIMBOLO = { largura: 100, altura: 100 };

test("altura automática segue a proporção do desenho", () => {
  assert.equal(alturaDoItem({ largura: 2000, altura: 0 }, LOGO), 500);
  assert.equal(alturaDoItem({ largura: 600, altura: 0 }, LOGO), 150);
  assert.equal(alturaDoItem({ largura: 400, altura: 400 }, LOGO), 400);
});

test("no perfil em círculo, as quatro pontas do desenho ficam dentro do círculo", () => {
  for (const desenho of [LOGO, SIMBOLO, { largura: 100, altura: 300 }]) {
    const r = encaixe({ largura: 1080, altura: 1080, formato: "circulo" }, desenho, 0.1);
    const centro = 540;
    for (const [x, y] of [[r.x, r.y], [r.x + r.largura, r.y], [r.x, r.y + r.altura], [r.x + r.largura, r.y + r.altura]]) {
      assert.ok(Math.hypot(x - centro, y - centro) <= 540 * (1 - 0.2) + 1e-6, `ponta fora do círculo: ${x},${y}`);
    }
  }
});

test("o ícone adaptável do Android põe o desenho dentro do círculo de 80%", () => {
  const r = encaixe({ largura: 512, altura: 512, formato: "quadrado", circuloSeguro: 0.8 }, SIMBOLO, 0);
  const diagonal = Math.hypot(r.largura, r.altura);
  assert.ok(diagonal <= 512 * 0.8 + 1e-6);
});

test("na faixa, o desenho fica centrado e no máximo meia altura", () => {
  const r = encaixe({ largura: 1500, altura: 500, formato: "faixa" }, SIMBOLO, 0.1);
  assert.ok(r.altura <= 250 + 1e-6);
  assert.ok(Math.abs(r.x + r.largura / 2 - 750) < 1e-6 && Math.abs(r.y + r.altura / 2 - 250) < 1e-6);
});

test("no banner do YouTube, o desenho cabe na área que aparece em todo aparelho", () => {
  const banner = ITENS_DO_KIT.find((i) => i.arquivo.startsWith("youtube-banner"))!;
  const r = encaixe(banner, LOGO, 0.1);
  assert.ok(r.largura <= 1546 + 1e-6 && r.altura <= 423 + 1e-6);
});

test("no quadrado, a margem é respeitada nos dois eixos", () => {
  const r = encaixe({ largura: 400, altura: 400, formato: "quadrado" }, LOGO, 0.1);
  assert.ok(r.x >= 40 - 1e-6 && r.largura <= 320 + 1e-6);
});

test("na videochamada, a marca fica no canto de cima à direita e o centro fica livre", () => {
  const r = encaixe({ largura: 1920, altura: 1080, formato: "videochamada" }, LOGO, 0.1);
  assert.ok(r.x > 1920 / 2 && r.y < 1080 / 4);
  assert.ok(r.x + r.largura <= 1920 && r.y >= 0);
});

test("o arquivo transparente é o próprio desenho, inteiro", () => {
  assert.deepEqual(encaixe({ largura: 2000, altura: 0, formato: "transparente" }, LOGO, 0.2), { x: 0, y: 0, largura: 2000, altura: 500 });
});

// ─── O favicon.ico ─────────────────────────────────────────────────────────

test("o .ico tem o cabeçalho certo e os PNGs em sequência", () => {
  const a = new Uint8Array([1, 2, 3]);
  const b = new Uint8Array([4, 5]);
  const ico = favicoIco([{ tamanho: 16, bytes: a }, { tamanho: 32, bytes: b }]);
  const v = new DataView(ico.buffer);
  assert.equal(v.getUint16(2, true), 1);
  assert.equal(v.getUint16(4, true), 2);
  assert.equal(v.getUint8(6), 16);
  assert.equal(v.getUint32(6 + 8, true), 3);
  assert.equal(v.getUint32(6 + 12, true), 38);
  assert.equal(v.getUint8(22), 32);
  assert.equal(v.getUint32(22 + 12, true), 41);
  assert.deepEqual([...ico.slice(38)], [1, 2, 3, 4, 5]);
});

// ─── Os textos ─────────────────────────────────────────────────────────────

test("o manifest e o trecho do <head> apontam para os arquivos do pacote", () => {
  const m = JSON.parse(manifestDoSite("Acme", "#ffffff"));
  assert.equal(m.name, "Acme");
  assert.deepEqual(m.icons.map((i: { src: string }) => i.src), ["/android-192.png", "/android-512.png", "/android-adaptavel-512.png"]);
  assert.equal(m.icons[2].purpose, "maskable");
  for (const i of m.icons) assert.ok(ITENS_DO_KIT.some((x) => "/" + x.arquivo === i.src), i.src);
  assert.match(trechoDoHead(true), /favicon\.svg/);
  assert.doesNotMatch(trechoDoHead(false), /favicon\.svg/);
});

test("a assinatura escapa o que a pessoa digita e não aceita link perigoso", () => {
  const html = assinaturaHtml(
    { nome: "Ana <script>alert(1)</script>", cargo: "Diretora & sócia", telefone: "", site: "javascript:alert(1)", empresa: "Acme" },
    "assinatura-logo-600.png",
  );
  assert.doesNotMatch(html, /<script/);
  assert.match(html, /Ana &lt;script&gt;/);
  assert.match(html, /Diretora &amp; sócia/);
  assert.doesNotMatch(html, /href="javascript/);
  assert.doesNotMatch(html, /<br><span[^>]*><\/span>/, "linha vazia para o telefone em branco");
});

test("o site vira link https, com ou sem o protocolo digitado", () => {
  assert.equal(enderecoDoSite("acme.com.br"), "https://acme.com.br");
  assert.equal(enderecoDoSite("https://www.acme.com/contato"), "https://www.acme.com/contato");
  assert.equal(enderecoDoSite("javascript:alert(1)"), null);
  assert.equal(enderecoDoSite("não é site"), null);
  assert.equal(escaparHtml(`"'`), "&quot;&#39;");
});

test("o LEIA-ME diz o que entrou nos tamanhos pequenos", () => {
  assert.match(leiaMe("Acme", true, true), /entrou o símbolo/);
  assert.match(leiaMe("Acme", false, true), /logotipo inteiro entrou também/);
});

test("avisos do arquivo: JPG sem transparência e imagem pequena", () => {
  assert.equal(avisosDoArquivo({ tipo: "image/svg+xml", largura: 100, altura: 50 }).length, 0);
  assert.equal(avisosDoArquivo({ tipo: "image/png", largura: 2000, altura: 500 }).length, 0);
  assert.match(avisosDoArquivo({ tipo: "image/png", largura: 600, altura: 150 })[0], /600 × 150/);
  assert.equal(avisosDoArquivo({ tipo: "image/jpeg", largura: 600, altura: 150 }).length, 2);
});
