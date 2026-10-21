import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { tokenDeSaidaValido } from "@/lib/cadastro/saida";
import { ehSaidaEmUmClique } from "@/lib/email/marketing";

/**
 * A saída da lista em UM clique (22/10/2026, RFC 8058): o botão "Cancelar
 * inscrição" que o Gmail, o iCloud e o Yahoo mostram ao lado do remetente. O
 * cabeçalho `List-Unsubscribe` de todo e-mail de marketing aponta para cá, e o
 * provedor faz um POST com o corpo `List-Unsubscribe=One-Click`, sem sessão e
 * sem abrir página.
 *
 * Só PARA de receber (`descadastrar_cadastro`); apagar o cadastro continua
 * sendo um passo consciente da página `/sair/<token>`. Passa pelo `proxy` sem
 * sessão (prefixo `/api/sair/` em `caminhos-publicos.ts`): quem recebe o e-mail
 * não tem conta, e a autorização é o token, que o BANCO confere.
 *
 * O endereço fica fora de `/api/cadastro` de propósito: a regra de limite do
 * Firewall (20 pedidos por 10 minutos por IP) pegaria os provedores de e-mail,
 * que mandam muitos cliques do mesmo endereço.
 *
 * GET não age: antivírus e pré-visualizadores abrem todo link. Ele só leva à
 * página, onde a pessoa escolhe.
 */
const SEM_CACHE = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenDeSaidaValido(token)) return new NextResponse(null, { status: 404, headers: SEM_CACHE });
  return NextResponse.redirect(new URL(`/sair/${token.toLowerCase()}`, request.url), { status: 303, headers: SEM_CACHE });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!tokenDeSaidaValido(token)) return new NextResponse(null, { status: 404, headers: SEM_CACHE });

  const corpo = (await request.text()).slice(0, 200);
  if (!ehSaidaEmUmClique(corpo)) return new NextResponse(null, { status: 400, headers: SEM_CACHE });

  let servico;
  try { servico = createServiceClient(); } catch {
    console.error(JSON.stringify({ level: "error", msg: "saida_um_clique_sem_chave" }));
    return new NextResponse(null, { status: 503, headers: SEM_CACHE });
  }
  const { error } = await servico.rpc("descadastrar_cadastro", { p_token: token.toLowerCase() });
  if (error) {
    console.error(JSON.stringify({ level: "error", msg: "saida_um_clique_falhou", code: error.code ?? "unknown" }));
    return new NextResponse(null, { status: 500, headers: SEM_CACHE });
  }
  // 200 exista o token ou não: o provedor só precisa saber que o pedido foi aceito.
  return new NextResponse(null, { status: 200, headers: SEM_CACHE });
}
