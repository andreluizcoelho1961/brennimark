import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A reserva do teto de leitura pela IA (grid, tipografia, regras do logo).
 *
 * Cada leitura reserva o teto de 24 h ANTES de gastar IA (a lição da revisão
 * de segurança do Kit, 10/10/2026). Efeito colateral achado em 16/10/2026: se
 * a leitura FALHA (a IA estoura o tempo, o orçamento recusa), a reserva
 * continuava de pé e a pessoa ficava 24 h sem poder tentar de novo, sem que
 * nada tivesse sido lido. `devolverReserva` desfaz a reserva da leitura que
 * não aconteceu: recua a data em 25 horas (o servidor só tem `update` nessas
 * tabelas, e recuar basta para a próxima reserva passar).
 */
export async function devolverReserva(
  cliente: Pick<SupabaseClient, "from">,
  tabela: "leituras_das_regras_de_grid" | "leituras_da_tipografia" | "leituras_das_regras_do_logo",
  brandId: string,
): Promise<void> {
  const { error } = await cliente.from(tabela).update({ tentada_em: new Date(Date.now() - 25 * 3_600_000).toISOString() }).eq("brand_id", brandId);
  if (error) console.error(JSON.stringify({ level: "error", msg: "reserva_da_leitura_nao_devolvida", tabela, code: error.code ?? "unknown" }));
}

/**
 * Quanto esperar o PRIMEIRO trecho da resposta numa leitura de páginas. O
 * padrão da plataforma é 20 s para o chat; com 10 imagens de página (o grid da
 * Bradesco) a IA demora mais para começar, e a leitura caía por tempo antes de
 * gravar qualquer coisa. A rota nunca espera MENOS do que o Console manda.
 */
export const ESPERA_DA_LEITURA_DE_PAGINAS_MS = 50_000;
export const esperaDaLeitura = (esperaDaRota: number): number => Math.max(esperaDaRota, ESPERA_DA_LEITURA_DE_PAGINAS_MS);
