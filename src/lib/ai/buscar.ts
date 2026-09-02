import type { SupabaseClient } from "@supabase/supabase-js";
import type { Trecho } from "./recuperacao";
import { LIMITES_DE_IA, limitarPergunta } from "./recuperacao";

/**
 * O resultado da recuperação, com a distinção que importa.
 *
 * "Nada encontrado" e "a busca falhou" são coisas diferentes, e confundi-las é
 * a mesma classe de defeito que o perfil tinha: engolir o erro do Supabase
 * fazia uma falha de infraestrutura virar uma afirmação sobre o conteúdo.
 *
 * "Não há diretriz documentada para isso" é uma afirmação sobre o MANUAL. O
 * produto só pode fazê-la quando de fato consultou o manual. Se o banco, a
 * RLS ou a RPC falharam, ele não consultou nada — e dizer que a marca não
 * documentou é inventar um fato sobre o cliente a partir de um erro de rede.
 */
export type Recuperacao =
  | { ok: true; trechos: Trecho[] }
  | { ok: false; motivo: string };

/**
 * A ponte entre a pergunta e o índice.
 *
 * Chama `buscar_trechos`, que é `security invoker`: a RLS decide o que esta
 * sessão pode ver, e o `brand_id` vai como parâmetro obrigatório. Não há
 * caminho por onde esta função devolva trecho de outra marca — nem por engano
 * de filtro, porque não existe filtro para errar aqui.
 *
 * Falha SOBE. Nem lista vazia, que mentiria sobre o conteúdo; nem o manual
 * inteiro, que reintroduziria o custo silenciosamente e só quando algo já está
 * errado. Quem chama decide o que fazer, e a decisão certa é não chamar o
 * modelo.
 */
export async function buscarTrechos(
  supabase: SupabaseClient,
  brandId: string,
  pergunta: string,
): Promise<Recuperacao> {
  const consulta = limitarPergunta(pergunta);
  // Pergunta vazia não é falha: não há o que buscar, e zero resultados é a
  // resposta correta e verdadeira.
  if (!consulta) return { ok: true, trechos: [] };

  const { data, error } = await supabase.rpc("buscar_trechos", {
    p_brand_id: brandId,
    p_consulta: consulta,
    p_limite: LIMITES_DE_IA.maxTrechos,
  });

  if (error) {
    // A mensagem do banco pode conter fragmento de consulta e, por ela, texto
    // do manual do cliente. O log leva o código; o conteúdo fica de fora.
    console.error(
      JSON.stringify({
        level: "error",
        msg: "brand_knowledge_unavailable",
        code: error.code ?? "unknown",
        brandId,
      }),
    );
    return { ok: false, motivo: error.code ?? "unknown" };
  }

  const trechos = (data ?? []).map((linha: Record<string, unknown>) => ({
    documentSlug: String(linha.document_slug ?? ""),
    documentTitle: String(linha.document_title ?? ""),
    groupName: String(linha.group_name ?? ""),
    section: typeof linha.section === "string" ? linha.section : null,
    status: String(linha.status ?? "draft"),
    pageStart: typeof linha.page_start === "number" ? linha.page_start : null,
    pageEnd: typeof linha.page_end === "number" ? linha.page_end : null,
    content: String(linha.content ?? ""),
  }));

  return { ok: true, trechos };
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
