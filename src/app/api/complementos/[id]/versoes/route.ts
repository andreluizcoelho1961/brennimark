import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const SEM_CACHE = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O histórico de UM complemento, do mais recente para trás (01/10/2026). Só
 * quem edita a marca o lê — a RLS de `versoes_de_complemento` decide; para os
 * outros a lista simplesmente vem vazia.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "nao_encontrado" }, { status: 404, headers: SEM_CACHE });
  const resolvido = await conteudoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;

  const { data, error } = await resolvido.auth.supabase.from("versoes_de_complemento")
    .select("id, versao, acao, titulo, texto, autor_email, created_at")
    .eq("complemento_id", id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ message: isEnglish ? "Couldn't load the history." : "Não foi possível carregar o histórico." }, { status: 500, headers: SEM_CACHE });
  }
  return NextResponse.json({ versoes: data ?? [] }, { headers: SEM_CACHE });
}
