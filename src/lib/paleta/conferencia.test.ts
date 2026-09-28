import assert from "node:assert/strict";
import test from "node:test";
import { conferirNoManual, conferirNoTexto, textosPorPagina } from "./conferencia";
import { codigosDaCor, comRotulo } from "./paleta";

// Uma página de amostras INVENTADA, no formato das tabelas reais: nome ou não,
// PMS, CMYK com letras, RGB às vezes sem o R, e o HEX sem "#".
const PAGINA = `
Paleta de cores   tons de apoio
TODOS   INSTITUCIONAL   PREMIUM
C12 M98 Y70 K0          PMS 428
R201 G30 B60            C0 M0 Y0 K12
C83022                  R230 G230 B230       PMS 9340C
                        E6E6E6               C3 M2 Y6 K0
C0 M0 Y0 K35            161 G163 B166        R247 G245 B238
R180 G182 B184          A1A3A6               F7F5EE
B4B6B8
Vermelho Fictício  PMS 185   C0 M95 Y80 K3   R200 G16 B46   c8102e
`;

const cor = (parcial: Partial<{ hex: string | null; rgb: string | null; cmyk: string | null; pms: string | null; pagina: number | null }>) => ({
  hex: null, rgb: null, cmyk: null, pms: null, pagina: 22, ...parcial,
});

test("cor cujos códigos estão todos escritos na página: conferida", () => {
  assert.deepEqual(conferirNoTexto(cor({ hex: "#C83022", rgb: "201 30 60", cmyk: "12 98 70 0" }), PAGINA), { estado: "conferida" });
  // Com letras, sem letras, PMS com e sem rótulo, HEX minúsculo no manual.
  assert.deepEqual(conferirNoTexto(cor({ hex: "#E6E6E6", rgb: "R230 G230 B230", cmyk: "C0 M0 Y0 K12", pms: "PMS 428" }), PAGINA), { estado: "conferida" });
  assert.deepEqual(conferirNoTexto(cor({ hex: "#F7F5EE", rgb: "247 246 238".replace("246", "245"), cmyk: "3 2 6 0", pms: "9340C" }), PAGINA), { estado: "conferida" });
  assert.deepEqual(conferirNoTexto(cor({ hex: "#C8102E", pms: "Pantone 185", cmyk: "C0 M95 Y80 K3" }), PAGINA), { estado: "conferida" });
  // O manual imprimiu "161 G163 B166", sem o R: casa do mesmo jeito.
  assert.deepEqual(conferirNoTexto(cor({ hex: "#A1A3A6", rgb: "161 163 166" }), PAGINA), { estado: "conferida" });
});

test("um dígito trocado vira 'conferir', dizendo qual código não bateu", () => {
  assert.deepEqual(
    conferirNoTexto(cor({ hex: "#C83023", rgb: "201 30 60", cmyk: "12 98 70 1" }), PAGINA),
    { estado: "conferir", faltam: ["HEX", "CMYK"] },
  );
  // "PMS 18" não é "PMS 185"; "K1" não casa dentro de "K12".
  assert.deepEqual(conferirNoTexto(cor({ pms: "PMS 18" }), PAGINA), { estado: "conferir", faltam: ["PMS"] });
  assert.deepEqual(conferirNoTexto(cor({ cmyk: "0 0 0 1" }), PAGINA), { estado: "conferir", faltam: ["CMYK"] });
  // Os números certos na ORDEM errada também não conferem.
  assert.deepEqual(conferirNoTexto(cor({ rgb: "60 30 201" }), PAGINA), { estado: "conferir", faltam: ["RGB"] });
});

test("sem página, ou sem texto da página, não há o que conferir", () => {
  assert.deepEqual(conferirNoTexto(cor({ hex: "#C83022", pagina: null }), PAGINA), { estado: "sem-pagina" });
  assert.deepEqual(conferirNoTexto(cor({ hex: "#C83022" }), null), { estado: "sem-pagina" });
});

test("o texto de cada página sai dos trechos que a cobrem", () => {
  const mapa = textosPorPagina([
    { page_start: 21, page_end: 21, content: "vinte e um" },
    { page_start: 20, page_end: 22, content: "seção longa" },
    { page_start: 30, page_end: null, content: "trinta" },
  ], [21, 22, 30, 40]);
  assert.equal(mapa.get(21), "vinte e um\nseção longa");
  assert.equal(mapa.get(22), "seção longa");
  assert.equal(mapa.get(30), "trinta");
  assert.equal(mapa.has(40), false);
});

test("o rótulo não se repete: 'PMS 427', nunca 'PMS PMS 427'", () => {
  assert.equal(comRotulo("PMS", "PMS 427"), "PMS 427");
  assert.equal(comRotulo("PMS", "Pantone 186 C"), "Pantone 186 C");
  assert.equal(comRotulo("PMS", "186 C"), "PMS 186 C");
  assert.equal(comRotulo("RGB", "RGB 1 2 3"), "RGB 1 2 3");
  assert.equal(comRotulo("RGB", "R204 G9 B47"), "RGB R204 G9 B47");
  assert.deepEqual(codigosDaCor({ hex: "#CC092F", rgb: null, cmyk: "C0 M100 Y75 K4", pms: "PMS 186" }), ["HEX #CC092F", "CMYK C0 M100 Y75 K4", "PMS 186"]);
});

test("códigos que não estão na página gravada, mas estão em outra: diz qual", () => {
  // Ensaio de 27/09: o branco foi para a p. 21, e os códigos dele estão na 22.
  const textos = new Map([[21, "O branco é a cor que acompanha o vermelho."], [22, PAGINA]]);
  assert.deepEqual(
    conferirNoManual(cor({ hex: "#E6E6E6", cmyk: "0 0 0 12", pagina: 21 }), textos),
    { estado: "conferir", faltam: ["HEX", "CMYK"], achadaNaPagina: 22 },
  );
  assert.deepEqual(conferirNoManual(cor({ hex: "#E6E6E6", pagina: 22 }), textos), { estado: "conferida" });
  // Em página nenhuma: sem sugestão de página.
  assert.deepEqual(conferirNoManual(cor({ hex: "#123456", pagina: 21 }), textos), { estado: "conferir", faltam: ["HEX"] });
});
