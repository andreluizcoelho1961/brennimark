import { NextResponse } from "next/server";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { autenticacaoDaRota } from "@/lib/brennimark/contexto-da-rota";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const SEM_CACHE = { "Cache-Control": "private, no-store" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Os acessos de UM link (30/09/2026): aberturas e downloads, do mais recente
 * para trás. Só quem administra a marca do link os lê — a RLS de
 * `acessos_de_link` decide; link de outra conta simplesmente não tem linhas.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "nao_encontrado" }, { status: 404, headers: SEM_CACHE });
  const resolvido = await autenticacaoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { supabase, workspaceId } = resolvido.contexto;

  const { data, error } = await supabase.from("acessos_de_link")
    .select("id, evento, nome, email, asset_label, file_name, created_at")
    .eq("workspace_id", workspaceId).eq("link_id", id)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) {
    return NextResponse.json({ message: isEnglish ? "Couldn't load the accesses." : "Não foi possível carregar os acessos." }, { status: 500, headers: SEM_CACHE });
  }
  return NextResponse.json({ acessos: data ?? [] }, { headers: SEM_CACHE });
}
