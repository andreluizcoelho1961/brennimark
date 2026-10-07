import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Não adianta pedir `flowType: "implicit"` aqui: o `@supabase/ssr` força
    // "pkce" por cima das opções (createBrowserClient, 0.12). Os links com a
    // sessão no fragmento (`#access_token=…`) são tratados à mão em
    // `/auth/callback` — ver `sessao-do-fragmento.ts`. Corrigido em 07/10/2026:
    // o comentário anterior afirmava que a opção funcionava, e ela nunca valeu.
  );
}
