import { NextResponse } from "next/server";
import { conteudoDaRota } from "@/lib/brennimark/contexto-da-rota";

/**
 * Aprovar regras do logo (10/10/2026) — pela função `aprovar_regras_do_logo`,
 * que confere `aprovar` no banco: quem aprova sem editar (o dono da marca, do
 * lado do cliente) aprova por aqui. Regra alheia ou inexistente: nada aprovado.
 */
export async function POST(request: Request) {
  const r = await conteudoDaRota(request);
  if (!r.ok) return r.resposta;
  const corpo = await request.json().catch(() => null);
  const ids = Array.isArray(corpo?.ids) ? (corpo.ids as unknown[]).filter((i): i is string => typeof i === "string").slice(0, 10) : [];
  if (ids.length === 0) return NextResponse.json({ message: "Nada para aprovar." }, { status: 400 });
  const { data, error } = await r.auth.supabase.rpc("aprovar_regras_do_logo", { p_ids: ids });
  if (error) return NextResponse.json({ message: "Não foi possível aprovar agora." }, { status: 500 });
  return NextResponse.json({ aprovadas: data as number }, { headers: { "Cache-Control": "private, no-store" } });
}
