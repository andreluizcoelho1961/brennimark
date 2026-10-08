/**
 * O pedido de exportação (08/10/2026) — Termos, seção 13: "A exportação
 * devolve os arquivos originais e um índice do conteúdo, em até 15 dias
 * depois do pedido." Nesta versão a equipe entrega à mão e marca no Console.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

/** O prazo prometido, em dias corridos. */
export const PRAZO_DA_EXPORTACAO_DIAS = 15;

export function prazoDaExportacao(pedidoEm: string): string {
  return new Date(new Date(pedidoEm).getTime() + PRAZO_DA_EXPORTACAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

/** O que a tela de Plano mostra. `null`: nunca pediu. */
export type PedidoDeExportacao = { pedidoEm: string; prazo: string; entregueEm: string | null } | null;

export function pedidoParaTela(linha: { pedido_em: string; entregue_em: string | null } | null): PedidoDeExportacao {
  if (!linha) return null;
  return { pedidoEm: linha.pedido_em, prazo: prazoDaExportacao(linha.pedido_em), entregueEm: linha.entregue_em };
}
