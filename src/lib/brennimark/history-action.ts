/**
 * O vocabulário do histórico, em um lugar só.
 *
 * O rótulo vive junto do valor porque os dois já saíram de sincronia uma vez:
 * a interface tratava tudo que não fosse `restored_to_matrix` como
 * "Publicada", então um valor novo apareceria como publicação — um histórico
 * que mente. Aqui um valor desconhecido é dito como desconhecido.
 */
export type HistoryAction =
  | "published"
  | "deleted"
  | "restored_from_version"
  /** Legado: gravado enquanto existia uma matriz em código para onde voltar. */
  | "restored_to_matrix";

export interface HistoryActionLabel {
  badge: string;
  summary: string;
  /** Verdadeiro quando o resumo substitui a lista de campos alterados: em
   *  exclusão ou recuperação, comparar campo a campo não diz o que houve. */
  replacesFieldList: boolean;
  /** Ações que não são publicação recebem selo discreto, sem preenchimento. */
  muted: boolean;
}

const ROTULOS: Record<HistoryAction, HistoryActionLabel> = {
  published: {
    badge: "Publicada",
    summary: "Versão republicada",
    replacesFieldList: false,
    muted: false,
  },
  deleted: {
    badge: "Excluída",
    summary: "Página excluída",
    replacesFieldList: true,
    muted: true,
  },
  restored_from_version: {
    badge: "Recuperada",
    summary: "Conteúdo recuperado de uma versão anterior",
    replacesFieldList: true,
    muted: false,
  },
  restored_to_matrix: {
    badge: "Retorno à matriz",
    summary: "Retorno à matriz em código, quando ela ainda existia",
    replacesFieldList: true,
    muted: true,
  },
};

export function historyActionLabel(action: HistoryAction | string): HistoryActionLabel {
  return (
    ROTULOS[action as HistoryAction] ?? {
      // Nunca apresentar ação desconhecida como publicação: era exatamente o
      // defeito que este módulo existe para impedir.
      badge: "Ação desconhecida",
      summary: "Registro de ação que esta versão do aplicativo não reconhece",
      replacesFieldList: true,
      muted: true,
    }
  );
}
