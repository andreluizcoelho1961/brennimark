import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelMessage } from "ai";
import type { ModelCapabilities } from "./catalogo";
import type { Trecho } from "./recuperacao";

/**
 * O Vini VÊ as páginas — decisão do André, 26/09/2026.
 *
 * O texto extraído de uma página visual engana: a tabela de paleta do Bradesco
 * (p. 22) vira uma sopa de códigos, e a IA contou 6 cores onde há 19. Junto do
 * texto, vão as IMAGENS das páginas que a busca aponta como mais relevantes —
 * a IA lê a tabela como uma pessoa lê.
 */

/** Quantas páginas a IA vê por pergunta. Cada imagem custa ~1.100–2.300 tokens. */
export const MAXIMO_DE_PAGINAS_VISTAS = 4;
/** Seção de mais páginas que isto não manda imagem de todas: não é "a página". */
const PAGINAS_POR_TRECHO = 3;

/**
 * As páginas a ver, na ordem de relevância da busca, sem repetir. Um trecho que
 * cobre uma seção longa entra só pelas primeiras páginas.
 */
export function paginasParaVer(trechos: readonly Trecho[], maximo = MAXIMO_DE_PAGINAS_VISTAS): number[] {
  const paginas: number[] = [];
  for (const trecho of trechos) {
    if (trecho.pageStart === null) continue;
    const fim = Math.min(trecho.pageEnd ?? trecho.pageStart, trecho.pageStart + PAGINAS_POR_TRECHO - 1);
    for (let p = trecho.pageStart; p <= fim; p++) {
      if (!paginas.includes(p)) paginas.push(p);
      if (paginas.length >= maximo) return paginas;
    }
  }
  return paginas;
}

/**
 * Este modelo vê imagem de página? Precisa de visão com custo de imagem
 * verificado, e de fôlego: com teto de entrada POR MINUTO (Groq gratuito),
 * quatro imagens sozinhas passariam do teto.
 */
export function modeloVePaginas(capacidades: ModelCapabilities | null | undefined): boolean {
  if (!capacidades?.vision || capacidades.pricing?.maxImageTokens === undefined) return false;
  return capacidades.maxInputTokensPerMinute === undefined;
}

export type PaginaVista = { pagina: number; bytes: Uint8Array<ArrayBuffer> };

/**
 * As imagens das páginas pedidas, lidas com a SESSÃO de quem pergunta: a RLS
 * de `brand_source_pages` e a política do Storage decidem o que ela alcança.
 * Página sem imagem, ou que falha ao baixar, fica de fora — em silêncio: a
 * resposta segue pelo texto, que continua lá.
 */
export async function lerPaginasVistas(
  supabase: SupabaseClient,
  sourceDocumentId: string,
  paginas: readonly number[],
  maxBytes = 5 * 1024 * 1024,
): Promise<PaginaVista[]> {
  if (paginas.length === 0) return [];
  const { data, error } = await supabase
    .from("brand_source_pages")
    .select("pagina, miniatura_path")
    .eq("source_document_id", sourceDocumentId)
    .in("pagina", [...paginas])
    .not("miniatura_path", "is", null);
  if (error || !data) return [];

  const caminhos = new Map(data.map((linha: { pagina: number; miniatura_path: string }) => [linha.pagina, linha.miniatura_path]));
  const vistas = await Promise.all(paginas.map(async (pagina) => {
    const caminho = caminhos.get(pagina);
    if (!caminho) return null;
    const { data: arquivo, error: erro } = await supabase.storage.from("brand-assets").download(caminho);
    if (erro || !arquivo || arquivo.size > maxBytes) return null;
    const vista: PaginaVista = { pagina, bytes: new Uint8Array(await arquivo.arrayBuffer()) };
    return vista;
  }));
  return vistas.filter((v): v is PaginaVista => v !== null);
}

/**
 * As mensagens com as páginas vistas anexadas à ÚLTIMA pergunta de quem
 * escreve — o histórico não recebe imagem, e as mensagens originais não mudam.
 */
export function comPaginasVistas(mensagens: readonly ModelMessage[], vistas: readonly PaginaVista[], ingles: boolean): ModelMessage[] {
  if (vistas.length === 0) return [...mensagens];
  const indice = mensagens.map((m) => m.role).lastIndexOf("user");
  if (indice < 0) return [...mensagens];
  const ultima = mensagens[indice];
  const partesOriginais = typeof ultima.content === "string"
    ? [{ type: "text" as const, text: ultima.content }]
    : [...(ultima.content as unknown[])];
  const lista = vistas.map((v) => v.pagina).join(", ");
  const aviso = ingles
    ? `[Images of manual pages ${lista}, in this order — read tables and visual elements from them. If the extracted text of these pages disagrees with the image, the image wins.]`
    : `[Imagens das páginas ${lista} do manual, nesta ordem — leia nelas as tabelas e os elementos visuais. Se o texto extraído dessas páginas divergir da imagem, vale a imagem.]`;
  const nova = {
    role: "user",
    content: [
      ...partesOriginais,
      { type: "text", text: aviso },
      // Parte "file": a "image" está obsoleta no SDK e enchia o log de avisos.
      ...vistas.map((v) => ({ type: "file", data: v.bytes, mediaType: "image/jpeg" })),
    ],
  } as ModelMessage;
  return [...mensagens.slice(0, indice), nova, ...mensagens.slice(indice + 1)];
}
