import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chavesPresentes, VARIAVEL_DA_CHAVE } from "@/lib/ai/chaves-da-plataforma";
import { dolaresEmMicros, lerMotivo, lerRotas, modelosOferecidos } from "@/lib/console/ia";

/**
 * A IA da plataforma no Console — etapa 2 (29/09/2026).
 *
 * Quem pode decide o BANCO: as funções `console_*` recusam com 42501 quem não
 * é da equipe, e cada mudança fica no registro com motivo. A rota traduz a
 * recusa em 404 (para quem não é da equipe, o Console não existe) e confere
 * contra o CATÁLOGO o que o banco não conhece: preço verificado e visão.
 *
 * As chaves: só SE existem, nunca o valor.
 */

const NAO_ENCONTRADO = () => NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
const RECUSA = (message: string) => NextResponse.json({ message }, { status: 400 });

export async function GET() {
  const supabase = await createClient();
  const [ia, limites, registro] = await Promise.all([
    supabase.rpc("console_ia_da_plataforma"),
    supabase.rpc("console_limites"),
    supabase.rpc("console_registro_da_equipe", { p_limite: 50 }),
  ]);
  if ([ia, limites, registro].some((r) => r.error?.code === "42501")) return NAO_ENCONTRADO();
  if ([ia, limites, registro].some((r) => r.error)) {
    return NextResponse.json({ message: "Não foi possível ler a IA da plataforma." }, { status: 500 });
  }
  const oferta = (tarefa: "chat" | "analysis") =>
    modelosOferecidos(tarefa).map((m) => ({ provider: m.provider, model: m.model, label: m.label }));
  return NextResponse.json(
    {
      ...(ia.data as object),
      limites: limites.data ?? [],
      registro: registro.data ?? [],
      oferta: { chat: oferta("chat"), analysis: oferta("analysis") },
      chaves: Object.entries(chavesPresentes()).map(([provider, presente]) => ({
        provider, variavel: VARIAVEL_DA_CHAVE[provider as keyof typeof VARIAVEL_DA_CHAVE], presente,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const motivo = lerMotivo(corpo?.motivo);
  if (!motivo) return RECUSA("Escreva o motivo da mudança (de 3 a 500 caracteres): ele fica no registro.");
  const supabase = await createClient();

  let resultado: { error: { code?: string; message: string } | null };
  if (corpo?.acao === "rotas") {
    const lidas = lerRotas(corpo?.tarefa, corpo?.rotas, corpo?.esperaMs);
    if (!lidas.ok) return RECUSA(lidas.motivo);
    resultado = await supabase.rpc("console_definir_rotas", {
      p_tarefa: corpo.tarefa, p_rotas: lidas.rotas, p_espera_ms: lidas.esperaMs, p_motivo: motivo,
    });
  } else if (corpo?.acao === "limite") {
    const micros = dolaresEmMicros(corpo?.valor);
    const periodo = corpo?.periodo === "monthly" ? "monthly" : corpo?.periodo === "daily" ? "daily" : null;
    if (micros === null || !periodo || typeof corpo?.workspaceId !== "string") return RECUSA("Valor em dólares, por dia ou por mês.");
    resultado = await supabase.rpc("console_definir_limite", {
      p_workspace_id: corpo.workspaceId, p_periodo: periodo, p_limite_micros: micros, p_motivo: motivo,
    });
  } else if (corpo?.acao === "padrao") {
    const diario = dolaresEmMicros(corpo?.diario);
    const mensal = dolaresEmMicros(corpo?.mensal);
    if (diario === null || mensal === null) return RECUSA("Valores em dólares, por dia e por mês.");
    resultado = await supabase.rpc("console_definir_limites_padrao", { p_diario_micros: diario, p_mensal_micros: mensal, p_motivo: motivo });
  } else {
    return RECUSA("Ação desconhecida.");
  }

  if (resultado.error?.code === "42501") return NAO_ENCONTRADO();
  if (resultado.error) return NextResponse.json({ message: "Não foi possível guardar a mudança." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
