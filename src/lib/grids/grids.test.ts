import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { FORMATOS, FORMATOS_GRATIS, GRUPOS, formatoPorId } from "./formatos";
import { PT_POR_MM, calcularGrid, escolhasPadrao, margensClassicas, recortar, type Escolhas } from "./calcular";
import { arquivosDoIdml, montarIdml } from "./idml";
import { montarPdf } from "./pdf";

const perto = (a: number, b: number, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b}`);
const grid = (id: string, mudar: Partial<Escolhas> = {}) => {
  const f = formatoPorId(id);
  return calcularGrid(f, { ...escolhasPadrao(f), ...mudar });
};

test("a tabela aprovada: todo formato tem fonte, tamanho e unidade coerentes", () => {
  const ids = new Set<string>();
  for (const f of FORMATOS) {
    assert.ok(!ids.has(f.id), `id repetido: ${f.id}`);
    ids.add(f.id);
    assert.ok(f.fonte.length > 3, `${f.id} sem fonte`);
    assert.ok(f.largura > 0 && f.altura > 0);
    assert.equal(f.sangria > 0, f.unidade === "mm", `${f.id}: sangria só nos impressos`);
    assert.ok(f.margensU || f.margensMm !== undefined);
  }
  assert.deepEqual([formatoPorId("linkedin-capa").largura, formatoPorId("linkedin-capa").altura], [1512, 256], "a medida nova do LinkedIn (13/10)");
});

test("a versão gratuita: 13 formatos que existem, com pelo menos um de cada grupo", () => {
  assert.equal(FORMATOS_GRATIS.size, 13);
  const existentes = new Set(FORMATOS.map((f) => f.id));
  for (const id of FORMATOS_GRATIS) assert.ok(existentes.has(id), `${id} não existe na tabela`);
  for (const g of GRUPOS) {
    assert.ok(FORMATOS.some((f) => f.grupo === g.id && FORMATOS_GRATIS.has(f.id)), `o grupo ${g.id} ficaria vazio no gratuito`);
  }
  assert.ok(FORMATOS_GRATIS.has("a4"), "o A4 é o formato de abertura da ferramenta");
});

test("A4 em colunas: 12 colunas, medianiz de 1u (12 pt), margens 4u/5u/4u, linha de base de 12 pt", () => {
  const g = grid("a4");
  assert.equal(g.colunas.n, 12);
  perto(g.colunas.medianiz, 12, 0.05);
  perto(g.margens.sup, 48, 0.05);
  perto(g.margens.inf, 60, 0.05);
  perto(g.margens.esq, 48, 0.05);
  assert.equal(g.linhaDeBase.passo, 12);
  perto(g.largura, 210 * PT_POR_MM);
  perto(g.sangria, 3 * PT_POR_MM);
  const [a] = g.colunas.faixas[0];
  const [, z] = g.colunas.faixas[11];
  perto(a, g.margens.esq);
  perto(z, g.largura - g.margens.dir);
});

test("modular: módulos em linhas de base inteiras, e a margem de baixo fecha a conta", () => {
  const g = grid("post-4x5");
  assert.equal(g.linhas.length, 8);
  for (const [a, b] of g.linhas) {
    const h = b - a;
    perto(h / 12, Math.round(h / 12), 1e-6);
    perto((a - g.margens.sup) / 12, Math.round((a - g.margens.sup) / 12), 1e-6);
  }
  perto(g.linhas[7][1], g.altura - g.margens.inf);
  // Digital, margens iguais: a diferença é dividida (63/63), não jogada toda embaixo (era 72/150).
  perto(g.margens.sup, 63);
  perto(g.margens.inf, 63);
  // Impresso: só a de baixo muda, e pouco.
  const a4 = grid("a4", { tipo: "modular" });
  perto(a4.margens.sup, 48, 0.05);
  assert.ok(Math.abs(a4.margens.inf - 60) <= 12, "no máximo 1u de diferença no A4");
  assert.equal(g.guias.filter((x) => x.camada === "grid" && x.orientacao === "h").length, 14);
});

test("manuscrito: as proporções clássicas (Van de Graaf, 2:3:4:6, áurea)", () => {
  const vg = margensClassicas("van-de-graaf", 900, 1200)!;
  assert.deepEqual([vg.esq, vg.sup, vg.dir, vg.inf], [100, 1200 / 9, 200, 2400 / 9]);
  const c = margensClassicas("2:3:4:6", 180, 300)!;
  assert.deepEqual([c.esq, c.sup, c.dir, c.inf], [20, 30, 40, 60]);
  const au = margensClassicas("aurea", 1000, 1400)!;
  perto(au.sup / au.esq, 1.618, 0.001);
  perto(au.esq + au.dir, 250, 0.01);
  const g = grid("a4", { tipo: "manuscrito", proporcao: "van-de-graaf" });
  assert.equal(g.colunas.n, 1);
  perto(g.margens.dir, (2 * g.largura) / 9);
});

test("hierárquico: as zonas seguem as proporções, com a medianiz entre elas", () => {
  const g = grid("iab-728x90", { zonas: [1, 3, 1.2] });
  assert.equal(g.zonas.length, 3);
  const [a, b, c] = g.zonas;
  perto(b.w / a.w, 3, 0.001);
  perto(c.w / a.w, 1.2, 0.001);
  perto(b.x - (a.x + a.w), g.colunas.medianiz);
  perto(c.x + c.w, g.largura - g.margens.dir);
});

test("área segura só com fonte oficial: Stories (Meta 14/35/6%), YouTube central; Facebook sem guia", () => {
  const s = grid("stories").segura!;
  perto(s.y, 1920 * 0.14);
  perto(s.y + s.h, 1920 * 0.65);
  perto(s.x, 1080 * 0.06);
  const y = grid("youtube-banner").segura!;
  assert.deepEqual([y.w, y.h], [1546, 423]);
  perto(y.x, (2560 - 1546) / 2);
  assert.equal(grid("facebook-capa").segura, null);
});

test("capa de livro: a largura cresce com lombada e orelhas, e as dobras viram guias", () => {
  const g = grid("livro-14x21", { livro: { lombada: 15, orelha: 90 } });
  perto(g.largura, (2 * 140 + 15 + 2 * 90) * PT_POR_MM, 0.05);
  assert.deepEqual(g.zonas.map((z) => z.nome), ["Orelha (verso)", "Contracapa", "Lombada", "Capa", "Orelha (frente)"]);
  assert.equal(g.guias.filter((x) => x.camada === "dobras").length, 4);
  assert.equal(g.colunasNaMargem, false);
  const sem = grid("livro-14x21", { livro: { lombada: 12, orelha: 0 } });
  assert.equal(sem.zonas.length, 3, "sem orelha, só contracapa, lombada e capa");
});

test("desconstrução: o sobreposto vai em camada própria; o rotacionado em 0° cai nas colunas", () => {
  const g = grid("a4", { sobreposto: { ativo: true, colunas: 5 } });
  assert.equal(g.sobreposto.length, 5);
  assert.equal(g.guias.filter((x) => x.camada === "sobreposto").length, 10);

  const zero = grid("a4", { rotacionado: { ativo: true, angulo: 0 } });
  const xs = new Set(zero.rotacionado!.segmentos.map(([x1]) => x1.toFixed(2)));
  for (const [a, b] of zero.colunas.faixas) {
    assert.ok(xs.has(a.toFixed(2)) && xs.has(b.toFixed(2)), "em 0°, as linhas são as bordas das colunas");
  }
  const g30 = grid("post-1x1", { rotacionado: { ativo: true, angulo: 30 } });
  assert.ok(g30.rotacionado!.segmentos.length > 10);
  for (const [x1, y1, x2, y2] of g30.rotacionado!.segmentos) {
    for (const [x, yy] of [[x1, y1], [x2, y2]]) assert.ok(x >= -0.01 && x <= 1080.01 && yy >= -0.01 && yy <= 1080.01, "cortado na página");
  }
});

test("recortar: dentro, fora e atravessando", () => {
  const r = { x: 0, y: 0, w: 10, h: 10 };
  assert.deepEqual(recortar(2, 2, 8, 8, r), [2, 2, 8, 8]);
  assert.equal(recortar(20, 20, 30, 30, r), null);
  assert.deepEqual(recortar(-5, 5, 15, 5, r), [0, 5, 10, 5]);
});

test("IDML: a guia conta do topo da página; as colunas e a linha de base vão nas preferências", () => {
  const g = grid("post-4x5");
  const x = arquivosDoIdml(g);
  const pos = g.guias.find((gd) => gd.orientacao === "h")!.pos;
  assert.match(x["Spreads/Spread_sp1.xml"], new RegExp(`Orientation="Horizontal" Location="${pos}"`));
  assert.match(x["Resources/Preferences.xml"], /ColumnCount="6"/);
  assert.match(x["Resources/Preferences.xml"], /BaselineDivision="12"/);
  assert.match(x["Resources/Preferences.xml"], /HorizontalMeasurementUnits="Pixels"/);
  assert.match(x["designmap.xml"], /Name="Grid — proposta do Brennimark"/);
  assert.match(x["Resources/Preferences.xml"], /DocumentBleedTopOffset="0"/);
  assert.match(arquivosDoIdml(grid("a4"))["Resources/Preferences.xml"], /HorizontalMeasurementUnits="Millimeters"/);
});

test("IDML: o pacote abre — mimetype primeiro e sem compressão, XML de cada parte", () => {
  const bytes = montarIdml(grid("a4", { rotacionado: { ativo: true, angulo: 12 } }));
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(v.getUint32(0, true), 0x04034b50, "assinatura do zip");
  assert.equal(v.getUint16(8, true), 0, "mimetype sem compressão");
  const nome = strFromU8(bytes.subarray(30, 30 + v.getUint16(26, true)));
  assert.equal(nome, "mimetype");
  const z = unzipSync(bytes);
  assert.equal(strFromU8(z.mimetype), "application/vnd.adobe.indesign-idml-package");
  assert.match(strFromU8(z["Spreads/Spread_sp1.xml"]), /<GraphicLine /);
  assert.match(strFromU8(z["designmap.xml"]), /Desconstrução — grid rotacionado/);
});

test("PDF de referência: cabeçalho, página no tamanho da peça e índice de objetos certo", () => {
  const g = grid("stories", { sobreposto: { ativo: true, colunas: 5 } });
  const pdf = strFromU8(montarPdf(g));
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.match(pdf, /\/MediaBox \[0 0 1080 1920\]/);
  const xref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
  assert.ok(pdf.slice(xref).startsWith("xref"));
  const obj4 = Number(/0000000000 65535 f \n(?:\d{10} 00000 n \n){3}(\d{10})/.exec(pdf)![1]);
  assert.ok(pdf.slice(obj4).startsWith("4 0 obj"));
});
