import Stripe from "stripe";
import type { Aviso } from "./webhook";

/**
 * Confere a assinatura do aviso e devolve o aviso, ou `null` se ela não bate
 * ou passou da tolerância de tempo do Stripe (5 minutos: um aviso antigo
 * reenviado por quem o capturou não vale).
 *
 * Precisa do corpo EXATO, em texto: o que foi assinado são os bytes, e um
 * corpo relido como JSON e reescrito não confere mais.
 *
 * Fora de `stripe.ts` (que é `server-only`) para que a suíte de unidade prove
 * a recusa sem servidor; não usa chave nenhuma além do segredo recebido.
 */
export async function lerAvisoAssinado(corpo: string, cabecalho: string, segredo: string): Promise<Aviso | null> {
  try {
    return (await Stripe.webhooks.constructEventAsync(corpo, cabecalho, segredo)) as unknown as Aviso;
  } catch {
    return null;
  }
}
