import { NextResponse } from "next/server";
import { COOKIE_DE_IDIOMA, isProductLocale } from "@/platform/locale";

/**
 * A ponte do site para a porta do tour (02/11/2026).
 *
 * O formulário do tour mora na plataforma, onde o idioma vem do cookie, do perfil e do navegador, e
 * não do endereço do site. Quem lia o site em português e tinha o navegador em inglês caía no tour em
 * inglês, com o manual em inglês. Os botões "Fazer um tour" do site passam por aqui: gravam o idioma
 * em que a pessoa estava lendo (o mesmo cookie do botão EN/PT) e seguem para a porta.
 *
 * Passa pelo `proxy` sem sessão (caminho exato em `caminhos-publicos.ts`). Só grava um cookie de
 * idioma e só redireciona para um destino fixo: não há destino vindo do pedido, então não é redirecionador aberto.
 */
export async function GET(request: Request) {
  const pedido = new URL(request.url).searchParams.get("l");
  const idioma = isProductLocale(pedido) ? pedido : "pt-BR";
  const resposta = NextResponse.redirect(new URL("/demonstracao", request.url), 303);
  resposta.headers.set("Cache-Control", "no-store");
  resposta.cookies.set(COOKIE_DE_IDIOMA, idioma, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  return resposta;
}
