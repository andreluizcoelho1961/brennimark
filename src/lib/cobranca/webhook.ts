/**
 * O aviso do provedor de pagamento, decidido — sem rede, sem banco, sem
 * Stripe. A rota (`/api/cobranca/stripe`) liga as portas reais; aqui mora só a
 * decisão, para que ela seja testável por inteiro.
 *
 * ─── O caminho de um aviso ──────────────────────────────────────────────
 *
 *   1. registrar no banco pelo identificador do aviso: se já foi concluído,
 *      não faz nada (o provedor REPETE avisos);
 *   2. tipo que não interessa → concluído como "ignorado";
 *   3. achar a assinatura a que o aviso se refere e LÊ-LA DE NOVO no provedor:
 *      o estado atual vale mais que o retrato do aviso, porque os avisos não
 *      chegam em ordem (a fatura paga pode chegar antes do checkout concluído);
 *   4. pagamento confirmado → garantir o login do titular;
 *   5. sincronizar no banco, que abre a conta no primeiro pagamento;
 *   6. concluir o aviso.
 *
 * Qualquer erro marca o aviso como "falhou" e sobe: a rota responde 500, e o
 * provedor tenta de novo mais tarde. Um aviso perdido seria um cliente que
 * pagou e não ganhou conta.
 */

export type Situacao = "ativa" | "em_atraso" | "cancelada" | "incompleta";

export const TIPOS_TRATADOS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

/** O mínimo de um aviso do Stripe que a decisão lê. */
export type Aviso = { id: string; type: string; data: { object: unknown } };

function texto(valor: unknown): string | null {
  if (typeof valor === "string" && valor.length > 0) return valor;
  // Campo expandido: o Stripe devolve o objeto inteiro no lugar do identificador.
  if (valor && typeof valor === "object" && typeof (valor as { id?: unknown }).id === "string") {
    return (valor as { id: string }).id;
  }
  return null;
}

/**
 * De que assinatura o aviso fala. Cada tipo guarda o identificador num lugar:
 * a sessão de checkout em `subscription`, a assinatura no próprio `id`, e a
 * fatura (desde a API de 2025) em `parent.subscription_details.subscription`.
 */
export function assinaturaDoAviso(aviso: Aviso): string | null {
  const objeto = (aviso.data?.object ?? {}) as Record<string, unknown>;
  if (aviso.type.startsWith("checkout.session.")) {
    return objeto.mode === "subscription" ? texto(objeto.subscription) : null;
  }
  if (aviso.type.startsWith("customer.subscription.")) return texto(objeto.id);
  if (aviso.type.startsWith("invoice.")) {
    const pai = objeto.parent as { subscription_details?: { subscription?: unknown } } | null | undefined;
    return texto(pai?.subscription_details?.subscription) ?? texto(objeto.subscription);
  }
  return null;
}

/** A assinatura como o provedor a descreve AGORA, já no formato do produto. */
export type AssinaturaNoProvedor = {
  idCliente: string;
  idAssinatura: string;
  idPreco: string;
  situacao: Situacao | null;
  periodoPagoAte: string | null;
  cancelarNoFim: boolean;
  moeda: string;
  emailDoTitular: string | null;
  nomeDaConta: string | null;
  /** Quem preencheu o `/assinar` — vira o nome do perfil. */
  nomeDoComprador: string | null;
};

export type Recebimento = "novo" | "repetir" | "concluido";
export type Resultado = "processado" | "ignorado";

export type Portas = {
  receber(provedor: string, idDoAviso: string, tipo: string): Promise<Recebimento>;
  concluir(provedor: string, idDoAviso: string, resultado: Resultado | "falhou",
           detalhe: string | null, idAssinatura: string | null): Promise<void>;
  buscarAssinatura(idAssinatura: string): Promise<AssinaturaNoProvedor>;
  /**
   * Cria o login do titular se ainda não existir. Login que já existe não é
   * erro. O login novo leva a assinatura que o criou: só a volta DESSA compra
   * pode criar a senha dele (`senha-na-volta.ts`).
   */
  garantirLogin(email: string, nome: string | null, idAssinatura: string): Promise<void>;
  sincronizar(assinatura: AssinaturaNoProvedor & { situacao: Situacao; emailDoTitular: string }): Promise<string | null>;
};

export type Desfecho = { resultado: Resultado | "repetido"; detalhe: string | null; conta: string | null };

export async function processarAviso(provedor: string, aviso: Aviso, portas: Portas): Promise<Desfecho> {
  const recebimento = await portas.receber(provedor, aviso.id, aviso.type);
  if (recebimento === "concluido") return { resultado: "repetido", detalhe: null, conta: null };

  const concluir = async (resultado: Resultado, detalhe: string | null, idAssinatura: string | null, conta: string | null) => {
    await portas.concluir(provedor, aviso.id, resultado, detalhe, idAssinatura);
    return { resultado, detalhe, conta };
  };

  if (!TIPOS_TRATADOS.has(aviso.type)) return concluir("ignorado", "tipo não tratado", null, null);

  const idAssinatura = assinaturaDoAviso(aviso);
  if (!idAssinatura) return concluir("ignorado", "aviso sem assinatura", null, null);

  try {
    const assinatura = await portas.buscarAssinatura(idAssinatura);
    if (!assinatura.situacao) return await concluir("ignorado", "estado desconhecido do provedor", idAssinatura, null);
    if (!assinatura.emailDoTitular) throw new Error("assinatura sem e-mail do titular");

    if (assinatura.situacao === "ativa") {
      await portas.garantirLogin(assinatura.emailDoTitular, assinatura.nomeDoComprador, assinatura.idAssinatura);
    }
    const conta = await portas.sincronizar({
      ...assinatura, situacao: assinatura.situacao, emailDoTitular: assinatura.emailDoTitular,
    });
    return await concluir("processado", conta ? null : "nada a fazer: assinatura sem pagamento", idAssinatura, conta);
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : "erro desconhecido";
    await portas.concluir(provedor, aviso.id, "falhou", detalhe, idAssinatura);
    throw erro;
  }
}
