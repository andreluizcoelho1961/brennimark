import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { planoDaConta, type Acesso, type LinhaDaAssinatura, type LinhaDoPlano } from "@/lib/cobranca/plano-da-conta";

/**
 * Configurações › Plano (cobrança, fatia 3, 01/10/2026).
 *
 * Lê com a sessão de quem pede: a assinatura só chega a quem administra a
 * conta (RLS de `assinaturas`). O portão de papel aqui só evita mostrar
 * "sem assinatura" a quem não administra — para essa pessoa o banco já não
 * entrega nada.
 */
export async function GET(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const supabase = await createClient();
  const [assinatura, situacao, marcas] = await Promise.all([
    supabase.from("assinaturas")
      .select("plano, situacao, em_atraso_desde, periodo_pago_ate, cancelar_no_fim, moeda, titular_email")
      .eq("workspace_id", r.workspaceId).maybeSingle<LinhaDaAssinatura>(),
    supabase.rpc("situacao_de_cobranca_da_conta", { p_workspace_id: r.workspaceId }),
    supabase.from("brands").select("id", { count: "exact", head: true }).eq("workspace_id", r.workspaceId),
  ]);
  if (assinatura.error || situacao.error || marcas.error) {
    return NextResponse.json({ message: "Não foi possível ler o plano." }, { status: 500 });
  }

  let plano: LinhaDoPlano | null = null;
  if (assinatura.data) {
    const { data } = await supabase.from("planos").select("codigo, nome, maximo_de_marcas").eq("codigo", assinatura.data.plano).maybeSingle<LinhaDoPlano>();
    plano = data ?? null;
  }
  const s = (situacao.data ?? {}) as { acesso?: Acesso; so_leitura_a_partir_de?: string | null };
  return NextResponse.json(planoDaConta({
    assinatura: assinatura.data ?? null, plano, marcas: marcas.count ?? 0,
    acesso: s.acesso ?? "livre", soLeituraAPartirDe: s.so_leitura_a_partir_de ?? null,
  }), { headers: { "Cache-Control": "private, no-store" } });
}
