import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { abrirPortalNoStripe, chavesDoStripe } from "@/lib/cobranca/stripe";
import { voltaDoPortal } from "@/lib/cobranca/plano-da-conta";

/**
 * Abre o Portal do Stripe para quem administra a conta (cobrança, fatia 3):
 * trocar o cartão, mudar de plano, cancelar, baixar as faturas.
 *
 * O cliente do Stripe sai da assinatura que a RLS entrega à SESSÃO — só o dono
 * a lê. Ninguém abre o portal de outra conta mandando um identificador.
 * Cada mudança feita lá volta pelo webhook, como qualquer outra.
 */
export async function POST(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const chaves = chavesDoStripe();
  if (!chaves) return NextResponse.json({ message: "A gestão da assinatura ainda não está disponível. Fale com a equipe da Brennimark." }, { status: 503 });

  const supabase = await createClient();
  const { data, error } = await supabase.from("assinaturas").select("id_externo_cliente").eq("workspace_id", r.workspaceId).maybeSingle<{ id_externo_cliente: string }>();
  if (error) return NextResponse.json({ message: "Não foi possível ler a assinatura." }, { status: 500 });
  if (!data) return NextResponse.json({ message: "Esta conta não tem assinatura." }, { status: 404 });

  try {
    const url = await abrirPortalNoStripe(chaves.chave, data.id_externo_cliente, voltaDoPortal(new URL(request.url).origin, r.workspaceSlug));
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error(JSON.stringify({ level: "error", msg: "cobranca_portal_falhou", motivo: erro instanceof Error ? erro.message.slice(0, 200) : "desconhecido" }));
    return NextResponse.json({ message: "O portal não abriu. Tente de novo em instantes." }, { status: 500 });
  }
}
