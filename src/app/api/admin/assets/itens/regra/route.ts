import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { normalizarPaginasDaRegra, MAXIMO_DE_PAGINAS_DA_REGRA } from "@/lib/assets/regra";
import { citarPaginas, lerManualDaMarca } from "@/lib/assets/regra-do-manual";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * Liga um item de Materiais às páginas do manual que o regem — fatia 5.
 *
 * Quem pode é decidido pelo BANCO: a policy de `brand_asset_items` exige
 * `editar` na marca. A rota não repete a regra; se a atualização não alcança
 * linha nenhuma, é porque a policy recusou, e a resposta diz isso.
 *
 * A rota confere o que o banco não alcança: que a página existe no manual
 * ATUAL da marca.
 */
export async function PATCH(request: Request) {
  const resolvido = await marcaDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { auth, workspaceId, brandId } = resolvido;

  const corpo = await request.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!id) return NextResponse.json({ message: isEnglish ? "Choose an item." : "Escolha um item." }, { status: 400 });

  const { manual, sourceDocumentId } = await lerManualDaMarca(auth.supabase, workspaceId, brandId);
  const lidas = normalizarPaginasDaRegra(corpo?.paginas, manual?.paginas ?? null);
  if (!lidas.ok) {
    const message = lidas.motivo === "demais"
      ? (isEnglish ? `Up to ${MAXIMO_DE_PAGINAS_DA_REGRA} pages.` : `Até ${MAXIMO_DE_PAGINAS_DA_REGRA} páginas.`)
      : lidas.motivo === "fora-do-manual"
        ? (manual
          ? (isEnglish ? `The manual has ${manual.paginas} pages.` : `O manual tem ${manual.paginas} páginas.`)
          : (isEnglish ? "This brand has no manual yet." : "Esta marca ainda não tem manual."))
        : (isEnglish ? "Type page numbers, separated by commas." : "Digite números de página, separados por vírgula.");
    return NextResponse.json({ message }, { status: 400 });
  }

  const { data, error } = await auth.supabase.from("brand_asset_items")
    .update({ regra_paginas: lidas.paginas, updated_at: new Date().toISOString() })
    .eq("id", id).eq("workspace_id", workspaceId).eq("brand_id", brandId)
    .select("id");
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't save the rule." : "Não foi possível guardar a regra." }, { status: 500 });
  if (!data || data.length === 0) {
    return NextResponse.json({ message: isEnglish ? "Only who edits this brand links rules." : "Só quem edita esta marca liga a regra." }, { status: 403 });
  }

  const citacoes = await citarPaginas(auth.supabase, sourceDocumentId, lidas.paginas);
  return NextResponse.json({ regra: lidas.paginas.map((p) => citacoes.get(p)!) });
}
