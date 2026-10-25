import { randomBytes } from "node:crypto";
import { validarCadastro, type DadosDoCadastro, type IdiomaDoCadastro } from "../cadastro/cadastro";

/**
 * A entrada no tour: o que a rota pede à pessoa e o que decide sobre as
 * respostas do banco. A pessoa informa NOME e E-MAIL; o e-mail real vai só para
 * o cadastro, nunca para o usuário do Supabase (que leva um endereço sintético).
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type PedidoDeEntrada = { dados: DadosDoCadastro; token: unknown };

export type ResultadoDoPedido = { ok: true; pedido: PedidoDeEntrada } | { ok: false; campo: string; mensagem: string };

export function lerPedidoDeEntrada(corpo: unknown): ResultadoDoPedido {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  // A origem é do servidor: o navegador não escolhe.
  const v = validarCadastro({ email: c.email, nome: c.nome, aceiteMarketing: c.aceiteMarketing, idioma: c.idioma, origem: "tour" });
  if (!v.ok) return v;
  return { ok: true, pedido: { dados: { ...v.dados, respostas: { ...v.dados.respostas, idioma: v.dados.idioma } }, token: c.token } };
}

/** O endereço do usuário do Supabase: domínio reservado (RFC 2606), nunca entrega nada. */
export function emailSinteticoDoVisitante(): string {
  return `visitante-${randomBytes(9).toString("hex")}@visitante.invalid`;
}

/** Senha que ninguém conhece: o servidor a usa uma vez, para abrir a sessão, e a esquece. */
export function senhaDeUmaVez(): string {
  return randomBytes(32).toString("base64url");
}

export type MotivoDaRecusa = "inativo" | "lotado" | "desconhecido";

/** Traduz o erro do banco (`P0001` com a mensagem) no motivo que a pessoa vê. */
export function motivoDaRecusa(mensagem: string | undefined | null): MotivoDaRecusa {
  if (mensagem === "demonstracao_inativa") return "inativo";
  if (mensagem === "demonstracao_lotada") return "lotado";
  return "desconhecido";
}

const TEXTOS: Record<IdiomaDoCadastro, Record<MotivoDaRecusa | "captcha" | "captcha_fora" | "indisponivel", string>> = {
  "pt-BR": {
    inativo: "O tour está em manutenção. Volte em instantes.",
    lotado: "O tour atingiu o limite de visitas de hoje. Volte amanhã ou fale com a gente.",
    desconhecido: "Não foi possível abrir o tour agora. Tente de novo.",
    captcha: "Não conseguimos confirmar que você é uma pessoa. Tente de novo.",
    captcha_fora: "A verificação não respondeu. Tente de novo em instantes.",
    indisponivel: "O tour não está disponível agora. Tente de novo em instantes.",
  },
  en: {
    inativo: "The tour is under maintenance. Please check back shortly.",
    lotado: "The tour reached today's visit limit. Come back tomorrow or talk to us.",
    desconhecido: "We couldn't open the tour right now. Please try again.",
    captcha: "We couldn't confirm you're a person. Please try again.",
    captcha_fora: "The verification didn't respond. Please try again shortly.",
    indisponivel: "The tour isn't available right now. Please try again shortly.",
  },
};

export function textoDaRecusa(chave: keyof (typeof TEXTOS)["pt-BR"], idioma: IdiomaDoCadastro): string {
  return TEXTOS[idioma][chave];
}

/** O banco devolve uma linha `{expira_em, workspace_id, marca_key}`; qualquer outra forma vale como falha. */
export function lerDestino(data: unknown): { expiraEm: string } | null {
  const linha = Array.isArray(data) ? data[0] : data;
  if (linha && typeof linha === "object" && typeof (linha as { expira_em?: unknown }).expira_em === "string") {
    return { expiraEm: (linha as { expira_em: string }).expira_em };
  }
  return null;
}
