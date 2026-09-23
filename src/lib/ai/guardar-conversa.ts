import type { SupabaseClient } from "@supabase/supabase-js";
import { limitarConteudo, tituloDaConversa } from "./conversas";

/**
 * Guarda uma troca (pergunta e resposta) na conversa do autor — fatia 4d.
 *
 * Roda com a SESSÃO da pessoa, nunca com a chave de serviço: as policies de
 * `conversas` e `mensagens_da_conversa` são por autor, e é o banco que garante
 * que ninguém grava em nome de outro. O identificador da conversa nasce no
 * navegador (uuid); se ele coincidir com a conversa de outra pessoa, o
 * `on conflict do nothing` não a toca, e as mensagens esbarram na chave
 * composta (conversa, autor, marca) — não há como escrever na conversa alheia.
 *
 * Falhar aqui NÃO desfaz a resposta: a pessoa já leu o que o Vini disse. Só
 * vai ao log — o código, nunca o conteúdo, que é conversa de cliente.
 */
type Troca = {
  supabase: SupabaseClient;
  conversaId: string;
  workspaceId: string;
  brandId: string;
  autor: string;
  pergunta: string;
  resposta: {
    conteudo: string;
    tipo: "resposta" | "prompt";
    paginas?: Record<string, number>;
    regras?: unknown[];
    incompleta?: boolean;
  };
};

/**
 * As duas linhas da troca, com as MESMAS colunas nas duas.
 *
 * Num insert em lote, o cliente do Supabase manda a união das chaves e
 * preenche a que falta numa linha com `null` — não com o `default` da tabela.
 * A pergunta sem `paginas` virava `null`, esbarrava no `not null`, e o lote
 * inteiro caía: em produção, de 23/09 até esta correção, nenhuma mensagem foi
 * guardada. Dizer cada coluna nas duas linhas não depende de opção do cliente.
 */
export function linhasDaTroca(entrada: Omit<Troca, "supabase" | "workspaceId">) {
  const { conversaId, brandId, autor } = entrada;
  return [
    {
      conversa_id: conversaId, autor, brand_id: brandId, papel: "user", tipo: "pergunta",
      conteudo: limitarConteudo(entrada.pergunta.trim() || "…"),
      paginas: {}, regras: [], incompleta: false,
    },
    {
      conversa_id: conversaId, autor, brand_id: brandId, papel: "assistant", tipo: entrada.resposta.tipo,
      conteudo: limitarConteudo(entrada.resposta.conteudo.trim() || "…"),
      paginas: entrada.resposta.paginas ?? {}, regras: entrada.resposta.regras ?? [],
      incompleta: Boolean(entrada.resposta.incompleta),
    },
  ];
}

export async function guardarTroca(entrada: Troca): Promise<void> {
  const { supabase, conversaId, workspaceId, brandId, autor } = entrada;
  const agora = new Date().toISOString();
  try {
    const { error: erroDaConversa } = await supabase.from("conversas").upsert(
      { id: conversaId, workspace_id: workspaceId, brand_id: brandId, autor, titulo: tituloDaConversa(entrada.pergunta) },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (erroDaConversa) throw erroDaConversa;

    const { error: erroDasMensagens } = await supabase.from("mensagens_da_conversa").insert(linhasDaTroca(entrada));
    if (erroDasMensagens) throw erroDasMensagens;

    // A lista mostra primeiro a conversa mexida por último.
    await supabase.from("conversas").update({ atualizada_em: agora }).eq("id", conversaId);
  } catch (erro) {
    const code = (erro as { code?: string })?.code ?? "unknown";
    console.error(JSON.stringify({ level: "error", msg: "conversa_nao_guardada", code, conversaId }));
  }
}
