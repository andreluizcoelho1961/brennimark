import { destinoDeRetorno } from "@/platform/destino-de-retorno";
import { CAMINHO_DA_TROCA, desvioDaSenhaProvisoria } from "@/lib/acesso/senha-provisoria";
import { caminhoPublico } from "@/lib/supabase/caminhos-publicos";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  // Local-review escape hatch — set in .env.local only, never in
  // Vercel env vars. Lets you look at the app without going through
  // Supabase auth. Does nothing unless explicitly set to "true".
  if (process.env.BRENNIMARK_DEV_SKIP_AUTH === "true") {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = caminhoPublico(request.nextUrl.pathname);

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Mesmo vindo de dentro, passa pela mesma validação: o dia em que alguém
    // acrescentar a query aqui, ou o pathname carregar algo inesperado, a
    // regra continua sendo uma só.
    url.searchParams.set("next", destinoDeRetorno(request.nextUrl.pathname));
    return NextResponse.redirect(url);
  }

  // Senha provisória: só a troca. O banco já não dá acesso a ela; o desvio é
  // para a pessoa não ver telas vazias sem entender por quê.
  if (user) {
    const desvio = desvioDaSenhaProvisoria(request.nextUrl.pathname, user.app_metadata);
    if (desvio === "recusar") {
      return NextResponse.json({ message: "Troque a senha provisória antes." }, { status: 403 });
    }
    if (desvio === "trocar") {
      const url = request.nextUrl.clone();
      url.pathname = CAMINHO_DA_TROCA;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
