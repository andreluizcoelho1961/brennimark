import { NextResponse } from "next/server";
import { validarIdDePareamento } from "@/lib/fonts/pareamento";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "pedido_invalido" }, { status: 400 }); }
  const candidate = body as { id?: unknown; segredoHash?: unknown };
  const id = validarIdDePareamento(candidate?.id);
  const segredoHash = typeof candidate?.segredoHash === "string" && /^[0-9a-f]{64}$/.test(candidate.segredoHash) ? candidate.segredoHash : null;
  if (!id || !segredoHash) return NextResponse.json({ error: "pedido_invalido" }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consultar_pareamento_fonts", { p_id: id, p_segredo_hash: segredoHash });
  if (error) return NextResponse.json({ error: "indisponivel" }, { status: 503 });
  const estado = Array.isArray(data) ? data[0]?.estado : null;
  if (!estado) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  return NextResponse.json({ estado }, { headers: { "Cache-Control": "no-store" } });
}
