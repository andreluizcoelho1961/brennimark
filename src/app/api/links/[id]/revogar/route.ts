import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { autenticacaoDaRota } from "@/lib/brennimark/contexto-da-rota";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const SEM_CACHE = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Revoga um link (30/09/2026). Vale na hora: a próxima abertura e o próximo
 * download já recebem "encerrado". `revogar_link_de_entrega` confere
 * `administrar` na marca do link; link inexistente e de marca alheia dão a
 * mesma resposta.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "nao_encontrado" }, { status: 404, headers: SEM_CACHE });
  const resolvido = await autenticacaoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;

  const { error } = await resolvido.contexto.supabase.rpc("revogar_link_de_entrega", { p_link_id: id });
  if (error?.code === "42501") return NextResponse.json({ error: "nao_encontrado" }, { status: 404, headers: SEM_CACHE });
  if (error) {
    return NextResponse.json({ message: isEnglish ? "Couldn't close the link. Try again." : "Não foi possível encerrar o link. Tente de novo." }, { status: 500, headers: SEM_CACHE });
  }
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
