import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COOKIE_DE_IDIOMA, isProductLocale } from "@/platform/locale";

/**
 * O botão de idioma. Grava a escolha no navegador (cookie) e, havendo sessão,
 * na pessoa (`profiles.locale`) — pelo cliente da SESSÃO, então a RLS garante
 * que só o próprio perfil muda. Visitante só ganha o cookie.
 *
 * Passa pelo `proxy` sem sessão (caminho exato em `caminhos-publicos.ts`):
 * a tela de login também tem o botão. Não dá acesso a nada.
 */
export async function POST(request: Request) {
  const corpo = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  if (!isProductLocale(corpo?.locale)) {
    return NextResponse.json({ error: "idioma_invalido" }, { status: 400 });
  }
  const locale = corpo.locale;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").update({ locale }).eq("id", user.id);
  } catch {
    // A preferência guardada é conveniência; o cookie já resolve neste navegador.
  }

  const resposta = NextResponse.json({ ok: true, locale }, { headers: { "Cache-Control": "no-store" } });
  resposta.cookies.set(COOKIE_DE_IDIOMA, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return resposta;
}
