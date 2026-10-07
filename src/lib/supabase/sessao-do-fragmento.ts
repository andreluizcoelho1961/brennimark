/**
 * A sessão que vem no fragmento do endereço (`#access_token=…&refresh_token=…`),
 * como o provedor de autenticação a entrega nos links gerados pelo servidor.
 *
 * Só lê. Quem confere se o token vale é o `setSession`, no servidor de
 * autenticação — um fragmento inventado não abre sessão nenhuma.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export function lerSessaoDoFragmento(hash: string): { access_token: string; refresh_token: string } | null {
  const texto = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!texto) return null;
  const p = new URLSearchParams(texto);
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}
