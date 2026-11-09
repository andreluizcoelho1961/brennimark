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

test("tabela com o rótulo no cabeçalho: o Pantone solto confere, e o que não tem Pantone não exige", () => {
  // O manual do Brennimark (v0.3, p. 14–15): "PANTONE · REF." na linha de cima, "172 C" na de baixo.
  const TABELA = `
Brasa            HEX           RGB          CMYK · REF.        PANTONE · REF.
                 #FF4103       255 / 65 / 3   0 / 85 / 100 / 0   172 C
Noite Polar      #001621       0 / 22 / 33    100 / 65 / 40 / 85   Black 6 C
Gelo             #F2F5F6       242 / 245 / 246  3 / 1 / 1 / 0     — (papel branco)
`;
  assert.deepEqual(conferirNoTexto(cor({ hex: "#FF4103", rgb: "255 / 65 / 3", cmyk: "0 / 85 / 100 / 0", pms: "172 C" }), TABELA), { estado: "conferida" });
  // "—": a cor declara que não tem Pantone. Nada a procurar.
  assert.deepEqual(conferirNoTexto(cor({ hex: "#F2F5F6", pms: "- (papel branco)" }), TABELA), { estado: "conferida" });
  assert.deepEqual(conferirNoTexto(cor({ pms: "n/a" }), TABELA), { estado: "conferida" });
  // Sem a palavra Pantone/PMS na página, o número solto NÃO vale.
  assert.deepEqual(conferirNoTexto(cor({ pms: "172 C" }), "Brasa  #FF4103  172 C"), { estado: "conferir", faltam: ["PMS"] });
  // Um número pequeno e sem letra casaria com um canal de cor: não vale solto.
  assert.deepEqual(conferirNoTexto(cor({ pms: "65" }), TABELA), { estado: "conferir", faltam: ["PMS"] });
  // E outro código com o mesmo começo não confere: "17" não é "172 C".
  assert.deepEqual(conferirNoTexto(cor({ pms: "17 C" }), TABELA), { estado: "conferir", faltam: ["PMS"] });
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

test("HEX partido por espaço no texto extraído ainda confere; colado em outro código, não", () => {
  // Ensaio de 28/09: o texto indexado do Bradesco veio com os HEX partidos
  // ("D12 244", "C F C9C1") e 8 das 19 cores ficaram "conferir" à toa.
  const partido = "R209 G34 B68 D12 244 EDEDED E CE7DE B A0A29 A 5091B C F C9C1 96 0D1F 808285";
  for (const hex of ["#D12244", "#ECE7DE", "#BA0A29", "#A5091B", "#CFC9C1", "#960D1F", "#808285"]) {
    assert.deepEqual(conferirNoTexto(cor({ hex }), partido), { estado: "conferida" }, hex);
  }
  // Pedaços de dois códigos vizinhos não formam um terceiro.
  assert.deepEqual(conferirNoTexto(cor({ hex: "#0D1F80" }), partido), { estado: "conferir", faltam: ["HEX"] });
  assert.deepEqual(conferirNoTexto(cor({ hex: "#D12245" }), partido), { estado: "conferir", faltam: ["HEX"] });
});
