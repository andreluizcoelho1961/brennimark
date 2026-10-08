import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerMotivo } from "@/lib/console/ia";

/**
 * Os pedidos de exportação no Console (08/10/2026): a equipe vê os abertos,
 * entrega à mão e marca como entregue, com motivo no registro.
 *
 * Quem pode decide o BANCO (`console_*` recusa com 42501 quem não é da
 * equipe); a rota traduz a recusa em 404 — para os outros, o Console não existe.
 */
const NAO_ENCONTRADO = () => NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("console_pedidos_de_exportacao");
  if (error?.code === "42501") return NAO_ENCONTRADO();
  if (error) return NextResponse.json({ message: "Não foi possível ler os pedidos." }, { status: 500 });
  return NextResponse.json({ pedidos: data ?? [] }, SEM_CACHE);
}

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  const motivo = lerMotivo(corpo?.motivo);
  if (!motivo) return NextResponse.json({ message: "Escreva o motivo (de 3 a 500 caracteres): ele fica no registro." }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.rpc("console_marcar_exportacao_entregue", { p_id: id, p_motivo: motivo });
  if (error?.code === "42501") return NAO_ENCONTRADO();
  if (error?.code === "P0002") return NextResponse.json({ message: "Pedido não encontrado ou já entregue." }, { status: 404 });
  if (error) return NextResponse.json({ message: "Não foi possível marcar a entrega." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
