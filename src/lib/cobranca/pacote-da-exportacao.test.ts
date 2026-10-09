import assert from "node:assert/strict";
import test from "node:test";
import { csv, nomeDoZip, nomeSeguro, pacoteDaMarca, textoDosQueFaltaram, type MarcaDoManifesto } from "./pacote-da-exportacao";

const MARCA: MarcaDoManifesto = {
  id: "m1", nome: "Marca Um", chave: "marca-um",
  arquivos: [
    { chave: "documento:1", tipo: "manual", nome: "Manual (v2)", bytes: 1000, detalhes: { situacao: "ativa", paginas: 40 } },
    { chave: "documento:2", tipo: "manual", nome: "Manual (v1)", bytes: 900, detalhes: { situacao: "substituida" } },
    { chave: "material:1", tipo: "material", nome: "logo.svg", bytes: 10, detalhes: { item: "Logotipo", status: "ready", cor: "colorido" } },
    { chave: "material:2", tipo: "material", nome: "logo.svg", bytes: 11, detalhes: { item: "Logotipo", status: "ready" } },
    { chave: "material:3", tipo: "material", nome: "velho.svg", bytes: 12, detalhes: { item: "Logotipo", descontinuado_em: "2026-09-01T00:00:00Z" } },
    { chave: "material:4", tipo: "material", nome: "solto.png", bytes: 13, detalhes: { item: null } },
    { chave: "analise:1", tipo: "analise", nome: "peca.png", bytes: 14, detalhes: { pergunta: "ok?", veredito: "aligned" } },
  ],
  complementos: [{ slug: "tom-de-voz", titulo: "Tom de voz", versao: 2, texto: "Falamos simples.", publicado_em: "2026-10-01T00:00:00Z" }],
  links: [{ nome: "Gráfica", destinatario: "Gráfica X", criado_em: "2026-10-01", expira_em: "2026-10-08", revogado_em: null }],
};

function caminhos(m: MarcaDoManifesto) {
  return pacoteDaMarca(m, "Conta", "2026-10-08T12:00:00Z").map((e) => e.caminho);
}

test("cada original vai para a sua pasta; o substituído e o descontinuado ficam à parte", () => {
  assert.deepEqual(caminhos(MARCA), [
    "manuais/Manual (v2).pdf",
    "manuais/substituidos/Manual (v1).pdf",
    "materiais/Logotipo/logo.svg",
    "materiais/Logotipo/logo (2).svg",
    "materiais/descontinuados/Logotipo/velho.svg",
    "materiais/sem item/solto.png",
    "analises/peca.png",
    "complementos/tom-de-voz.md",
    "indice.csv",
    "links-de-entrega.csv",
    "LEIA-ME.txt",
  ]);
});

test("os arquivos levam a chave do manifesto, nunca um caminho do Storage", () => {
  const arquivos = pacoteDaMarca(MARCA, "Conta", "2026-10-08T12:00:00Z").filter((e) => e.tipo === "arquivo");
  assert.deepEqual(arquivos.map((e) => e.tipo === "arquivo" && e.chave), MARCA.arquivos.map((a) => a.chave));
});

test("o índice tem uma linha por arquivo e por complemento, e abre no Excel em português", () => {
  const indice = pacoteDaMarca(MARCA, "Conta", "2026-10-08T12:00:00Z").find((e) => e.caminho === "indice.csv");
  assert.ok(indice && indice.tipo === "texto");
  assert.ok(indice.texto.startsWith("﻿\"arquivo\";\"tipo\""));
  const linhas = indice.texto.trim().split("\r\n");
  assert.equal(linhas.length, 1 + MARCA.arquivos.length + MARCA.complementos.length);
  assert.match(linhas[3], /^"materiais\/Logotipo\/logo\.svg";"material";"Logotipo";"ready";"";"";"colorido"/);
});

test("o complemento vira Markdown com o título", () => {
  const c = pacoteDaMarca(MARCA, "Conta", "2026-10-08T12:00:00Z").find((e) => e.caminho === "complementos/tom-de-voz.md");
  assert.deepEqual(c, { tipo: "texto", caminho: "complementos/tom-de-voz.md", texto: "# Tom de voz\n\nFalamos simples.\n" });
});

test("sem links, não há planilha de links", () => {
  assert.ok(!caminhos({ ...MARCA, links: [] }).includes("links-de-entrega.csv"));
});

test("nome seguro: sem barra, sem caminho para cima, sem vazio, até 120 com a extensão", () => {
  const subindo = nomeSeguro("../../etc/passwd");
  assert.ok(!subindo.includes("/") && !subindo.startsWith("."), subindo);
  assert.equal(nomeSeguro("a/b\\c:d"), "a-b-c-d");
  assert.equal(nomeSeguro("   "), "arquivo");
  assert.equal(nomeSeguro("", "sem item"), "sem item");
  const longo = nomeSeguro("x".repeat(200) + ".pdf");
  assert.equal(longo.length, 120);
  assert.ok(longo.endsWith(".pdf"));
});

test("o CSV dobra as aspas e põe tudo entre aspas", () => {
  assert.equal(csv([["a\"b", 1, null]]), "﻿\"a\"\"b\";\"1\";\"\"\r\n");
});

test("o CSV desarma fórmula vinda de texto, e não mexe em número", () => {
  assert.equal(csv([["=HYPERLINK(\"x\")", "+1", "-a", "@b", "\tc", "ok", -5]]),
    "\ufeff\"'=HYPERLINK(\"\"x\"\")\";\"'+1\";\"'-a\";\"'@b\";\"'\tc\";\"ok\";\"-5\"\r\n");
});

test("o nome do ZIP leva a marca e o dia", () => {
  assert.equal(nomeDoZip({ chave: "marca-um" }, "2026-10-08T23:00:00Z"), "brennimark-marca-um-2026-10-08.zip");
});

test("o aviso dos que faltaram diz quantos e quais", () => {
  assert.match(textoDosQueFaltaram(["manuais/a.pdf"]), /^Estes 1 arquivo\(s\)[\s\S]*manuais\/a\.pdf/);
});
