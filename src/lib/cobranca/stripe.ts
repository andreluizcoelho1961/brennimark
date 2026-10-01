import "server-only";
import Stripe from "stripe";
import { assinaturaDoStripe, type AssinaturaDoStripe } from "./stripe-traducao";
import type { AssinaturaNoProvedor } from "./webhook";
import type { ParametrosDoCheckout } from "./compra";

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

/** O valor do preço, em centavos — o teto do mandato do Pix Automático. */
export async function valorDoPrecoNoStripe(chave: string, idDoPreco: string): Promise<number> {
  const preco = await new Stripe(chave).prices.retrieve(idDoPreco);
  if (typeof preco.unit_amount !== "number") throw new Error("preço sem valor fixo");
  return preco.unit_amount;
}

/** Abre a página de pagamento do Stripe e devolve o endereço dela. */
export async function criarCheckoutNoStripe(chave: string, parametros: ParametrosDoCheckout): Promise<string> {
  const sessao = await new Stripe(chave).checkout.sessions.create(parametros as Stripe.Checkout.SessionCreateParams);
  if (!sessao.url) throw new Error("o Stripe não devolveu o endereço do checkout");
  return sessao.url;
}
