import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerMotivo } from "@/lib/console/ia";
import { chamadaDaAcaoDeCobranca, lerAcaoDeCobranca } from "@/lib/console/cobranca";
import { abrirCheckout } from "@/lib/cobranca/abrir-checkout";

/**
 * A cobrança no Console (fatia 2, 01/10/2026): planos, preços, assinaturas e
 * o link de pagamento do piloto.
 *
 * Quem pode decide o BANCO: as funções `console_*` recusam com 42501 quem não
 * é da equipe, e cada ação fica no registro com motivo. A rota traduz a
 * recusa em 404 — para quem não é da equipe, o Console não existe.
 */

const NAO_ENCONTRADO = () => NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
const RECUSA = (message: string) => NextResponse.json({ message }, { status: 400 });
const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("console_cobranca");
  if (error?.code === "42501") return NAO_ENCONTRADO();
  if (error) return NextResponse.json({ message: "Não foi possível ler a cobrança." }, { status: 500 });
  return NextResponse.json(data, SEM_CACHE);
}

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const lida = lerAcaoDeCobranca(corpo);
  if (!lida.ok) return RECUSA(lida.motivo);
  const supabase = await createClient();

  // O link de piloto: a equipe gera, o cliente paga, a conta nasce do webhook.
  if (lida.acao.tipo === "link_de_piloto") {
    const { data: daEquipe } = await supabase.rpc("sou_da_equipe_brennimark");
    if (daEquipe !== true) return NAO_ENCONTRADO();
    const abertura = await abrirCheckout(lida.acao.pedido, new URL(request.url).origin, { piloto: true });
    if (!abertura.ok) return NextResponse.json({ message: abertura.motivo }, { status: abertura.status });
    return NextResponse.json({ url: abertura.url }, SEM_CACHE);
  }

  const motivo = lerMotivo(corpo?.motivo);
  if (!motivo) return RECUSA("Escreva o motivo (de 3 a 500 caracteres): ele fica no registro.");
  const { funcao, parametros } = chamadaDaAcaoDeCobranca(lida.acao, motivo);
  const { error } = await supabase.rpc(funcao, parametros);
  if (error?.code === "42501") return NAO_ENCONTRADO();
  if (error?.code === "P0002") return NextResponse.json({ message: "Preço não encontrado ou já inativo." }, { status: 404 });
  if (error?.code === "23503") return RECUSA("Esse plano não existe.");
  if (error?.code === "23505") return RECUSA("Esse preço do Stripe já está registrado.");
  if (error?.code === "23514" || error?.code === "22023") return RECUSA("Confira os valores: algum está fora do permitido.");
  if (error) return NextResponse.json({ message: "Não foi possível guardar a mudança." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
