import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";

/**
 * A situação da cobrança para o aviso da moldura (cobrança, fatia 3): só o
 * que todos da conta precisam saber — se está em tolerância ou só leitura, e
 * desde quando. Plano, datas e titular ficam em Configurações, para quem
 * administra. Quem não é da conta recebe recusa do banco.
 */
export async function GET(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("situacao_de_cobranca_da_conta", { p_workspace_id: r.workspaceId });
  if (error) return NextResponse.json({ acesso: "desconhecido" }, { status: error.code === "42501" ? 404 : 500 });
  const s = (data ?? {}) as { acesso?: string; so_leitura_a_partir_de?: string | null };
  return NextResponse.json(
    { acesso: s.acesso ?? "livre", soLeituraAPartirDe: s.so_leitura_a_partir_de ?? null, administra: r.papel === "owner", conta: r.workspaceSlug },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
