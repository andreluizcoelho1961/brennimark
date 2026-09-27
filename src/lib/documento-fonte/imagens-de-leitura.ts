import type { PDFDocumentProxy } from "pdfjs-dist";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * As imagens de LEITURA das páginas — para o Vini ver o manual (26/09/2026).
 *
 * O texto extraído de uma página visual (a tabela de paleta do Bradesco, p. 22)
 * é uma sopa de códigos sem coluna nem nome; a imagem, a IA lê como uma pessoa
 * lê. Gerada NO NAVEGADOR de quem edita a marca, que já tem o PDF aberto — o
 * servidor nunca desenha PDF.
 *
 * ⚖️ O ADR-0006 (12/09) desligou a imagem de página: eram PNG de 2× para
 * REMONTAR a página (34 MB e 45 s num manual de 47 páginas). O objetivo agora
 * é outro — a IA ler — e JPEG de ~1.600 px basta, ~5 vezes menor.
 */

/** Largura da imagem de leitura: legível para a IA, leve para o Storage. */
export const LARGURA_DE_LEITURA = 1_600;
/** Qualidade do JPEG: códigos pequenos continuam nítidos. */
export const QUALIDADE_DE_LEITURA = 0.82;

/** O caminho é DETERMINÍSTICO — o banco confere a mesma forma (check). */
export function caminhoDaImagemDeLeitura(
  workspaceId: string,
  brandId: string,
  sourceDocumentId: string,
  pagina: number,
): string {
  return `${workspaceId}/${brandId}/pagina-${sourceDocumentId}-${pagina}.jpg`;
}

/** A escala que dá `LARGURA_DE_LEITURA` px à página, qualquer que seja o formato. */
export function escalaDeLeitura(larguraEmPontos: number): number {
  if (!(larguraEmPontos > 0)) return 1;
  return LARGURA_DE_LEITURA / larguraEmPontos;
}

async function desenhar(documento: PDFDocumentProxy, numero: number): Promise<Blob> {
  const pagina = await documento.getPage(numero);
  const base = pagina.getViewport({ scale: 1 });
  const viewport = pagina.getViewport({ scale: escalaDeLeitura(base.width) });
  const canvas = window.document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const contexto = canvas.getContext("2d", { alpha: false });
  if (!contexto) throw new Error("sem contexto de desenho");
  // Fundo branco: JPEG não tem transparência, e página sem fundo sairia preta.
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", QUALIDADE_DE_LEITURA));
  // Libera a memória do canvas antes da próxima página.
  canvas.width = 0;
  canvas.height = 0;
  pagina.cleanup();
  if (!blob) throw new Error("a imagem não saiu");
  return blob;
}

export type ResultadoDoPreparo = { prontas: number; falhas: number[] };

/**
 * Desenha, envia e registra cada página, UMA POR VEZ — memória de celular e de
 * aba em segundo plano não aguentam várias páginas grandes ao mesmo tempo.
 *
 * Uma página que falha não interrompe as outras: ela volta na lista `falhas`,
 * e preparar de novo tenta só o que falta (o caminho é o mesmo, sobrescreve).
 */
export async function prepararImagensDeLeitura(params: {
  documento: PDFDocumentProxy;
  supabase: SupabaseClient;
  workspaceId: string;
  brandId: string;
  sourceDocumentId: string;
  paginas: readonly number[];
  aoProgredir?: (feitas: number, total: number) => void;
  sinal?: AbortSignal;
}): Promise<ResultadoDoPreparo> {
  const { documento, supabase, workspaceId, brandId, sourceDocumentId, paginas } = params;
  let prontas = 0;
  const falhas: number[] = [];

  for (const [i, numero] of paginas.entries()) {
    if (params.sinal?.aborted) break;
    try {
      const imagem = await desenhar(documento, numero);
      const caminho = caminhoDaImagemDeLeitura(workspaceId, brandId, sourceDocumentId, numero);
      const envio = await supabase.storage.from("brand-assets").upload(caminho, imagem, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (envio.error) throw envio.error;
      const registro = await supabase.rpc("registrar_imagem_de_leitura", {
        p_source_document_id: sourceDocumentId,
        p_pagina: numero,
      });
      if (registro.error) throw registro.error;
      prontas += 1;
    } catch {
      falhas.push(numero);
    }
    params.aoProgredir?.(i + 1, paginas.length);
  }

  return { prontas, falhas };
}
