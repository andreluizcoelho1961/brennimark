import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { chavesDoStripe, criarCheckoutNoStripe } from "./stripe";
import { parametrosDoCheckout, type PedidoDeCompra } from "./compra";

/**
 * Abrir o checkout — o mesmo caminho para a compra pelo site e para o link de
 * piloto do Console. A diferença é uma só: o site só acha preço de plano À
 * VENDA; o Console acha de qualquer plano (o Piloto não está à venda).
 *
 * O preço do Stripe sai do BANCO, nunca do pedido.
 */
export type Abertura =
  | { ok: true; url: string }
  | { ok: false; status: 409 | 500 | 503; motivo: string };

export async function abrirCheckout(
  pedido: PedidoDeCompra, origem: string, opcoes: { piloto: boolean; resumoDaProva?: string },
): Promise<Abertura> {
  const en = pedido.idioma === "en";
  const chaves = chavesDoStripe();
  const fechada = en ? "Online purchase isn't open yet. Talk to the Brennimark team." : "A compra online ainda não está aberta. Fale com a equipe da Brennimark.";
  if (!chaves) return { ok: false, status: 503, motivo: fechada };

  let servico;
  try {
    servico = createServiceClient();
  } catch {
    return { ok: false, status: 503, motivo: fechada };
  }

  const { data: idDoPreco, error } = await servico.rpc("cobranca_preco_ativo", {
    p_plano: pedido.plano, p_moeda: pedido.moeda, p_intervalo: "mes", p_so_a_venda: !opcoes.piloto,
  });
  const naoConsultou = en ? "Couldn't look up the plan. Try again." : "Não foi possível consultar o plano. Tente de novo.";
  if (error) return { ok: false, status: 500, motivo: naoConsultou };
  if (typeof idDoPreco !== "string") {
    return { ok: false, status: 409, motivo: en ? "This plan isn't on sale in this currency yet." : "Este plano ainda não está à venda nesta moeda." };
  }

  // Um e-mail, uma assinatura viva — pela compra do site. Sem isto, quem paga
  // de novo com o mesmo e-mail ganha uma segunda conta e uma segunda cobrança
  // (aconteceu no teste real de 02/10/2026). Trocar de plano é pelo Portal.
  //
  // Tradeoff aceito: a frase confirma, a quem digitar um e-mail, que ele já é
  // assinante. É conta de empresa, e evitar a cobrança em dobro vale mais;
  // quando houver e-mail, a resposta pode virar "mandamos as instruções".
  // O link de piloto do Console não passa por aqui: quem o gera é a equipe.
  if (!opcoes.piloto) {
    const { data: viva, error: erroDaBusca } = await servico.from("assinaturas")
      .select("id").eq("titular_email", pedido.email).in("situacao", ["ativa", "em_atraso"]).limit(1);
    if (erroDaBusca) return { ok: false, status: 500, motivo: naoConsultou };
    if ((viva ?? []).length > 0) {
      return {
        ok: false, status: 409,
        motivo: en
          ? "This email address already has a Brennimark subscription. To change plan, sign in to your account and go to Settings → Plan. To open another account, use a different email address."
          : "Este e-mail já tem uma assinatura do Brennimark. Para trocar de plano, entre na sua conta e vá em Configurações → Plano. Para abrir outra conta, use outro e-mail.",
      };
    }
  }

  try {
    const url = await criarCheckoutNoStripe(chaves.chave,
      parametrosDoCheckout({ pedido, idDoPreco, origem, piloto: opcoes.piloto, resumoDaProva: opcoes.resumoDaProva }));
    return { ok: true, url };
  } catch (erro) {
    console.error(JSON.stringify({ level: "error", msg: "cobranca_checkout_falhou", plano: pedido.plano, moeda: pedido.moeda,
      motivo: erro instanceof Error ? erro.message.slice(0, 200) : "desconhecido" }));
    return { ok: false, status: 500, motivo: en ? "The payment page didn't open. Try again in a moment." : "O pagamento não abriu. Tente de novo em instantes." };
  }
}
