import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { pedidoParaTela, prazoDaExportacao } from "@/lib/cobranca/exportacao";
import { emailConfigurado, enviarEmail } from "@/lib/email/enviar";
import { mensagemDePedidoDeExportacao } from "@/lib/email/mensagens";
import { EMPRESA } from "@/lib/site/empresa";

/**
 * Configurações › Plano › Exportação (08/10/2026).
 *
 * GET devolve o último pedido (a via de reserva, entregue à mão) e a última
 * exportação feita pelo navegador (`iniciar`, `enderecos`, `concluir`).
 *
 * Só o DONO da conta, com a sessão dele: a leitura passa pela RLS de
 * `pedidos_de_exportacao` e o pedido pela função `pedir_exportacao`, que
 * confere o papel de novo. Funciona também na conta só para leitura — é
 * justamente a cancelada que mais precisa exportar.
 */
const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const supabase = await createClient();
  const [pedido, ultima] = await Promise.all([
    supabase.from("pedidos_de_exportacao")
      .select("pedido_em, entregue_em").eq("workspace_id", r.workspaceId)
      .order("pedido_em", { ascending: false }).limit(1).maybeSingle<{ pedido_em: string; entregue_em: string | null }>(),
    supabase.from("exportacoes_da_conta")
      .select("iniciada_em, concluida_em").eq("workspace_id", r.workspaceId)
      .order("iniciada_em", { ascending: false }).limit(1).maybeSingle<{ iniciada_em: string; concluida_em: string | null }>(),
  ]);
  if (pedido.error || ultima.error) return NextResponse.json({ message: "Não foi possível ler a exportação." }, { status: 500 });
  return NextResponse.json({
    pedido: pedidoParaTela(pedido.data ?? null),
    ultimaExportacao: ultima.data ? { iniciadaEm: ultima.data.iniciada_em, concluidaEm: ultima.data.concluida_em } : null,
  }, SEM_CACHE);
}

export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pedir_exportacao", { p_workspace_id: r.workspaceId });
  if (error?.code === "42501") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (error || !data) return NextResponse.json({ message: "Não foi possível registrar o pedido." }, { status: 500 });
  const p = data as { pedido_em: string; novo: boolean; conta: string; pedido_por: string | null };

  // Só o pedido NOVO avisa a equipe. Falha no e-mail não desfaz o pedido: ele
  // está no Console, e a equipe o vê de qualquer jeito.
  if (p.novo && emailConfigurado()) {
    const envio = await enviarEmail(EMPRESA.email, mensagemDePedidoDeExportacao({
      conta: p.conta, pedidoPor: p.pedido_por, pedidoEm: p.pedido_em, prazo: prazoDaExportacao(p.pedido_em),
      linkDoConsole: `${EMPRESA.site}/console/cobranca`,
    }));
    if (!envio.ok) console.error(JSON.stringify({ level: "error", msg: "exportacao_aviso_falhou", motivo: envio.motivo }));
  }
  return NextResponse.json({ pedido: pedidoParaTela({ pedido_em: p.pedido_em, entregue_em: null }) }, SEM_CACHE);
}
