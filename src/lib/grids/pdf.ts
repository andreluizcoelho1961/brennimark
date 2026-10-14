/**
 * O PDF de referência do Brennimark Grids (13/10/2026): o grid desenhado em
 * vetor, no tamanho exato da peça, para quem trabalha fora do InDesign
 * (Illustrator, Figma, Photoshop abrem PDF e podem usá-lo como camada de base).
 *
 * Escrito à mão — um PDF de uma página só com retângulos e linhas — para não
 * trazer biblioteca nova. As cores são as mesmas da prévia na tela.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

import type { Grid } from "./calcular";

const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** As cores do grid, em RGB 0–1 — as da prévia. */
export const CORES = {
  coluna: [0.0, 0.62, 0.86],
  base: [0.55, 0.75, 0.95],
  margem: [0.85, 0.2, 0.7],
  zona: [0.45, 0.3, 0.85],
  segura: [0.9, 0.15, 0.15],
  dobra: [0.1, 0.6, 0.3],
  sobreposto: [0.9, 0.1, 0.55],
  rotacionado: [1.0, 0.55, 0.0],
} as const;

export function montarPdf(g: Grid): Uint8Array {
  const H = g.altura;
  const y = (v: number) => H - v; // o PDF conta de baixo para cima
  const ops: string[] = [];
  const cor = (c: readonly number[], traco = true) => ops.push(`${c.map(n).join(" ")} ${traco ? "RG" : "rg"}`);
  const ret = (x: number, yy: number, w: number, h: number) => `${n(x)} ${n(y(yy + h))} ${n(w)} ${n(h)} re`;
  const linha = (x1: number, y1: number, x2: number, y2: number) => ops.push(`${n(x1)} ${n(y(y1))} m ${n(x2)} ${n(y(y2))} l S`);

  const fino = Math.max(0.25, Math.min(g.largura, g.altura) / 1500);
  const interior = { x: g.margens.esq, y: g.margens.sup, w: g.largura - g.margens.esq - g.margens.dir, h: g.altura - g.margens.sup - g.margens.inf };

  // Colunas (ou módulos) em tinta clara, com transparência simulada pela cor.
  ops.push("q");
  cor([0.86, 0.94, 0.99], false);
  if (g.linhas.length) {
    for (const [a, b] of g.colunas.faixas) for (const [c, d] of g.linhas) ops.push(`${ret(a, c, b - a, d - c)} f`);
  } else {
    for (const [a, b] of g.colunas.faixas) ops.push(`${ret(a, g.colunasNaMargem ? interior.y : g.margens.sup, b - a, g.colunasNaMargem ? interior.h : g.altura - g.margens.sup - g.margens.inf)} f`);
  }
  ops.push("Q");

  // Linha de base.
  ops.push(`q ${n(fino * 0.6)} w`);
  cor(CORES.base);
  for (let v = g.linhaDeBase.inicio; v <= g.altura - g.margens.inf + 0.01; v += g.linhaDeBase.passo) linha(interior.x, v, interior.x + interior.w, v);
  ops.push("Q");

  // Margens e colunas.
  ops.push(`q ${n(fino)} w`);
  cor(CORES.margem);
  if (g.colunasNaMargem) ops.push(`${ret(interior.x, interior.y, interior.w, interior.h)} S`);
  cor(CORES.coluna);
  for (const [a, b] of g.colunas.faixas) { linha(a, interior.y, a, interior.y + interior.h); linha(b, interior.y, b, interior.y + interior.h); }
  ops.push("Q");

  const tracejado = (c: readonly number[], fn: () => void) => { ops.push(`q ${n(fino * 1.4)} w [${n(fino * 6)} ${n(fino * 4)}] 0 d`); cor(c); fn(); ops.push("Q"); };
  if (g.zonas.length) tracejado(CORES.zona, () => g.zonas.forEach((z) => ops.push(`${ret(z.x, z.y, z.w, z.h)} S`)));
  if (g.segura) tracejado(CORES.segura, () => ops.push(`${ret(g.segura!.x, g.segura!.y, g.segura!.w, g.segura!.h)} S`));
  for (const gd of g.guias.filter((x) => x.camada === "dobras")) tracejado(CORES.dobra, () => linha(gd.pos, 0, gd.pos, g.altura));
  if (g.sobreposto.length) tracejado(CORES.sobreposto, () => g.sobreposto.forEach(([a, b]) => { linha(a, interior.y, a, interior.y + interior.h); linha(b, interior.y, b, interior.y + interior.h); }));
  if (g.rotacionado) {
    ops.push(`q ${n(fino)} w`);
    cor(CORES.rotacionado);
    for (const [x1, y1, x2, y2] of g.rotacionado.segmentos) linha(x1, y1, x2, y2);
    ops.push("Q");
  }

  const conteudo = ops.join("\n");
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(g.largura)} ${n(g.altura)}] /Contents 4 0 R /Resources << >> >>`,
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
  ];
  let corpo = "%PDF-1.4\n";
  const posicoes: number[] = [];
  objetos.forEach((o, i) => { posicoes.push(corpo.length); corpo += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = corpo.length;
  corpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  for (const p of posicoes) corpo += `${String(p).padStart(10, "0")} 00000 n \n`;
  corpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Só ASCII no PDF: o comprimento em caracteres é o comprimento em bytes.
  return new TextEncoder().encode(corpo);
}
