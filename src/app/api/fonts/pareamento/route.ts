import { NextResponse } from "next/server";
import { sha256Hex, validarPedidoDePareamento } from "@/lib/fonts/pareamento";
import { ipDoPedido } from "@/lib/conformidade/registro-de-acesso";
import { createClient } from "@/lib/supabase/server";

/** The desktop creates both secrets; the server persists hashes only. */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "pedido_invalido" }, { status: 400 }); }
  const pedido = validarPedidoDePareamento(body);
  if (!pedido) return NextResponse.json({ error: "pedido_invalido" }, { status: 400 });
  const ip = ipDoPedido(request.headers);
  if (!ip) return NextResponse.json({ error: "origem_indisponivel" }, { status: 503 });
  const supabase = await createClient();
  const { error } = await supabase.rpc("solicitar_pareamento_fonts", {
    p_id: pedido.id, p_token_hash: pedido.tokenHash, p_segredo_hash: pedido.segredoHash, p_origem_hash: sha256Hex(ip),
    p_rotulo_do_dispositivo: pedido.rotuloDoDispositivo,
  });
  if (error) return NextResponse.json({ error: error.code === "23505" ? "pareamento_repetido" : error.code === "P0003" ? "limite_temporario" : "indisponivel" }, { status: error.code === "23505" ? 409 : error.code === "P0003" ? 429 : 503 });
  return NextResponse.json({ id: pedido.id, expiresInSeconds: 600 }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
