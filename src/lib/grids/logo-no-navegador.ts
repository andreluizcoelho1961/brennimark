"use client";

import { zipSync, strToU8 } from "fflate";
import { motivoDoCabecalho } from "@/lib/kit/formatos";
import type { Grid } from "./calcular";
import { montarIdml, type LogoNoDocumento, type MarcaNoDocumento } from "./idml";
import type { ImagemDoLogo } from "./pdf";
import { formatoParaOInDesign } from "./marca";

/**
 * O logo dos Materiais como o InDesign vai enxergá-lo (14/10/2026), e o pacote
 * do Grids do assinante. Roda no navegador; nada sobe para servidor nenhum.
 *
 * Os limites seguem o que o InDesign escreve ao colocar cada formato
 * (exportado por script em 14/10):
 *   - PDF/AI: recorte na ARTE, nas coordenadas do PDF, com Top = o menor y;
 *   - SVG: a medida declarada (width/height, ou o viewBox);
 *   - PNG/JPEG: os pixels na resolução gravada no arquivo (72 ppi se não há).
 */
export type LogoMedido = {
  formato: LogoNoDocumento["formato"]; limites: LogoNoDocumento["limites"]; aspecto: number;
  /** A prévia para a tela: só o desenho, recortado como o InDesign vai mostrar. */
  previa: string;
};

export async function medirLogo(bytes: Uint8Array, arquivo: string, mime: string): Promise<LogoMedido> {
  const formato = formatoParaOInDesign(arquivo, mime);
  if (!formato) throw new Error(`O InDesign não coloca ${arquivo}. Use PDF, AI, SVG, PNG ou JPG nos Materiais.`);
  let previa = "";
  let limites: LogoMedido["limites"];
  if (formato === "pdf") {
    const r = await limitesDoPdf(bytes, arquivo);
    limites = r.limites; previa = r.previa;
  } else {
    limites = formato === "svg" ? limitesDoSvg(new TextDecoder().decode(bytes)) : formato === "png" ? limitesDoPng(bytes) : await limitesDoJpeg(bytes);
    previa = URL.createObjectURL(new Blob([bytes as BlobPart], { type: formato === "svg" ? "image/svg+xml" : `image/${formato}` }));
  }
  const w = limites.dir - limites.esq, h = limites.inf - limites.sup;
  if (!(w > 0 && h > 0)) throw new Error(`Não foi possível medir ${arquivo}.`);
  return { formato, limites, aspecto: h / w, previa };
}

async function limitesDoPdf(bytes: Uint8Array, arquivo: string): Promise<{ limites: LogoMedido["limites"]; previa: string }> {
  const motivo = motivoDoCabecalho(String.fromCharCode(...bytes.subarray(0, 1024)), arquivo);
  if (motivo) throw new Error(motivo);
  const { prepararAmbienteDePdf } = await import("@/lib/import/stream-iteravel");
  prepararAmbienteDePdf();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const tarefa = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const doc = await tarefa.promise;
    const pagina = await doc.getPage(1);
    const [x0, , x1, y1] = pagina.view;
    const k = 1200 / Math.max(x1 - x0, 1);
    const v = pagina.getViewport({ scale: k });
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(v.width));
    c.height = Math.max(1, Math.ceil(v.height));
    await pagina.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: v, background: "rgba(0,0,0,0)" }).promise;
    const { data } = c.getContext("2d")!.getImageData(0, 0, c.width, c.height);
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    if (maxX < 0) throw new Error(`A primeira página de ${arquivo} está vazia.`);
    const recorte = document.createElement("canvas");
    recorte.width = maxX - minX + 1;
    recorte.height = maxY - minY + 1;
    recorte.getContext("2d")!.drawImage(c, minX, minY, recorte.width, recorte.height, 0, 0, recorte.width, recorte.height);
    // Do canvas (y para baixo) para o PDF (y para cima), como o InDesign grava.
    return {
      limites: { esq: x0 + minX / k, dir: x0 + (maxX + 1) / k, sup: y1 - (maxY + 1) / k, inf: y1 - minY / k },
      previa: recorte.toDataURL("image/png"),
    };
  } finally {
    void tarefa.destroy();
  }
}

const POR_UNIDADE: Record<string, number> = { "": 1, px: 1, pt: 1, pc: 12, in: 72, cm: 72 / 2.54, mm: 72 / 25.4 };

export function limitesDoSvg(texto: string): LogoMedido["limites"] {
  const doc = new DOMParser().parseFromString(texto, "image/svg+xml");
  const raiz = doc.documentElement;
  if (raiz.nodeName.toLowerCase() !== "svg") throw new Error("Este SVG não pôde ser lido.");
  const medida = (v: string | null) => {
    const m = /^\s*([\d.]+)\s*(px|pt|pc|in|cm|mm)?\s*$/i.exec(v ?? "");
    return m ? Number(m[1]) * POR_UNIDADE[(m[2] ?? "").toLowerCase()] : null;
  };
  const vb = (raiz.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  let w = medida(raiz.getAttribute("width")), h = medida(raiz.getAttribute("height"));
  if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
    if (w === null && h === null) { w = vb[2]; h = vb[3]; }
    else if (w === null) w = h! * (vb[2] / vb[3]);
    else if (h === null) h = w * (vb[3] / vb[2]);
  }
  if (!(w! > 0 && h! > 0)) throw new Error("O SVG não diz o próprio tamanho (falta o viewBox).");
  return { esq: 0, sup: 0, dir: w!, inf: h! };
}

export function limitesDoPng(b: Uint8Array): LogoMedido["limites"] {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let w = 0, h = 0, dpi = 72;
  for (let i = 8; i + 8 <= b.length;) {
    const tam = v.getUint32(i);
    const tipo = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (tipo === "IHDR") { w = v.getUint32(i + 8); h = v.getUint32(i + 12); }
    if (tipo === "pHYs" && b[i + 16] === 1) dpi = v.getUint32(i + 8) * 0.0254;
    if (tipo === "IDAT" || tipo === "IEND") break;
    i += 12 + tam;
  }
  const k = 72 / (dpi > 0 ? dpi : 72);
  return { esq: 0, sup: 0, dir: w * k, inf: h * k };
}

async function limitesDoJpeg(b: Uint8Array): Promise<LogoMedido["limites"]> {
  let dpi = 72, w = 0, h = 0;
  for (let i = 2; i + 4 < b.length;) {
    if (b[i] !== 0xff) { i++; continue; }
    const marca = b[i + 1];
    const tam = (b[i + 2] << 8) | b[i + 3];
    if (marca === 0xe0 && String.fromCharCode(...b.subarray(i + 4, i + 9)) === "JFIF\0") {
      const unidade = b[i + 11], dens = (b[i + 12] << 8) | b[i + 13];
      if (unidade === 1 && dens > 0) dpi = dens;
      if (unidade === 2 && dens > 0) dpi = dens * 2.54;
    }
    if (marca >= 0xc0 && marca <= 0xc3) { h = (b[i + 5] << 8) | b[i + 6]; w = (b[i + 7] << 8) | b[i + 8]; break; }
    i += 2 + tam;
  }
  const k = 72 / dpi;
  return { esq: 0, sup: 0, dir: w * k, inf: h * k };
}

/** O pacote: o .idml, a pasta Links com o logo e o LEIA-ME. */
export function montarPacoteDoGrid(d: { base: string; grid: Grid; marca: MarcaNoDocumento; logo: { nome: string; bytes: Uint8Array } | null; leiaMe: string }): Uint8Array {
  const conteudo: Record<string, [Uint8Array, { level: 0 | 6 }]> = {
    [`${d.base}.idml`]: [montarIdml(d.grid, d.marca), { level: 0 }],
    "LEIA-ME.txt": [strToU8(d.leiaMe), { level: 6 }],
  };
  if (d.logo) conteudo[`Links/${d.logo.nome}`] = [d.logo.bytes, { level: 6 }];
  return zipSync(conteudo);
}

/** O nome do logo na pasta Links: só letras simples, sem espaço (o vínculo é um endereço de arquivo). */
export function nomeNosLinks(arquivo: string): string {
  const ext = /\.([a-z0-9]+)$/i.exec(arquivo)?.[1]?.toLowerCase() ?? "pdf";
  const base = arquivo.replace(/\.[a-z0-9]+$/i, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `logo-${base || "marca"}.${ext}`;
}

/**
 * A prévia do logo em pixels para o PDF do assinante (15/10/2026): o desenho
 * no tamanho do quadro, 4× para ficar nítido (até 2400 px de largura), com a
 * transparência separada — o PDF a recebe como máscara.
 */
export async function imagemDoLogo(previa: string, larguraNoDocumento: number, aspecto: number): Promise<ImagemDoLogo> {
  const img = new Image();
  img.src = previa;
  await img.decode();
  const largura = Math.max(1, Math.min(2400, Math.round(larguraNoDocumento * 4)));
  const altura = Math.max(1, Math.round(largura * aspecto));
  const c = document.createElement("canvas");
  c.width = largura;
  c.height = altura;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, largura, altura);
  const { data } = ctx.getImageData(0, 0, largura, altura);
  const rgb = new Uint8Array(largura * altura * 3);
  const alfa = new Uint8Array(largura * altura);
  for (let i = 0, j = 0, k = 0; i < data.length; i += 4) {
    rgb[j++] = data[i]; rgb[j++] = data[i + 1]; rgb[j++] = data[i + 2];
    alfa[k++] = data[i + 3];
  }
  return { largura, altura, rgb, alfa };
}
