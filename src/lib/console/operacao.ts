/**
 * As ações de operação do Console — etapa 3 (30/09/2026).
 *
 * Três alavancas: pausar ou retomar o Vini na plataforma inteira, numa conta
 * ou numa marca. Quem pode é decidido no BANCO (`console_pausar_*` recusam
 * com 42501 quem não é da equipe); aqui só se confere a FORMA do pedido, para
 * a recusa de um campo errado vir com frase, e não como erro do banco.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type AcaoDeOperacao =
  | { alvo: "plataforma"; pausado: boolean }
  | { alvo: "conta"; workspaceId: string; pausado: boolean }
  | { alvo: "marca"; brandId: string; pausado: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerAcaoDeOperacao(corpo: unknown): { ok: true; acao: AcaoDeOperacao } | { ok: false; motivo: string } {
  const c = (corpo ?? {}) as Record<string, unknown>;
  if (typeof c.pausado !== "boolean") return { ok: false, motivo: "Diga se pausa ou retoma o Vini." };
  const pausado = c.pausado;

  if (c.alvo === "plataforma") return { ok: true, acao: { alvo: "plataforma", pausado } };
  if (c.alvo === "conta") {
    if (typeof c.workspaceId !== "string" || !UUID.test(c.workspaceId)) return { ok: false, motivo: "Conta inválida." };
    return { ok: true, acao: { alvo: "conta", workspaceId: c.workspaceId, pausado } };
  }
  if (c.alvo === "marca") {
    if (typeof c.brandId !== "string" || !UUID.test(c.brandId)) return { ok: false, motivo: "Marca inválida." };
    return { ok: true, acao: { alvo: "marca", brandId: c.brandId, pausado } };
  }
  return { ok: false, motivo: "Ação desconhecida." };
}

/** A função do banco e os parâmetros de cada ação. */
export function chamadaDaAcao(acao: AcaoDeOperacao, motivo: string): { funcao: string; parametros: Record<string, unknown> } {
  switch (acao.alvo) {
    case "plataforma":
      return { funcao: "console_pausar_plataforma", parametros: { p_pausado: acao.pausado, p_motivo: motivo } };
    case "conta":
      return { funcao: "console_pausar_conta", parametros: { p_workspace_id: acao.workspaceId, p_pausado: acao.pausado, p_motivo: motivo } };
    case "marca":
      return { funcao: "console_pausar_marca", parametros: { p_brand_id: acao.brandId, p_pausado: acao.pausado, p_motivo: motivo } };
  }
}
