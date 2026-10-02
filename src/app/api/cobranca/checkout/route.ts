import { NextResponse } from "next/server";
import { abrirCheckout } from "@/lib/cobranca/abrir-checkout";
import { lerPedidoDeCompra } from "@/lib/cobranca/compra";
import {
  CAMINHO_DO_COOKIE, COOKIE_DA_PROVA, PRAZO_DA_SENHA_NA_VOLTA_HORAS, gerarProva, resumoDaProva,
} from "@/lib/cobranca/senha-na-volta";

/**
 * A compra pelo site (cobrança, fatia 2): quem quer assinar ainda não tem
 * conta, então esta rota passa pelo `proxy` sem sessão (caminho exato em
 * `caminhos-publicos.ts`).
 *
 * Passar sem sessão é seguro aqui porque a rota não dá nada: ela só abre uma
 * página de pagamento do Stripe. A conta nasce do webhook assinado, depois do
 * pagamento — nunca daqui. O preço sai do banco, nunca do pedido.
 *
 * Ela também entrega a PROVA DO NAVEGADOR (02/10/2026): o segredo vai num
 * cookie que só o servidor lê, e o Stripe guarda só o resumo dele. É o que
 * permite a este navegador, e a nenhum outro, criar a senha na volta do
 * pagamento (`senha-na-volta.ts`).
 */
export async function POST(request: Request) {
  const lido = lerPedidoDeCompra(await request.json().catch(() => null));
  if (!lido.ok) return NextResponse.json({ message: lido.motivo }, { status: 400 });

  const prova = gerarProva();
  const abertura = await abrirCheckout(lido.valor, new URL(request.url).origin, {
    piloto: false, resumoDaProva: await resumoDaProva(prova),
  });
  if (!abertura.ok) return NextResponse.json({ message: abertura.motivo }, { status: abertura.status });

  const resposta = NextResponse.json({ url: abertura.url }, { headers: { "Cache-Control": "no-store" } });
  resposta.cookies.set(COOKIE_DA_PROVA, prova, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: CAMINHO_DO_COOKIE,
    maxAge: PRAZO_DA_SENHA_NA_VOLTA_HORAS * 3600,
  });
  return resposta;
}
