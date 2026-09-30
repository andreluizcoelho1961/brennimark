import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { lerMotivo } from "@/lib/console/ia";
import { chamadaDaAcao, lerAcaoDeOperacao } from "@/lib/console/operacao";

/**
 * A operação no Console — etapa 3 (30/09/2026): pausar e retomar o Vini
 * (plataforma, conta, marca) e a ficha da conta.
 *
 * Quem pode decide o BANCO: as funções `console_*` recusam com 42501 quem não
 * é da equipe, e cada ação fica no registro com motivo. A rota traduz a
 * recusa em 404 — para quem não é da equipe, o Console não existe.
 */

const NAO_ENCONTRADO = () => NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
const RECUSA = (message: string) => NextResponse.json({ message }, { status: 400 });
const SEM_CACHE = { headers: { "Cache-Control": "private, no-store" } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createClient();
  const conta = new URL(request.url).searchParams.get("conta");

  // A ficha de uma conta.
  if (conta !== null) {
    if (!UUID.test(conta)) return RECUSA("Conta inválida.");
    const ficha = await supabase.rpc("console_ficha_da_conta", { p_workspace_id: conta });
    if (ficha.error?.code === "42501") return NAO_ENCONTRADO();
    if (ficha.error?.code === "P0002") return NextResponse.json({ message: "Conta não encontrada." }, { status: 404 });
    if (ficha.error) return NextResponse.json({ message: "Não foi possível ler a ficha da conta." }, { status: 500 });
    return NextResponse.json(ficha.data, SEM_CACHE);
  }

  // O painel: a trava geral e a lista de contas.
  const [ia, contas] = await Promise.all([supabase.rpc("console_ia_da_plataforma"), supabase.rpc("console_contas")]);
  if ([ia, contas].some((r) => r.error?.code === "42501")) return NAO_ENCONTRADO();
  if ([ia, contas].some((r) => r.error)) return NextResponse.json({ message: "Não foi possível ler a operação." }, { status: 500 });
  const parametros = (ia.data as { parametros?: { vini_pausado?: boolean } } | null)?.parametros;
  return NextResponse.json({ plataformaPausada: parametros?.vini_pausado === true, contas: contas.data ?? [] }, SEM_CACHE);
}

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const motivo = lerMotivo(corpo?.motivo);
  if (!motivo) return RECUSA("Escreva o motivo (de 3 a 500 caracteres): ele fica no registro.");
  const lida = lerAcaoDeOperacao(corpo);
  if (!lida.ok) return RECUSA(lida.motivo);

  const supabase = await createClient();
  const { funcao, parametros } = chamadaDaAcao(lida.acao, motivo);
  const { error } = await supabase.rpc(funcao, parametros);
  if (error?.code === "42501") return NAO_ENCONTRADO();
  if (error?.code === "P0002") return NextResponse.json({ message: "Conta ou marca não encontrada." }, { status: 404 });
  if (error) return NextResponse.json({ message: "Não foi possível guardar a mudança." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
