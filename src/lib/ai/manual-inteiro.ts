import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelCapabilities } from "./catalogo";
import type { Trecho } from "./recuperacao";

/**
 * O Vini lê o manual INTEIRO quando ele cabe — decisão do André, 26/09/2026.
 *
 * Até aqui o Vini recebia só os trechos que uma busca por palavras escolhia.
 * No ensaio, três perguntas com resposta no manual voltaram "não há diretriz
 * documentada" ("logotipo principal", "quantas cores"…): a busca errava, e a
 * IA nunca via a página certa. Pior, não havia como a IA SOMAR ou ASSOCIAR —
 * ela não via o manual, via recortes. Os manuais reais do ensaio têm de 4 mil
 * (Sony Vaio) a 12 mil tokens (Bradesco); qualquer modelo atual lê isso com
 * folga.
 *
 * A busca continua para o que não cabe: o manual gigante e a IA de reserva da
 * fase gratuita (Groq, ~8 mil tokens por MINUTO).
 */

/**
 * O teto do manual inteiro, em tokens estimados. Cobre a grande maioria dos
 * manuais (o de 47 páginas do Bradesco dá ~14 mil pela conta conservadora
 * abaixo) e fica longe do contexto de qualquer modelo do catálogo.
 */
export const LIMITE_DO_MANUAL_INTEIRO_TOKENS = 60_000;

/**
 * Tokens estimados a partir de caracteres — CONSERVADOR: português costuma dar
 * ~4 caracteres por token; conto 3, para errar do lado de mandar a busca, nunca
 * do lado de estourar o modelo.
 */
export const CARACTERES_POR_TOKEN = 3;

/** Uma folha para as regras, a conversa e a resposta, além do manual. */
const FOLGA_DE_TOKENS = 6_000;

export function tokensEstimados(caracteres: number): number {
  return Math.ceil(Math.max(caracteres, 0) / CARACTERES_POR_TOKEN);
}

export function caracteresDoManual(trechos: readonly Trecho[]): number {
  return trechos.reduce((soma, t) => soma + t.content.length + t.documentTitle.length + 120, 0);
}

/**
 * O manual cabe NESTE modelo? Três tetos, vale o menor:
 *   - o do produto (`LIMITE_DO_MANUAL_INTEIRO_TOKENS`);
 *   - metade do contexto do modelo, quando o catálogo o conhece — a outra
 *     metade é da conversa e da resposta;
 *   - o limite de entrada POR MINUTO da camada gratuita, quando existe: um
 *     pedido acima dele o provedor recusa antes de começar.
 */
export function manualCabeNoModelo(caracteres: number, capacidades: ModelCapabilities | undefined): boolean {
  if (caracteres <= 0) return false;
  const manual = tokensEstimados(caracteres);
  const tetos = [LIMITE_DO_MANUAL_INTEIRO_TOKENS];
  if (capacidades?.maxContextTokens) tetos.push(Math.floor(capacidades.maxContextTokens / 2));
  if (capacidades?.maxInputTokensPerMinute) tetos.push(capacidades.maxInputTokensPerMinute - FOLGA_DE_TOKENS);
  return manual <= Math.min(...tetos);
}

export type LeituraDoManual =
  | { ok: true; trechos: Trecho[] }
  | { ok: false; motivo: string };

/**
 * O manual da marca inteiro, na ordem das páginas — o mesmo índice da busca
 * (`brand_chunks`), lido com a SESSÃO: a RLS de `brand_chunks` decide o que
 * esta pessoa vê, e o `brand_id` vai como filtro obrigatório.
 *
 * Falha SOBE, como na busca: "não há diretriz" é afirmação sobre o manual, e
 * só pode ser feita quando o manual foi de fato lido.
 */
export async function lerManualInteiro(supabase: SupabaseClient, brandId: string): Promise<LeituraDoManual> {
  const { data, error } = await supabase
    .from("brand_chunks")
    .select("slug, title, group_name, section, status, page_start, page_end, content")
    .eq("brand_id", brandId)
    .order("page_start", { ascending: true, nullsFirst: false })
    .order("slug", { ascending: true })
    .order("ordinal", { ascending: true });

  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "manual_inteiro_indisponivel", code: error.code ?? "unknown", brandId }));
    return { ok: false, motivo: error.code ?? "unknown" };
  }

  return {
    ok: true,
    trechos: (data ?? []).map((linha: Record<string, unknown>) => ({
      documentSlug: String(linha.slug ?? ""),
      documentTitle: String(linha.title ?? ""),
      groupName: String(linha.group_name ?? ""),
      section: typeof linha.section === "string" ? linha.section : null,
      status: String(linha.status ?? "draft"),
      pageStart: typeof linha.page_start === "number" ? linha.page_start : null,
      pageEnd: typeof linha.page_end === "number" ? linha.page_end : null,
      content: String(linha.content ?? ""),
    })),
  };
}
