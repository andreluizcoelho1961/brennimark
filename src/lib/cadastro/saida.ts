/**
 * A saída da lista (17/10/2026): o que o link de todo e-mail de marketing faz.
 *
 * Duas ações, as duas garantidas pela LGPD e pelo texto do aceite ("posso sair
 * a qualquer momento"): PARAR de receber e-mails, e APAGAR o cadastro inteiro.
 * As duas valem por `token_de_saida`, o segredo que o banco gerou para aquela
 * linha (`supabase/migrations/…_cadastros_gratuitos.sql`).
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */

export const ACOES_DE_SAIDA = ["sair", "apagar"] as const;
export type AcaoDeSaida = (typeof ACOES_DE_SAIDA)[number];

/** A forma de um uuid (o `gen_random_uuid()` do banco). Qualquer outra coisa nem chega lá. */
export function tokenDeSaidaValido(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}

export function lerPedidoDeSaida(corpo: unknown): { token: string; acao: AcaoDeSaida } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const { token, acao } = corpo as { token?: unknown; acao?: unknown };
  if (!tokenDeSaidaValido(token)) return null;
  const a = ACOES_DE_SAIDA.find((x) => x === acao);
  return a ? { token: token.toLowerCase(), acao: a } : null;
}

/** O clique no botão do e-mail de confirmação: só o token (a ação é uma só). */
export function lerPedidoDeConfirmacao(corpo: unknown): { token: string } | null {
  if (!corpo || typeof corpo !== "object") return null;
  const { token } = corpo as { token?: unknown };
  return tokenDeSaidaValido(token) ? { token: token.toLowerCase() } : null;
}
