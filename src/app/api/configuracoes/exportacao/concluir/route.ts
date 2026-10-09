import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";

/**
 * O navegador avisa que terminou a exportação (08/10/2026). É informação dele,
 * não prova — o que o servidor prova é o início. Só a dona; a primeira data
 * vale.
 */
export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const corpo = await request.json().catch(() => null);
  const exportacao = typeof corpo?.exportacao === "string" ? corpo.exportacao : "";
  if (!exportacao) return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.rpc("concluir_exportacao", { p_exportacao: exportacao });
  if (error?.code === "42501" || error?.code === "22P02") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (error) return NextResponse.json({ message: "Não foi possível registrar a conclusão." }, { status: 503 });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}
