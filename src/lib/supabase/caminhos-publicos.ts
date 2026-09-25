/**
 * O que o `proxy` deixa passar sem sessão.
 *
 * `/api/manutencao/` entrou em 24/09/2026: quem chama é o Vercel Cron, que não
 * tem sessão — sem a exceção, o `proxy` o redirecionaria para `/login` e a
 * limpeza nunca rodaria, em silêncio (um 307 não é falha no log do Cron).
 *
 * Passar sem sessão NÃO é passar sem autorização: toda rota sob
 * `/api/manutencao/` exige o segredo do Cron por conta própria, antes de
 * qualquer cliente existir. A barra final é de propósito — `/api/manutencaox`
 * não é manutenção.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const CAMINHOS_PUBLICOS = ["/login", "/auth/callback", "/api/manutencao/"] as const;

export function caminhoPublico(pathname: string): boolean {
  return CAMINHOS_PUBLICOS.some((prefixo) => pathname.startsWith(prefixo));
}
