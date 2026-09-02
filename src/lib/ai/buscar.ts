import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trecho } from "./recuperacao";
import { LIMITES_DE_IA, limitarPergunta } from "./recuperacao";

/**
 * A ponte entre a pergunta e o índice.
 *
 * Chama `buscar_trechos`, que é `security invoker`: a RLS decide o que esta
 * sessão pode ver, e o `brand_id` vai como parâmetro obrigatório. Não há
 * caminho por onde esta função devolva trecho de outra marca — nem por engano
 * de filtro, porque não existe filtro para errar aqui.
 *
 * Erro de busca devolve LISTA VAZIA, e a lista vazia produz a resposta honesta
 * de "não há diretriz documentada". A alternativa seria cair para o manual
 * inteiro, e um fallback assim reintroduz exatamente o custo que A1 remove —
 * silenciosamente, e só quando algo já está errado.
 */
export async function buscarTrechos(
  supabase: SupabaseClient,
  brandId: string,
  pergunta: string,
): Promise<Trecho[]> {
  const consulta = limitarPergunta(pergunta);
  if (!consulta) return [];

  const { data, error } = await supabase.rpc("buscar_trechos", {
    p_brand_id: brandId,
    p_consulta: consulta,
    p_limite: LIMITES_DE_IA.maxTrechos,
  });

  if (error) {
    console.error("[ai/buscar] recuperação falhou", error.message);
    return [];
  }

  return (data ?? []).map((linha: Record<string, unknown>) => ({
    documentSlug: String(linha.document_slug ?? ""),
    documentTitle: String(linha.document_title ?? ""),
    groupName: String(linha.group_name ?? ""),
    section: typeof linha.section === "string" ? linha.section : null,
    status: String(linha.status ?? "draft"),
    pageStart: typeof linha.page_start === "number" ? linha.page_start : null,
    pageEnd: typeof linha.page_end === "number" ? linha.page_end : null,
    content: String(linha.content ?? ""),
  }));
}

/**
 * O texto sobre o qual buscar, a partir das mensagens do chat.
 *
 * A ÚLTIMA mensagem de quem pergunta, não a conversa toda: buscar sobre o
 * histórico inteiro traz os assuntos já encerrados junto e afoga a pergunta
 * atual — a recuperação piora quanto mais longa a conversa, que é o oposto do
 * esperado.
 */
export function perguntaDasMensagens(
  mensagens: readonly { role?: string; content?: unknown }[],
): string {
  for (let i = mensagens.length - 1; i >= 0; i -= 1) {
    const mensagem = mensagens[i];
    if (mensagem.role !== "user") continue;
    if (typeof mensagem.content === "string") return mensagem.content;
    if (Array.isArray(mensagem.content)) {
      const textos = mensagem.content
        .filter((parte): parte is { type: string; text: string } =>
          typeof parte === "object" && parte !== null &&
          (parte as { type?: unknown }).type === "text" &&
          typeof (parte as { text?: unknown }).text === "string")
        .map((parte) => parte.text);
      if (textos.length > 0) return textos.join(" ");
    }
  }
  return "";
}
