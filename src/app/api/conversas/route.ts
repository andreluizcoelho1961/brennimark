import { NextResponse } from "next/server";
import { portaoDeIA } from "@/lib/brennimark/contexto-da-rota";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

/**
 * As conversas da pessoa, nesta marca — fatia 4d.
 *
 * Quem decide "só as suas" é o banco: a policy de `conversas` é por autor, e a
 * consulta roda com a sessão da pessoa. O filtro por marca aqui é de
 * apresentação (a janela é de uma marca), não de segurança.
 */
const isEnglish = inEnglish(PRODUCT_LOCALE);

export async function GET(request: Request) {
  const portao = await portaoDeIA(request, "chat");
  if (!portao.ok) return portao.resposta;

  const { data, error } = await portao.auth.supabase
    .from("conversas")
    .select("id, titulo, atualizada_em")
    .eq("brand_id", portao.brand.id)
    .order("atualizada_em", { ascending: false })
    .limit(50);

  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "conversas_nao_listadas", code: error.code ?? "unknown" }));
    return NextResponse.json({
      message: isEnglish ? "Couldn't load your conversations." : "Não foi possível carregar suas conversas.",
    }, { status: 500 });
  }
  return NextResponse.json(
    { conversas: (data ?? []).map((c) => ({ id: c.id, titulo: c.titulo, atualizadaEm: c.atualizada_em })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
