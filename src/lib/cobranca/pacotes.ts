/**
 * O pacote avulso de perguntas (08/11/2026): compra única, por cartão, que soma perguntas à
 * franquia do mês da conta e vale até o fim do mês seguinte. Desenho: docs/plan/pacote-avulso-de-perguntas.md.
 *
 * O catálogo mora AQUI, não no Stripe: o checkout leva o preço na própria sessão
 * (`price_data`), então não há produto a criar no painel e o valor que vale é o deste arquivo.
 * Quem credita é o webhook, e ele lê a QUANTIDADE do catálogo pelo código — nunca de um número
 * vindo nos metadados.
 */
export type Pacote = { codigo: string; quantidade: number; valorCentavos: number };

export const PACOTES: readonly Pacote[] = [
  { codigo: "100-perguntas", quantidade: 100, valorCentavos: 2900 },
  { codigo: "500-perguntas", quantidade: 500, valorCentavos: 11900 },
];

export function pacotePorCodigo(codigo: unknown): Pacote | null {
  return PACOTES.find((p) => p.codigo === codigo) ?? null;
}

/** O que o webhook credita, lido de uma sessão de checkout JÁ PAGA e assinada pelo Stripe. */
export type CompraDePacote = {
  workspaceId: string;
  pacote: Pacote;
  sessao: string;
  valorCentavos: number;
  moeda: "BRL";
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function compraDePacoteDoAviso(aviso: { type: string; data: { object: unknown } }): CompraDePacote | null {
  if (aviso.type !== "checkout.session.completed" && aviso.type !== "checkout.session.async_payment_succeeded") return null;
  const s = (aviso.data?.object ?? {}) as Record<string, unknown>;
  if (s.mode !== "payment") return null;
  const meta = (s.metadata ?? {}) as Record<string, unknown>;
  if (meta.tipo !== "pacote") return null;
  // Só pagamento confirmado credita. Cartão confirma na hora; o aviso de pagamento assíncrono
  // volta depois, e é ele que credita nesse caso.
  if (s.payment_status !== "paid") return null;

  const pacote = pacotePorCodigo(meta.pacote);
  const workspaceId = typeof meta.workspace_id === "string" && UUID.test(meta.workspace_id) ? meta.workspace_id : null;
  const sessao = typeof s.id === "string" && s.id.length > 0 ? s.id : null;
  if (!pacote || !workspaceId || !sessao) {
    throw new Error("pacote: sessão paga com metadados inválidos");
  }
  if (typeof s.currency === "string" && s.currency.toLowerCase() !== "brl") {
    throw new Error("pacote: moeda inesperada");
  }
  const valor = typeof s.amount_total === "number" ? s.amount_total : pacote.valorCentavos;
  return { workspaceId, pacote, sessao, valorCentavos: valor, moeda: "BRL" };
}

/** Os parâmetros da sessão de pagamento avulso. */
export function parametrosDoCheckoutDePacote(p: {
  pacote: Pacote; workspaceId: string; idDoCliente: string; origem: string; slugDaConta: string; ingles: boolean;
}) {
  const metadata = { tipo: "pacote", workspace_id: p.workspaceId, pacote: p.pacote.codigo };
  const volta = `${p.origem}/w/${encodeURIComponent(p.slugDaConta)}/configuracoes?parte=ia`;
  return {
    mode: "payment" as const,
    customer: p.idDoCliente,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "brl",
        unit_amount: p.pacote.valorCentavos,
        product_data: {
          name: p.ingles
            ? `${p.pacote.quantidade} extra Vini questions`
            : `${p.pacote.quantidade} perguntas extras do Vini`,
        },
      },
    }],
    metadata,
    payment_intent_data: { metadata },
    locale: p.ingles ? ("en" as const) : ("pt-BR" as const),
    success_url: `${volta}&pacote=ok`,
    cancel_url: volta,
  };
}

export type ParametrosDoCheckoutDePacote = ReturnType<typeof parametrosDoCheckoutDePacote>;
