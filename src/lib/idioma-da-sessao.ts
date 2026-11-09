import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_DE_IDIOMA, escolherIdioma, type ProductLocale } from "@/platform/locale";

/**
 * O idioma da interface neste pedido (ordem em `escolherIdioma`).
 *
 * O banco só é consultado quando não há cookie E há sessão: quem acabou de
 * escolher no botão já tem o cookie, e o visitante não tem perfil.
 */
export async function idiomaDaSessao(): Promise<ProductLocale> {
  const cookie = (await cookies()).get(COOKIE_DE_IDIOMA)?.value;
  const acceptLanguage = (await headers()).get("accept-language");
  if (cookie) return escolherIdioma({ cookie, acceptLanguage });

  let perfil: unknown;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("locale").eq("id", user.id).maybeSingle();
      perfil = data?.locale;
    }
  } catch {
    // Sem banco, vale o navegador: o idioma nunca pode derrubar a tela.
  }
  return escolherIdioma({ perfil, acceptLanguage });
}
