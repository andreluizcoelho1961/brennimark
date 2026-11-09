import { NextResponse } from "next/server";
import { autenticacaoDaRota } from "@/lib/brennimark/contexto-da-rota";
import { validarIdDePareamento } from "@/lib/fonts/pareamento";
import { createClient } from "@/lib/supabase/server";

/** Browser-side confirmation. It never receives or returns the desktop token. */
export async function POST(request: Request) {
  const auth = await autenticacaoDaRota(request);
  if (!auth.ok) return auth.resposta;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "pedido_invalido" }, { status: 400 }); }
  const id = validarIdDePareamento((body as { id?: unknown })?.id);
  if (!id) return NextResponse.json({ error: "pedido_invalido" }, { status: 400 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("aprovar_pareamento_fonts", { p_id: id, p_workspace_id: auth.contexto.workspaceId });
  if (error) return NextResponse.json({ error: error.code === "42501" ? "sem_permissao" : "pareamento_indisponivel" }, { status: error.code === "42501" ? 403 : 409 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
