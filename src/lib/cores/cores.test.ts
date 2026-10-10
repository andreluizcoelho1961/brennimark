import assert from "node:assert/strict";
import test from "node:test";
import {
  compararComAMarca, contraste, deltaE2000, fraseDaComparacao, hexParaRgb, hsbParaRgb, lerCodigo, nomeDaCor, paletaEmAse, paletaEmCss, paletaEmJson,
  paletaEmTexto, rgbParaCmyk, rgbParaHex, rgbParaHsb, simularDaltonismo, veredito, type CorDaMarca,
} from "./cores";

test("HEX, RGB e HSB são a mesma cor", () => {
  assert.deepEqual(hexParaRgb("#FF4103"), [255, 65, 3]);
  assert.equal(rgbParaHex(255, 65, 3), "#FF4103");
  assert.deepEqual(rgbParaHsb(255, 65, 3), [15, 99, 100]);
  // HSB em inteiros (como no Photoshop): a volta pode errar 1 num canal — imperceptível.
  assert.ok(deltaE2000(rgbParaHex(...hsbParaRgb(15, 99, 100)), "#FF4103") < 1);
});

test("CMYK: aproximado, e o offset pede menos cor e mais preto", () => {
  assert.deepEqual(rgbParaCmyk(0, 0, 0), [0, 0, 0, 100]);
  assert.deepEqual(rgbParaCmyk(255, 255, 255), [0, 0, 0, 0]);
  const couche = rgbParaCmyk(0, 22, 33, "couche");
  const offset = rgbParaCmyk(0, 22, 33, "offset");
  assert.ok(offset[0] <= couche[0] && offset[3] >= couche[3]);
});

test("ler o código que a pessoa cola", () => {
  assert.equal(lerCodigo("ff4103"), "#FF4103");
  assert.equal(lerCodigo("#f40"), "#FF4400");
  assert.equal(lerCodigo("rgb(255, 65, 3)"), "#FF4103");
  assert.equal(lerCodigo("255 65 3"), "#FF4103");
  assert.ok(deltaE2000(lerCodigo("hsb(15, 99, 100)")!, "#FF4103") < 1);
  assert.equal(lerCodigo("cmyk(0, 0, 0, 100)"), "#000000");
  assert.equal(lerCodigo("rgb(300, 0, 0)"), null);
  assert.equal(lerCodigo("Brasa"), null);
});

test("o nome em português sai de regras", () => {
  assert.equal(nomeDaCor("#FFFFFF"), "branco");
  assert.equal(nomeDaCor("#000000"), "preto");
  assert.match(nomeDaCor("#FF4103"), /^laranja avermelhado.*vivo$/);
  assert.equal(nomeDaCor("#001621"), "azul muito escuro");
  assert.equal(nomeDaCor("#B0C3CA"), "azul acinzentado");
  assert.match(nomeDaCor("#808080"), /^cinza/);
});

test("contraste e veredito pela regra internacional", () => {
  assert.equal(Math.round(contraste("#000000", "#FFFFFF")), 21);
  assert.equal(contraste("#777777", "#777777"), 1);
  assert.deepEqual(veredito(21), { textoPequeno: "AAA", textoGrande: "AAA", iconesEBotoes: "passa" });
  assert.deepEqual(veredito(4.6), { textoPequeno: "AA", textoGrande: "AAA", iconesEBotoes: "passa" });
  assert.deepEqual(veredito(3.2), { textoPequeno: "não passa", textoGrande: "AA", iconesEBotoes: "passa" });
  assert.deepEqual(veredito(2), { textoPequeno: "não passa", textoGrande: "não passa", iconesEBotoes: "não passa" });
});

test("daltonismo: cinza continua cinza; vermelho muda para quem não vê vermelho", () => {
  assert.equal(simularDaltonismo("#808080", "protanopia"), "#808080");
  assert.notEqual(simularDaltonismo("#FF0000", "protanopia"), "#FF0000");
});

test("ΔE 2000: zero para a mesma cor; pequeno para quase iguais; grande para diferentes", () => {
  assert.equal(deltaE2000("#FF4103", "#FF4103"), 0);
  assert.ok(deltaE2000("#FF4103", "#FF4204") < 1);
  assert.ok(deltaE2000("#FF4103", "#0B4F9E") > 40);
});

const BRASA: CorDaMarca = { nome: "Brasa", hex: "#FF4103", status: "ready", pagina: 13, cmyk: "0 85 100 0", pms: null, rgb: null };
const NOITE: CorDaMarca = { nome: "Noite Polar", hex: "#001621", status: "ready", pagina: 13, cmyk: null, pms: null, rgb: null };
const APOIO: CorDaMarca = { nome: "Azul de apoio", hex: "#0B4F9E", status: "draft", pagina: 14, cmyk: null, pms: null, rgb: null };

test("é a cor da marca: igual, quase igual e diferente", () => {
  const igual = compararComAMarca("#FF4103", [BRASA, NOITE, APOIO]);
  assert.equal(igual.tipo, "igual");
  assert.equal(fraseDaComparacao(igual), "É Brasa (#FF4103), aprovada — manual, p. 13.");
  const quase = compararComAMarca("#F7430A", [BRASA, NOITE]); // ΔE ≈ 1,4
  assert.equal(quase.tipo, "quase");
  assert.match(fraseDaComparacao(quase), /^Praticamente Brasa/);
  const longe = compararComAMarca("#22AA44", [BRASA, NOITE]);
  assert.equal(longe.tipo, "diferente");
  assert.match(fraseDaComparacao(longe), /^Não é uma cor da marca/);
});

test("rascunho nunca vira cor da marca: aparece identificado", () => {
  const c = compararComAMarca("#0B4F9E", [BRASA, NOITE, APOIO]);
  assert.ok(c.tipo !== "sem-paleta" && !c.aprovada);
  assert.match(fraseDaComparacao(c), /ainda está em RASCUNHO/);
  assert.equal(compararComAMarca("#123456", []).tipo, "sem-paleta");
});

test("as exportações: CSS sem nomes repetidos, JSON com CMYK aproximado, texto e ASE válido", () => {
  const cores = [{ nome: "Brasa", hex: "#ff4103" }, { nome: "Brasa", hex: "#001621" }];
  assert.equal(paletaEmCss(cores), ":root {\n  --brasa: #FF4103;\n  --brasa-2: #001621;\n}\n");
  assert.deepEqual(JSON.parse(paletaEmJson(cores))[0].rgb, [255, 65, 3]);
  assert.equal(paletaEmTexto(cores), "Brasa #FF4103\nBrasa #001621");
  const ase = paletaEmAse(cores);
  assert.equal(String.fromCharCode(...ase.slice(0, 4)), "ASEF");
  const v = new DataView(ase.buffer);
  assert.equal(v.getUint32(8), 2);
  assert.equal(v.getUint16(12), 1);
  // primeiro bloco: tamanho = 2 + 6*2 ("Brasa\0") + 4 + 12 + 2 = 32
  assert.equal(v.getUint32(14), 32);
  assert.equal(ase.byteLength, 12 + 2 * (6 + 32));
});
