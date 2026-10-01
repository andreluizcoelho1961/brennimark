/**
 * O plano da conta como a tela de Configurações o mostra (cobrança, fatia 3).
 * Sem rede: a rota lê o banco e entrega as linhas; aqui se monta o que se diz.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export type Acesso = "livre" | "ativa" | "tolerancia" | "so_leitura";

export type LinhaDaAssinatura = {
  plano: string; situacao: "ativa" | "em_atraso" | "cancelada"; em_atraso_desde: string | null;
  periodo_pago_ate: string | null; cancelar_no_fim: boolean; moeda: string | null; titular_email: string;
};
export type LinhaDoPlano = { codigo: string; nome: string; maximo_de_marcas: number | null };

export type PlanoDaConta =
  | { assinada: false }
  | {
      assinada: true;
      plano: string;
      acesso: Acesso;
      marcas: { usadas: number; maximo: number | null };
      pagoAte: string | null;
      cancelaNoFim: boolean;
      soLeituraAPartirDe: string | null;
      titular: string;
    };

export function planoDaConta(p: {
  assinatura: LinhaDaAssinatura | null; plano: LinhaDoPlano | null; marcas: number; acesso: Acesso; soLeituraAPartirDe: string | null;
}): PlanoDaConta {
  if (!p.assinatura) return { assinada: false };
  return {
    assinada: true,
    plano: p.plano?.nome ?? p.assinatura.plano,
    acesso: p.acesso,
    marcas: { usadas: p.marcas, maximo: p.plano?.maximo_de_marcas ?? null },
    pagoAte: p.assinatura.periodo_pago_ate,
    cancelaNoFim: p.assinatura.situacao === "ativa" && p.assinatura.cancelar_no_fim,
    soLeituraAPartirDe: p.acesso === "tolerancia" ? p.soLeituraAPartirDe : null,
    titular: p.assinatura.titular_email,
  };
}

/**
 * Para onde o Portal do Stripe devolve a pessoa: só a própria tela de
 * Configurações da conta. Um endereço vindo do pedido nunca vira destino
 * livre — o Portal redirecionaria para onde quem pediu quisesse.
 */
export function voltaDoPortal(origem: string, slugDaConta: string): string {
  return `${origem}/w/${encodeURIComponent(slugDaConta)}/configuracoes?parte=plano`;
}
