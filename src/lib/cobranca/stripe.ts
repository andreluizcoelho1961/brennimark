import "server-only";
import Stripe from "stripe";
import { assinaturaDoStripe, type AssinaturaDoStripe } from "./stripe-traducao";
import type { AssinaturaNoProvedor } from "./webhook";
import type { ParametrosDoCheckout } from "./compra";
import { CHAVE_DA_PROVA_NO_STRIPE, type SessaoDaCompra } from "./senha-na-volta";

export { lerAvisoAssinado } from "./aviso-assinado";

/**
 * As portas reais do Stripe. As chaves moram SÓ na Vercel, coladas pelo André
 * (como as de IA, ver ADR-0008): nunca no banco, nunca numa tela, nunca no log.
 *
 *   BRENNIMARK_CHAVE_STRIPE            a chave secreta (`sk_test_…` no modo de teste)
 *   BRENNIMARK_SEGREDO_WEBHOOK_STRIPE  o segredo com que o Stripe assina cada aviso (`whsec_…`)
 *
 * A versão da API é a que vem fixada no SDK (`stripe@23`, 2026-09-30.endive).
 * O endpoint do webhook no painel do Stripe precisa estar na mesma versão, ou
 * os avisos chegam num formato que este código não lê.
 */
export type ChavesDoStripe = { chave: string; segredoDoWebhook: string };

export function chavesDoStripe(): ChavesDoStripe | null {
  const chave = process.env.BRENNIMARK_CHAVE_STRIPE;
  const segredoDoWebhook = process.env.BRENNIMARK_SEGREDO_WEBHOOK_STRIPE;
  if (!chave || !segredoDoWebhook) return null;
  return { chave, segredoDoWebhook };
}

/** A assinatura como está AGORA no Stripe, com o cliente junto (e-mail e nome). */
export async function buscarAssinaturaNoStripe(chave: string, idAssinatura: string): Promise<AssinaturaNoProvedor> {
  const stripe = new Stripe(chave);
  const sub = await stripe.subscriptions.retrieve(idAssinatura, { expand: ["customer"] });
  return assinaturaDoStripe(sub as unknown as AssinaturaDoStripe);
}

/**
 * A sessão de checkout como está AGORA no Stripe — o que a volta do pagamento
 * precisa para decidir se a senha pode ser criada (`senha-na-volta.ts`).
 * "Paga" é a sessão concluída com pagamento confirmado; sessão em aberto ou
 * expirada não conta.
 */
export async function buscarSessaoNoStripe(chave: string, idDaSessao: string): Promise<SessaoDaCompra> {
  const sessao = await new Stripe(chave).checkout.sessions.retrieve(idDaSessao);
  const assinatura = typeof sessao.subscription === "string" ? sessao.subscription : sessao.subscription?.id ?? null;
  return {
    paga: sessao.status === "complete" && sessao.payment_status === "paid",
    criadaEm: sessao.created * 1000,
    email: (sessao.customer_details?.email ?? sessao.customer_email ?? null)?.toLowerCase() ?? null,
    idAssinatura: assinatura,
    resumoDaProva: sessao.metadata?.[CHAVE_DA_PROVA_NO_STRIPE] ?? null,
    comprador: sessao.metadata?.comprador?.trim() || null,
    empresa: sessao.metadata?.nome_da_conta?.trim() || null,
    termosVersao: sessao.metadata?.termos_versao ?? null,
    privacidadeVersao: sessao.metadata?.privacidade_versao ?? null,
  };
}

/** Abre a página de pagamento do Stripe e devolve o endereço dela. */
export async function criarCheckoutNoStripe(chave: string, parametros: ParametrosDoCheckout): Promise<string> {
  const sessao = await new Stripe(chave).checkout.sessions.create(parametros as Stripe.Checkout.SessionCreateParams);
  if (!sessao.url) throw new Error("o Stripe não devolveu o endereço do checkout");
  return sessao.url;
}

/** O Portal do assinante: trocar cartão, mudar de plano, cancelar, baixar faturas. */
export async function abrirPortalNoStripe(chave: string, idDoCliente: string, volta: string): Promise<string> {
  const sessao = await new Stripe(chave).billingPortal.sessions.create({ customer: idDoCliente, return_url: volta });
  return sessao.url;
}
