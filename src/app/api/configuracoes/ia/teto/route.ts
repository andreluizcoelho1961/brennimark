import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { workspaceDaRota } from "@/lib/brennimark/contexto-da-rota";
import { dolaresParaMicros } from "@/lib/ia-propria/teto";

/**
 * Configurações › IA › teto de gasto (ADR-0009, adendo de 08/11/2026).
 *
 * Na IA própria quem paga o modelo é a agência, então o limite em dólar é dela. A dona
 * escolhe um valor por dia e um por mês, ou nenhum (vazio = sem limite). O banco confere
 * que quem pede administra a conta, que o plano é "traga a sua" e que os valores fazem
 * sentido; esta rota só converte dólares em micros e traduz o motivo da recusa.
 */
const SEM_CACHE = { "Cache-Control": "private, no-store" };

export async function PUT(request: Request) {
  const r = await workspaceDaRota(request);
  if (!r.ok) return r.resposta;
  if (r.papel !== "owner") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });

  const corpo = (await request.json().catch(() => null)) as { diarioUsd?: unknown; mensalUsd?: unknown } | null;
  const diario = dolaresParaMicros(corpo?.diarioUsd);
  const mensal = dolaresParaMicros(corpo?.mensalUsd);
  if (diario === "invalido" || mensal === "invalido") {
    return NextResponse.json({ error: "teto_invalido" }, { status: 400, headers: SEM_CACHE });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("definir_teto_da_ia_propria", {
    p_workspace_id: r.workspaceId, p_diario_micros: diario, p_mensal_micros: mensal,
  });
  if (error?.hint === "teto_so_a_dona") return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  if (error?.hint === "teto_so_ia_propria") return NextResponse.json({ error: "modo_da_plataforma" }, { status: 409, headers: SEM_CACHE });
  if (error?.hint === "teto_invalido") return NextResponse.json({ error: "teto_invalido" }, { status: 400, headers: SEM_CACHE });
  if (error) return NextResponse.json({ message: "Não foi possível guardar o limite." }, { status: 500, headers: SEM_CACHE });
  return NextResponse.json({ ok: true }, { headers: SEM_CACHE });
}
