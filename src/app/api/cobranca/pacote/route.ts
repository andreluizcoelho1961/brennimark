import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { inEnglish } from "@/platform/locale";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { chavesDoStripe, criarCheckoutDePacoteNoStripe } from "@/lib/cobranca/stripe";
import { pacotePorCodigo, parametrosDoCheckoutDePacote } from "@/lib/cobranca/pacotes";

/**
 * Abre o pagamento de um pacote avulso de perguntas (08/11/2026) para quem administra a conta.
 *
 * Esta rota só ABRE a página de pagamento do Stripe. Quem credita é o webhook assinado, depois
 * que o cartão passa — nunca a volta do navegador, que qualquer um poderia forjar.
 *
 *   - só a dona da conta (`papel === "owner"`); consulta e outras contas recebem 404;
 *   - o pacote vem do CATÁLOGO pelo código: o preço e a quantidade nunca vêm do pedido;
 *   - só conta com franquia de perguntas compra (plano "traga a sua IA" não tem cota a ampliar);
 *   - o cliente do Stripe é o da assinatura da conta, lido pela RLS: ninguém abre pagamento no
 *     cliente de outra conta mandando um identificador.
 */
export async function POST(request: Request) {
  const ingles = inEnglish(await idiomaDaSessao());
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const corpo = (await request.json().catch(() => null)) as { pacote?: unknown } | null;
  const pacote = pacotePorCodigo(corpo?.pacote);
  if (!pacote) {
    return NextResponse.json({ message: ingles ? "Choose one of the packs on the screen." : "Escolha um dos pacotes da tela." }, { status: 400 });
  }

  const chaves = chavesDoStripe();
  if (!chaves) {
    return NextResponse.json({ message: ingles ? "Payments aren't available yet. Talk to the Brennimark team." : "O pagamento ainda não está disponível. Fale com a equipe da Brennimark." }, { status: 503 });
  }

  const supabase = await createClient();
  const [assinatura, uso] = await Promise.all([
    supabase.from("assinaturas").select("id_externo_cliente").eq("workspace_id", r.workspaceId).maybeSingle<{ id_externo_cliente: string }>(),
    supabase.rpc("uso_do_vini_da_conta", { p_workspace_id: r.workspaceId }),
  ]);
  if (assinatura.error || uso.error) {
    return NextResponse.json({ message: ingles ? "Couldn't read the account." : "Não foi possível ler a conta." }, { status: 500 });
  }
  if (!assinatura.data) {
    return NextResponse.json({ message: ingles ? "This account doesn't have a subscription." : "Esta conta não tem assinatura." }, { status: 404 });
  }
  if ((uso.data as { franquia_do_plano: number | null } | null)?.franquia_do_plano == null) {
    return NextResponse.json({ message: ingles ? "Your plan has no question allowance to extend." : "O seu plano não tem franquia de perguntas para ampliar." }, { status: 409 });
  }

  try {
    const url = await criarCheckoutDePacoteNoStripe(chaves.chave, parametrosDoCheckoutDePacote({
      pacote, workspaceId: r.workspaceId, idDoCliente: assinatura.data.id_externo_cliente,
      origem: new URL(request.url).origin, slugDaConta: r.workspaceSlug, ingles,
    }));
    return NextResponse.json({ url }, { headers: { "Cache-Control": "no-store" } });
  } catch (erro) {
    console.error(JSON.stringify({ level: "error", msg: "cobranca_pacote_falhou", motivo: erro instanceof Error ? erro.message.slice(0, 200) : "desconhecido" }));
    return NextResponse.json({ message: ingles ? "The payment page didn't open. Try again in a moment." : "A página de pagamento não abriu. Tente de novo em instantes." }, { status: 500 });
  }
}
