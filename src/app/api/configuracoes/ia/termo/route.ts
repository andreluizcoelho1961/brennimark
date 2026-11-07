import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { TERMO_VERSAO } from "@/lib/ia-propria/termo";

/**
 * Configurações › IA › aceitar o termo (ADR-0009 §2.4). O banco confere que
 * quem pede é a dona e que o plano é "traga a sua"; o aceite fica no registro
 * da conta, com autor, data e a versão do texto. Sem ele, o banco recusa
 * qualquer chave.
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const supabase = await createClient();
  const { error } = await supabase.rpc("aceitar_termo_de_ia_propria", { p_workspace_id: r.workspaceId, p_versao: TERMO_VERSAO });
  if (error?.hint === "ia_so_a_dona") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (error?.hint === "ia_conta_no_modo_da_plataforma") return NextResponse.json({ error: "modo_da_plataforma" }, { status: 409, headers: SEM_CACHE });
  if (error) return NextResponse.json({ message: "Não foi possível registrar o aceite." }, { status: 500, headers: SEM_CACHE });
  return NextResponse.json({ ok: true, versao: TERMO_VERSAO }, { headers: SEM_CACHE });
}
