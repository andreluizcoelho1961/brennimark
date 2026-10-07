import { DESTINO_PADRAO, destinoDeRetorno } from "@/platform/destino-de-retorno";
import { CAMINHO_DA_TROCA, desvioDaSenhaProvisoria } from "@/lib/acesso/senha-provisoria";
import { caminhoPublico } from "@/lib/supabase/caminhos-publicos";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { COOKIE_DO_ACESSO, ipDoPedido, marcaDoAcesso, precisaRegistrar } from "@/lib/conformidade/registro-de-acesso";
import { createServiceClient } from "@/lib/supabase/service";

export async function updateSession(request: NextRequest, evento?: NextFetchEvent) {
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

  // Registro de acesso do Marco Civil: no máximo uma linha por pessoa, por
  // hora e por IP (`registro-de-acesso.ts`). Grava em segundo plano
  // (`waitUntil`), com a chave de serviço — a sessão não escreve nessa tabela
  // — e nunca atrasa nem derruba a página: erro vai ao log.
  let marcaNova: string | null = null;
  const ip = user ? ipDoPedido(request.headers) : null;
  if (user && ip && evento) {
    const marca = marcaDoAcesso(ip, Date.now());
    if (precisaRegistrar(request.cookies.get(COOKIE_DO_ACESSO)?.value, marca)) {
      marcaNova = marca;
      evento.waitUntil((async () => {
        try {
          const { error } = await createServiceClient().from("registros_de_acesso").insert({ user_id: user.id, ip });
          if (error) console.error(JSON.stringify({ level: "error", msg: "registro_de_acesso_falhou", code: error.code ?? "unknown" }));
        } catch {
          console.error(JSON.stringify({ level: "error", msg: "registro_de_acesso_sem_chave" }));
        }
      })());
    }
  }
  const marcar = (resposta: NextResponse) => {
    if (marcaNova) resposta.cookies.set(COOKIE_DO_ACESSO, marcaNova, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 3600 });
    return resposta;
  };

  const isPublicPath = caminhoPublico(request.nextUrl.pathname);

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Mesmo vindo de dentro, passa pela mesma validação: o dia em que alguém
    // acrescentar a query aqui, ou o pathname carregar algo inesperado, a
    // regra continua sendo uma só.
    url.searchParams.set("next", destinoDeRetorno(request.nextUrl.pathname));
    return marcar(NextResponse.redirect(url));
  }

  // Senha provisória: só a troca. O banco já não dá acesso a ela; o desvio é
  // para a pessoa não ver telas vazias sem entender por quê.
  if (user) {
    const desvio = desvioDaSenhaProvisoria(request.nextUrl.pathname, user.app_metadata);
    if (desvio === "recusar") {
      return marcar(NextResponse.json({ message: "Troque a senha provisória antes." }, { status: 403 }));
    }
    if (desvio === "trocar") {
      const url = request.nextUrl.clone();
      url.pathname = CAMINHO_DA_TROCA;
      url.search = "";
      return marcar(NextResponse.redirect(url));
    }
  }

  // A home é o site, para quem ainda não entrou. Quem já entrou vai direto ao
  // produto, como era antes de o site existir — e todo link interno que aponta
  // para "/" continua levando à plataforma.
  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = DESTINO_PADRAO;
    url.search = "";
    return marcar(NextResponse.redirect(url));
  }

  // Direto ao produto: "/" agora é o site, e mandar para lá seria um salto a mais.
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = DESTINO_PADRAO;
    url.search = "";
    return marcar(NextResponse.redirect(url));
  }

  return marcar(response);
}
