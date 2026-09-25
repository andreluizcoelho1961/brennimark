import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { marcaDaRota } from "@/lib/brennimark/contexto-da-rota";
import { ehTipoDeItem } from "@/lib/assets/eixos";

/**
 * Os itens da biblioteca — o "Logo" que reúne as variantes (ADR-0007 §2.2).
 *
 * O portão de papel é o mesmo da rota de arquivos, de propósito: um item que
 * alguém cria e não pode encher de arquivos seria um item órfão por
 * construção. Quem AUTORIZA é a RLS de `brand_asset_items`, por capacidade na
 * marca; o portão aqui só decide a resposta.
 */
const isEnglish = inEnglish(PRODUCT_LOCALE);

async function donoDaMarca(request: Request) {
  const r = await marcaDaRota(request);
  if (!r.ok) return { ok: false as const, resposta: r.resposta };
  if (r.papel !== "owner") {
    return {
      ok: false as const,
      resposta: NextResponse.json({ message: isEnglish ? "Only the owner can manage the library." : "Apenas o proprietário gerencia a biblioteca." }, { status: 403 }),
    };
  }
  return { ok: true as const, contexto: r };
}

function textoCurto(valor: unknown, maximo: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  return limpo.length <= maximo ? limpo : null;
}

export async function POST(request: Request) {
  const r = await donoDaMarca(request);
  if (!r.ok) return r.resposta;
  const { contexto } = r;
  const corpo = await request.json().catch(() => null);
  const nome = textoCurto(corpo?.nome, 120);
  const descricao = textoCurto(corpo?.descricao ?? "", 500);
  if (!ehTipoDeItem(corpo?.tipo) || !nome || descricao === null) {
    return NextResponse.json({ message: isEnglish ? "Give the item a type and a name." : "Dê ao item um tipo e um nome." }, { status: 400 });
  }
  const { data, error } = await contexto.auth.supabase.from("brand_asset_items")
    .insert({
      workspace_id: contexto.workspaceId, brand_id: contexto.brandId,
      tipo: corpo.tipo, nome, descricao, created_by: contexto.auth.user.id,
    })
    .select("id, tipo, nome, descricao, ordem").single();
  if (error || !data) {
    return NextResponse.json({ message: isEnglish ? "Couldn't create the item." : "Não foi possível criar o item." }, { status: error?.code === "42501" ? 403 : 500 });
  }
  return NextResponse.json({ item: data }, { status: 201 });
}

/** Renomear e descrever. O tipo não muda aqui: com arquivos, o banco recusa. */
export async function PATCH(request: Request) {
  const r = await donoDaMarca(request);
  if (!r.ok) return r.resposta;
  const { contexto } = r;
  const corpo = await request.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  const nome = textoCurto(corpo?.nome, 120);
  const descricao = textoCurto(corpo?.descricao ?? "", 500);
  if (!id || !nome || descricao === null) {
    return NextResponse.json({ message: isEnglish ? "Give the item a name." : "Dê um nome ao item." }, { status: 400 });
  }
  const { data, error } = await contexto.auth.supabase.from("brand_asset_items")
    .update({ nome, descricao, updated_at: new Date().toISOString() })
    .eq("id", id).eq("brand_id", contexto.brandId)
    .select("id").maybeSingle();
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't update the item." : "Não foi possível alterar o item." }, { status: 500 });
  if (!data) return NextResponse.json({ message: isEnglish ? "Item not found." : "Item não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/**
 * Remover só item vazio.
 *
 * Com arquivos, o banco recusa (a FK variante→item). A resposta diz o caminho —
 * descontinuar e apagar os arquivos antes — em vez de um erro genérico, porque
 * "não foi possível" diante de um botão de remover parece defeito, e é regra.
 */
export async function DELETE(request: Request) {
  const r = await donoDaMarca(request);
  if (!r.ok) return r.resposta;
  const { contexto } = r;
  const corpo = await request.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!id) return NextResponse.json({ message: isEnglish ? "Item not found." : "Item não encontrado." }, { status: 404 });
  const { data, error } = await contexto.auth.supabase.from("brand_asset_items")
    .delete().eq("id", id).eq("brand_id", contexto.brandId).select("id").maybeSingle();
  if (error?.code === "23503") {
    return NextResponse.json({
      message: isEnglish
        ? "This item still has files. Delete them first — an item isn't removed with its files inside."
        : "Este item ainda tem arquivos. Apague-os antes — item não é removido com arquivos dentro.",
    }, { status: 409 });
  }
  if (error) return NextResponse.json({ message: isEnglish ? "Couldn't remove the item." : "Não foi possível remover o item." }, { status: 500 });
  if (!data) return NextResponse.json({ message: isEnglish ? "Item not found." : "Item não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
