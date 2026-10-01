import { NextResponse } from "next/server";
import { abrirCheckout } from "@/lib/cobranca/abrir-checkout";
import { lerPedidoDeCompra } from "@/lib/cobranca/compra";

/**
 * A compra pelo site (cobrança, fatia 2): quem quer assinar ainda não tem
 * conta, então esta rota passa pelo `proxy` sem sessão (caminho exato em
 * `caminhos-publicos.ts`).
 *
 * Passar sem sessão é seguro aqui porque a rota não dá nada: ela só abre uma
 * página de pagamento do Stripe. A conta nasce do webhook assinado, depois do
 * pagamento — nunca daqui. O preço sai do banco, nunca do pedido.
 */
export async function POST(request: Request) {
  const lido = lerPedidoDeCompra(await request.json().catch(() => null));
  if (!lido.ok) return NextResponse.json({ message: lido.motivo }, { status: 400 });

  const abertura = await abrirCheckout(lido.valor, new URL(request.url).origin, { piloto: false });
  if (!abertura.ok) return NextResponse.json({ message: abertura.motivo }, { status: abertura.status });
  return NextResponse.json({ url: abertura.url }, { headers: { "Cache-Control": "no-store" } });
}
