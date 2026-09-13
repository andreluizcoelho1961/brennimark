/**
 * O que fazer quando alguém pede para tirar um asset da biblioteca.
 *
 * Módulo puro, e é de propósito: a rota precisa de sessão, marca e Storage, e
 * a suíte de unidade não tem nenhum dos três. Deixar esta decisão dentro da
 * rota a tornaria verificável só por leitura de código — e é justamente ela
 * que separa "sai de uso" de "some para sempre".
 *
 * Ver ADR-0007 §2.4, item 10.
 */

export type PedidoDeRemocao = {
  /** A pessoa pediu o apagamento definitivo, e não a descontinuação. */
  definitivo: boolean;
  /** Quando o asset saiu de uso. Nulo enquanto ele está em uso. */
  descontinuadoEm: string | null;
};

export type Decisao =
  /** Marca como fora de uso. O arquivo continua no acervo. */
  | { acao: "descontinuar" }
  /** Apaga a linha e enfileira o arquivo. Não há volta. */
  | { acao: "apagar" }
  /**
   * Recusa: pediram o apagamento de algo que ainda está em uso.
   *
   * A trava não é burocracia. Quem clica numa grade cheia de cards está a um
   * pixel do card errado, e este caminho não tem desfazer. Exigir que o asset
   * já esteja fora de uso torna o erro caro de cometer e barato de perceber.
   */
  | { acao: "recusar"; motivo: "precisa-descontinuar-antes" }
  /** Já está fora de uso; descontinuar de novo não é operação. */
  | { acao: "recusar"; motivo: "ja-descontinuado" };

export function decidirRemocao({ definitivo, descontinuadoEm }: PedidoDeRemocao): Decisao {
  const emUso = descontinuadoEm === null;

  if (!definitivo) {
    return emUso ? { acao: "descontinuar" } : { acao: "recusar", motivo: "ja-descontinuado" };
  }
  return emUso ? { acao: "recusar", motivo: "precisa-descontinuar-antes" } : { acao: "apagar" };
}
