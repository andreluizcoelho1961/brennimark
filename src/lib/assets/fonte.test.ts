import assert from "node:assert/strict";
import test from "node:test";
import { ehLicenca, frasesDaLicenca, leiaMeDaMarca, leiaMeDeFontes, tipoDaFonte } from "./fonte";

test("só formato de instalar é fonte; webfont e o resto não", () => {
  assert.equal(tipoDaFonte("Inter-Regular.ttf"), "font/ttf");
  assert.equal(tipoDaFonte("Marca.OTF"), "font/otf");
  assert.equal(tipoDaFonte("colecao.ttc"), "font/collection");
  for (const nao of ["site.woff", "site.woff2", "logo.svg", "semextensao", "arquivo.ttf.pdf", ".ttf-escondido"]) assert.equal(tipoDaFonte(nao), null, nao);
});

test("a licença é de lista fechada", () => {
  assert.ok(ehLicenca("livre") && ehLicenca("exclusiva") && ehLicenca("comprada"));
  assert.ok(!ehLicenca("qualquer") && !ehLicenca(null) && !ehLicenca(3));
});

test("as frases da licença levam titular e como obter, nos dois idiomas", () => {
  const pt = frasesDaLicenca({ tipo: "comprada", titular: "Foundry X", comoObter: "foundryx.com" }, false);
  assert.ok(pt[0].startsWith("Licença: Comprada"));
  assert.ok(pt.includes("Titular: Foundry X") && pt.includes("Como obter: foundryx.com"));
  const en = frasesDaLicenca({ tipo: "livre", titular: null, comoObter: null }, true);
  assert.equal(en.length, 2);
  assert.ok(en[0].startsWith("License: Free"));
});

test("o LEIA-ME das fontes diz a licença e como instalar nos dois sistemas", () => {
  const texto = leiaMeDeFontes({ marca: "Acme", item: "Inter", arquivos: ["Inter-Regular.ttf"], licenca: { tipo: "livre", titular: null, comoObter: null }, ingles: false });
  for (const trecho of ["Acme — Inter", "Inter-Regular.ttf", "LICENÇA", "Mac:", "Windows:", ".ttc"]) assert.ok(texto.includes(trecho), trecho);
  assert.ok(!texto.includes("LICENSE"));
  const sem = leiaMeDeFontes({ marca: "A", item: "B", arquivos: [], licenca: null, ingles: true });
  assert.ok(!sem.includes("LICENSE") && sem.includes("HOW TO INSTALL"));
});

test("o LEIA-ME da marca lista as pastas e leva a licença de cada fonte", () => {
  const texto = leiaMeDaMarca({
    marca: "Acme", pastas: [{ pasta: "logo/Logo", arquivos: 4 }, { pasta: "fonte/Inter", arquivos: 2 }],
    fontes: [{ item: "Inter", licenca: { tipo: "livre", titular: null, comoObter: null } }], ingles: false,
  });
  for (const trecho of ["Acme — todos os materiais", "logo/Logo  (4)", "FONTES", "Inter", "Licença: Livre"]) assert.ok(texto.includes(trecho), trecho);
  assert.ok(!leiaMeDaMarca({ marca: "A", pastas: [], fontes: [], ingles: false }).includes("FONTES"));
});
