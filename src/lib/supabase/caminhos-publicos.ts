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
 * O SITE entrou em 29/09/2026: a home (`/`) e as páginas públicas (`/vini`,
 * `/agencias`…). Estes casam pelo caminho EXATO, nunca por prefixo — `/` como
 * prefixo abriria o produto inteiro, e `/vini` como prefixo abriria qualquer
 * rota que um dia comece assim. Página do site é HTML gerado no deploy e não
 * lê dado nenhum; passar sem sessão não expõe nada.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
import { CAMINHOS_DO_SITE } from "../site/paginas";

export const CAMINHOS_PUBLICOS = ["/login", "/auth/callback", "/api/manutencao/"] as const;

export function caminhoPublico(pathname: string): boolean {
  if (CAMINHOS_DO_SITE.has(pathname)) return true;
  return CAMINHOS_PUBLICOS.some((prefixo) => pathname.startsWith(prefixo));
}
