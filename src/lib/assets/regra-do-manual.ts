import type { SupabaseClient } from "@supabase/supabase-js";
import type { CitacaoDaRegra, StatusDaRegra } from "./regra";

/**
 * O manual desta marca, visto por Materiais: quantas páginas tem, e o que diz
 * cada página citada por um item — título da seção e status editorial.
 *
 * O status atravessa até aqui por honestidade editorial: uma regra em
 * RASCUNHO citada ao lado do botão de baixar aparece como rascunho. Página que
 * nenhuma seção cobre (a capa, por exemplo) é citada só pelo número, sem
 * título inventado.
 *
 * A mesma escolha do manual original (`docs/original`): a importação MAIS
 * RECENTE da marca é o manual. Erro aqui é "não sei" — citação sem título —,
 * nunca a tela de Materiais quebrada.
 */
export type ManualDaMarca = { id: string; paginas: number } | null;

export async function lerManualDaMarca(
  supabase: SupabaseClient,
  workspaceId: string,
  brandId: string,
): Promise<{ manual: ManualDaMarca; sourceDocumentId: string | null }> {
  const { data } = await supabase
    .from("brand_imports")
    .select("id, page_count, source_document_id")
    .eq("workspace_id", workspaceId)
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return { manual: null, sourceDocumentId: null };
  return {
    manual: { id: data.id as string, paginas: data.page_count as number },
    sourceDocumentId: (data.source_document_id as string | null) ?? null,
  };
}

const STATUS: ReadonlySet<string> = new Set(["ready", "draft", "pending"]);

export async function citarPaginas(
  supabase: SupabaseClient,
  sourceDocumentId: string | null,
  paginas: readonly number[],
): Promise<Map<number, CitacaoDaRegra>> {
  const citacoes = new Map<number, CitacaoDaRegra>();
  for (const pagina of paginas) citacoes.set(pagina, { pagina, titulo: null, status: "sem-secao" });
  if (!sourceDocumentId || paginas.length === 0) return citacoes;

  const { data, error } = await supabase
    .from("brand_source_pages")
    .select("pagina, brand_documents(title, status)")
    .eq("source_document_id", sourceDocumentId)
    .in("pagina", [...new Set(paginas)]);
  if (error || !data) return citacoes;

  for (const linha of data as unknown as { pagina: number; brand_documents: { title: string; status: string } | null }[]) {
    const doc = linha.brand_documents;
    if (!doc) continue;
    citacoes.set(linha.pagina, {
      pagina: linha.pagina,
      titulo: doc.title?.trim() || null,
      status: (STATUS.has(doc.status) ? doc.status : "pending") as StatusDaRegra,
    });
  }
  return citacoes;
}
