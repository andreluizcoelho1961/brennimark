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
 *   6. se a assinatura tem conta, tratar o cancelamento (`tratarCancelamento`):
 *      registrar o pedido, estornar o arrependimento, mandar UM e-mail;
 *   7. concluir o aviso.
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
  /** Quando o cancelamento foi pedido, segundo o provedor. */
  pedidoDeCancelamentoEm: string | null;
  /** O provedor cancelou porque o pagamento falhou ou foi contestado. */
  porFaltaDePagamento: boolean;
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
  /**
   * Registra (ou esquece) o pedido de cancelamento — `cobranca_pedido_de_cancelamento`.
   * Devolve o estado quando há pedido; null quando não há.
   */
  pedidoDeCancelamento(p: {
    idAssinatura: string; pedido: boolean; porFaltaDePagamento: boolean; pedidoEm: string | null;
  }): Promise<EstadoDoCancelamento | null>;
  /**
   * Devolve o valor pago por inteiro e encerra a assinatura na hora. Não
   * estorna o que já foi estornado (à mão, pelo André). Devolve o estorno.
   */
  estornar(idAssinatura: string): Promise<string>;
  registrarEstorno(idAssinatura: string, idEstorno: string): Promise<void>;
  /** true reserva o e-mail (só o primeiro ganha); false devolve a reserva. */
  reservarAviso(idAssinatura: string, reservar: boolean): Promise<boolean>;
  avisarCancelamento(aviso: AvisoDeCancelamento): Promise<void>;
};

export type EstadoDoCancelamento = {
  nomeDaConta: string | null;
  titularEmail: string;
  situacao: Situacao;
  periodoPagoAte: string | null;
  arrependimento: boolean;
  estornada: boolean;
  avisado: boolean;
};

/**
 * Qual e-mail sai. Um só por pedido:
 *   arrependimento      cancelou em até 7 dias da 1ª assinatura: estornado, acesso encerrado
 *   falta-de-pagamento  o provedor cancelou depois das tentativas de cobrança
 *   no-fim-do-periodo   cancelou no Portal: acesso completo até `ate`
 *   imediato            cancelada na hora (pelo André, por exemplo), sem estorno automático
 */
export type TipoDeCancelamento = "arrependimento" | "falta-de-pagamento" | "no-fim-do-periodo" | "imediato";
export type AvisoDeCancelamento = { email: string; conta: string | null; tipo: TipoDeCancelamento; ate: string | null };

export function tipoDoCancelamento(
  estado: Pick<EstadoDoCancelamento, "arrependimento" | "situacao" | "periodoPagoAte">,
  porFaltaDePagamento: boolean,
): TipoDeCancelamento {
  if (estado.arrependimento) return "arrependimento";
  if (porFaltaDePagamento) return "falta-de-pagamento";
  if (estado.situacao !== "cancelada" && estado.periodoPagoAte) return "no-fim-do-periodo";
  return "imediato";
}

/**
 * O cancelamento, decidido. Cada passo é seguro de repetir — o Stripe repete
 * avisos, e uma falha no meio faz ele mandar o aviso de novo:
 *   1. o pedido: o banco registra uma vez e decide o arrependimento uma vez;
 *   2. o estorno: só no arrependimento e só se ainda não houve; o provedor
 *      recusa um segundo estorno igual (chave de repetição em `stripe.ts`);
 *   3. o e-mail: reservado antes de enviar; se o envio falha, a reserva volta
 *      e o erro sobe — o próximo aviso tenta de novo.
 */
export async function tratarCancelamento(assinatura: AssinaturaNoProvedor & { situacao: Situacao }, portas: Portas): Promise<void> {
  const pedido = assinatura.situacao === "cancelada" || assinatura.cancelarNoFim;
  const estado = await portas.pedidoDeCancelamento({
    idAssinatura: assinatura.idAssinatura, pedido,
    porFaltaDePagamento: assinatura.porFaltaDePagamento, pedidoEm: assinatura.pedidoDeCancelamentoEm,
  });
  if (!estado) return;

  if (estado.arrependimento && !estado.estornada) {
    const idEstorno = await portas.estornar(assinatura.idAssinatura);
    await portas.registrarEstorno(assinatura.idAssinatura, idEstorno);
  }

  if (estado.avisado) return;
  if (!(await portas.reservarAviso(assinatura.idAssinatura, true))) return;
  try {
    const tipo = tipoDoCancelamento(estado, assinatura.porFaltaDePagamento);
    await portas.avisarCancelamento({
      email: estado.titularEmail, conta: estado.nomeDaConta, tipo,
      ate: tipo === "no-fim-do-periodo" ? estado.periodoPagoAte : null,
    });
  } catch (erro) {
    await portas.reservarAviso(assinatura.idAssinatura, false);
    throw erro;
  }
}

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
    // Sem conta, não houve pagamento: não há o que cancelar nem estornar.
    if (conta) await tratarCancelamento({ ...assinatura, situacao: assinatura.situacao }, portas);
    return await concluir("processado", conta ? null : "nada a fazer: assinatura sem pagamento", idAssinatura, conta);
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : "erro desconhecido";
    await portas.concluir(provedor, aviso.id, "falhou", detalhe, idAssinatura);
    throw erro;
  }
}
