/**
 * O Stripe traduzido para o produto — sem rede e sem o SDK, para ser testável.
 * O que é do Stripe mora aqui e em `stripe.ts`; o resto da cobrança não sabe
 * de Stripe, e um segundo provedor entra escrevendo o par dele.
 */
import type { AssinaturaNoProvedor, Situacao } from "./webhook";

/**
 * A tradução do estado do Stripe para o vocabulário do produto. Mora aqui, no
 * código do provedor, e não no banco: o banco não sabe de Stripe além do nome.
 *
 *   active, trialing               → ativa
 *   past_due, unpaid, paused       → em_atraso   (a tolerância de 7 dias conta daqui)
 *   canceled, incomplete_expired   → cancelada
 *   incomplete                     → incompleta  (Pix gerado e não pago: não abre conta)
 *
 * Estado que o Stripe venha a inventar devolve `null`: o aviso é ignorado e
 * registrado, e nada muda na conta — melhor que adivinhar.
 */
export function traduzirSituacaoDoStripe(status: string): Situacao | null {
  switch (status) {
    case "active":
    case "trialing":
      return "ativa";
    case "past_due":
    case "unpaid":
    case "paused":
      return "em_atraso";
    case "canceled":
    case "incomplete_expired":
      return "cancelada";
    case "incomplete":
      return "incompleta";
    default:
      return null;
  }
}

/** O mínimo de uma assinatura do Stripe (com `customer` expandido) que lemos. */
export type AssinaturaDoStripe = {
  id: string;
  status: string;
  currency: string;
  cancel_at_period_end: boolean;
  metadata?: Record<string, string> | null;
  customer: string | { id: string; email?: string | null; name?: string | null; deleted?: boolean };
  items: { data: Array<{ price: { id: string }; current_period_end?: number | null }> };
};

/**
 * Uma assinatura do produto tem UM preço. Mais de um item seria uma
 * assinatura montada fora do nosso checkout, e adivinhar qual deles é o plano
 * abriria conta no plano errado — então é erro, e o aviso falha visível.
 *
 * O nome da conta vem do `metadata` que o NOSSO checkout grava
 * (`nome_da_conta`); na falta dele, o nome do cliente no Stripe. O nome de
 * quem comprou (`comprador`) vira o nome do perfil do login.
 */
export function assinaturaDoStripe(sub: AssinaturaDoStripe): AssinaturaNoProvedor {
  if (sub.items.data.length !== 1) {
    throw new Error(`assinatura com ${sub.items.data.length} itens; o produto espera 1`);
  }
  const item = sub.items.data[0];
  const cliente = typeof sub.customer === "string" ? null : sub.customer;
  if (cliente?.deleted) throw new Error("cliente apagado no Stripe");
  const fim = item.current_period_end;
  return {
    idCliente: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    idAssinatura: sub.id,
    idPreco: item.price.id,
    situacao: traduzirSituacaoDoStripe(sub.status),
    periodoPagoAte: typeof fim === "number" ? new Date(fim * 1000).toISOString() : null,
    cancelarNoFim: sub.cancel_at_period_end,
    moeda: sub.currency.toUpperCase(),
    emailDoTitular: cliente?.email?.trim().toLowerCase() || null,
    nomeDaConta: sub.metadata?.nome_da_conta?.trim() || cliente?.name?.trim() || null,
    nomeDoComprador: sub.metadata?.comprador?.trim() || null,
  };
}
