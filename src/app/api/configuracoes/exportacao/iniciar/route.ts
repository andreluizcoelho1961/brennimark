import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import type { Manifesto } from "@/lib/cobranca/pacote-da-exportacao";

/**
 * Configurações › Plano › Exportar (08/10/2026): registra a exportação e
 * devolve o manifesto — marcas, arquivos por CHAVE (nunca caminho do Storage),
 * complementos e links sem endereço. A função `iniciar_exportacao` confere de
 * novo que quem pede é a dona, e o registro existe antes de qualquer endereço.
 * Funciona na conta só para leitura: é a cancelada que mais precisa.
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("iniciar_exportacao", { p_workspace_id: r.workspaceId });
  if (error?.code === "42501") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (error?.hint === "exportacao_limite_diario") {
    return NextResponse.json(
      { message: "Esta conta já exportou 5 vezes nas últimas 24 horas. Tente de novo amanhã." },
      { status: 429, headers: SEM_CACHE },
    );
  }
  if (error?.hint === "exportacao_exclusao_em_andamento") {
    return NextResponse.json(
      { message: "A exclusão desta conta já começou, e os arquivos estão sendo removidos." },
      { status: 409, headers: SEM_CACHE },
    );
  }
  if (error || !data) {
    return NextResponse.json({ message: "Não foi possível começar a exportação. Tente de novo." }, { status: 500, headers: SEM_CACHE });
  }
  return NextResponse.json({ manifesto: data as Manifesto }, { headers: SEM_CACHE });
}
