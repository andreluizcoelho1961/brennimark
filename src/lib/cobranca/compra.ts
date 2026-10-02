/**
 * A compra — o pedido de quem quer assinar, conferido, e o checkout do Stripe
 * montado a partir dele. Sem rede e sem SDK: a rota liga as portas reais.
 *
 * O que o comprador escolhe é o PLANO e a MOEDA. O preço do Stripe nunca vem
 * dele: o servidor o resolve no banco (`cobranca_preco_ativo`), e por isso
 * ninguém compra o Premium pelo preço do Básico mexendo no pedido.
 */

import { CHAVE_DA_PROVA_NO_STRIPE } from "./senha-na-volta";

export type Moeda = "BRL" | "USD";
export const MOEDAS: readonly Moeda[] = ["BRL", "USD"];

export type PedidoDeCompra = {
  plano: string;
  moeda: Moeda;
  nome: string;
  email: string;
  empresa: string;
};

export type Leitura<T> = { ok: true; valor: T } | { ok: false; motivo: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODIGO_DE_PLANO = /^[a-z0-9][a-z0-9-]{1,39}$/;

function texto(valor: unknown, maximo: number): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().replace(/\s+/g, " ");
  return limpo.length >= 1 && limpo.length <= maximo ? limpo : null;
}

export function lerPedidoDeCompra(corpo: unknown): Leitura<PedidoDeCompra> {
  const c = (corpo ?? {}) as Record<string, unknown>;
  const plano = typeof c.plano === "string" && CODIGO_DE_PLANO.test(c.plano) ? c.plano : null;
  if (!plano) return { ok: false, motivo: "Escolha um plano." };
  const moeda = MOEDAS.find((m) => m === c.moeda);
  if (!moeda) return { ok: false, motivo: "Escolha a moeda." };
  const nome = texto(c.nome, 120);
  if (!nome) return { ok: false, motivo: "Diga o seu nome." };
  const email = typeof c.email === "string" ? c.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) return { ok: false, motivo: "Confira o e-mail." };
  const empresa = texto(c.empresa, 120);
  if (!empresa) return { ok: false, motivo: "Diga o nome da empresa: ele vira o nome da conta." };
  return { ok: true, valor: { plano, moeda, nome, email, empresa } };
}

/**
 * Os parâmetros do checkout do Stripe, por inteiro — testáveis sem rede.
 *
 *   - assinatura mensal, um item, o preço que o BANCO escolheu;
 *   - o nome da conta vai no `metadata` da assinatura, que é de onde o webhook
 *     o lê ao abrir a conta (`stripe-traducao.ts`);
 *   - SÓ CARTÃO, decisão do André em 02/10/2026. O Stripe não oferece Pix em
 *     assinatura para conta brasileira ("O Pix Automático não está disponível
 *     no Brasil", na documentação dele) e o descarta da sessão sem erro. Os
 *     meios vêm do que estiver ligado no painel do Stripe;
 *   - o CNPJ/CPF é pedido para a nota fiscal (fatia 4);
 *   - o resumo da prova do navegador vai nos metadados da SESSÃO, não da
 *     assinatura: é com ele que a volta confere quem pode criar a senha
 *     (`senha-na-volta.ts`). O link de piloto não leva prova;
 *   - a volta leva o identificador da sessão. Sozinho ele não dá nada — a
 *     conta nasce do webhook, e a senha exige também a prova do navegador.
 */
export function parametrosDoCheckout(p: {
  pedido: PedidoDeCompra;
  idDoPreco: string;
  origem: string;
  piloto?: boolean;
  resumoDaProva?: string;
}) {
  const { pedido, idDoPreco, origem } = p;
  const metadata = { nome_da_conta: pedido.empresa, plano: pedido.plano, comprador: pedido.nome, ...(p.piloto ? { piloto: "sim" } : {}) };
  return {
    mode: "subscription" as const,
    line_items: [{ price: idDoPreco, quantity: 1 }],
    customer_email: pedido.email,
    metadata: { ...metadata, ...(p.resumoDaProva ? { [CHAVE_DA_PROVA_NO_STRIPE]: p.resumoDaProva } : {}) },
    subscription_data: { metadata },
    locale: pedido.moeda === "BRL" ? ("pt-BR" as const) : ("en" as const),
    billing_address_collection: "required" as const,
    tax_id_collection: { enabled: true },
    success_url: `${origem}/assinar/obrigado?sessao={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origem}/assinar?plano=${encodeURIComponent(pedido.plano)}`,
  };
}

export type ParametrosDoCheckout = ReturnType<typeof parametrosDoCheckout>;
