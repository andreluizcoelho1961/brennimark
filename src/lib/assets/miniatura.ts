"use client";

import { prepararAmbienteDePdf } from "@/lib/import/stream-iteravel";

/**
 * A miniatura de uma variante, gerada no navegador de QUEM ENVIA — fatia 5.
 *
 * A prévia de um logo em SVG é o próprio arquivo; mostrá-la entregaria o
 * original sem passar pelo registro de download. A miniatura é um PNG pequeno
 * (até 480 px no lado maior) desenhado aqui e enviado junto com o original.
 *
 * O que dá prévia (spec de Materiais §5-A.1): SVG, PNG, JPG e WebP, que o
 * navegador desenha; PDF, e AI salvo com compatibilidade PDF (o padrão do
 * Illustrator), pela primeira página, com o PDF.js que o produto já tem. EPS
 * não: é PostScript, e nem navegador nem servidor o abrem. Sem prévia, `null`
 * — a tela diz o formato, nunca um quadrado mudo.
 *
 * O SVG é desenhado por `<img>`, que não executa script: um SVG hostil não
 * roda nada aqui.
 */
const LADO_MAXIMO = 480;
const IMAGENS = new Set(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]);

export async function gerarMiniatura(arquivo: File): Promise<Blob | null> {
  try {
    if (IMAGENS.has(arquivo.type)) return await deImagem(arquivo);
    if (arquivo.type === "application/pdf" || /\.ai$/i.test(arquivo.name)) return await dePdf(arquivo);
  } catch {
    // Prévia é conveniência: falhar aqui nunca impede o envio do original.
  }
  return null;
}

function escalaPara(largura: number, altura: number) {
  return Math.min(1, LADO_MAXIMO / Math.max(largura, altura, 1));
}

function paraPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolver) => canvas.toBlob((b) => resolver(b), "image/png"));
}

async function deImagem(arquivo: File): Promise<Blob | null> {
  const endereco = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    imagem.decoding = "async";
    imagem.src = endereco;
    await imagem.decode();
    // SVG sem dimensão declarada chega com 0 × 0: desenha num quadrado.
    const largura = imagem.naturalWidth || LADO_MAXIMO;
    const altura = imagem.naturalHeight || LADO_MAXIMO;
    const escala = escalaPara(largura, altura);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(largura * escala));
    canvas.height = Math.max(1, Math.round(altura * escala));
    canvas.getContext("2d")!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    return await paraPng(canvas);
  } finally {
    URL.revokeObjectURL(endereco);
  }
}

async function dePdf(arquivo: File): Promise<Blob | null> {
  prepararAmbienteDePdf();
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const tarefa = pdfjs.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) });
  try {
    const documento = await tarefa.promise;
    const pagina = await documento.getPage(1);
    const base = pagina.getViewport({ scale: 1 });
    const viewport = pagina.getViewport({ scale: escalaPara(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));
    await pagina.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    return await paraPng(canvas);
  } finally {
    void tarefa.destroy();
  }
}
