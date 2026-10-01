import type { SupabaseClient } from "@supabase/supabase-js";
import { trechoDoComplemento } from "../complementos/complementos";
import { limitarPergunta, type Trecho } from "./recuperacao";

/**
 * Os complementos publicados que o Vini lê — 01/10/2026.
 *
 * `buscar_complementos` ORDENA pela pergunta e não descarta: complementos são
 * poucos e curtos, e esconder um por falta de sinônimo seria esconder o texto
 * que a marca escreveu para tapar a lacuna. Só o publicado e não arquivado
 * vira trecho (o banco garante); a RLS dos trechos decide quem lê.
 *
 * Falhar aqui não derruba a conversa: o manual continua lá, e o log diz que os
 * complementos caíram (só o código — a mensagem do banco pode trazer texto).
 */
export const COMPLEMENTOS_POR_RESPOSTA = 6;

export async function buscarComplementos(
  supabase: SupabaseClient,
  brandId: string,
  pergunta: string,
  ingles = false,
): Promise<Trecho[]> {
  const { data, error } = await supabase.rpc("buscar_complementos", {
    p_brand_id: brandId,
    p_consulta: limitarPergunta(pergunta),
    p_limite: COMPLEMENTOS_POR_RESPOSTA,
  });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "complementos_indisponiveis", code: error.code ?? "unknown", brandId }));
    return [];
  }
  return ((data ?? []) as { slug: string; titulo: string; secao: string | null; conteudo: string }[])
    .map((linha) => trechoDoComplemento(linha, ingles));
}
