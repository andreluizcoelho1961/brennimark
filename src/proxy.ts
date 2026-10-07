import { type NextFetchEvent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest, evento: NextFetchEvent) {
  return updateSession(request, evento);
}

/**
 * `site/` é a pasta dos vídeos do site público (`public/site/`). Arquivo
 * estático não precisa de sessão, e sem a exceção o vídeo do Vini seria
 * redirecionado para o login de quem ainda não entrou.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|artwork|images|icons|site/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
