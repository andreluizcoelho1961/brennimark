import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";
import { autenticacaoDaRota } from "@/lib/brennimark/contexto-da-rota";
import {
  diaDeReferencia, inicioUtc, intervaloDoMes, resumoDoConsumo,
  type ArmazenamentoDaMarca, type ExecucaoDoMes, type GastoDoRazao, type Orcamento,
} from "@/lib/configuracoes/consumo";

const isEnglish = inEnglish(PRODUCT_LOCALE);

/**
 * Configurações › Consumo da CONTA (30/09/2026).
 *
 * Lê com a sessão de quem pede, sem chave de serviço: quem vê o quê decide o
 * banco. `ai_ledger`, `ai_budgets` e `consumo_de_armazenamento` só entregam as
 * linhas da conta a quem a administra. O portão de papel aqui só evita mostrar
 * "zero" a quem não administra — para essa pessoa, o banco já não entrega nada.
 *
 * A resposta leva uso e percentual, nunca dinheiro (`lib/configuracoes/consumo.ts`).
 */

/** O PostgREST entrega no máximo 1.000 linhas por pedido: lê em páginas. */
const PAGINA = 1000;

type Pagina<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>;

async function tudo<T>(pagina: (inicio: number, fim: number) => Pagina<T>): Promise<T[] | null> {
  const linhas: T[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await pagina(inicio, inicio + PAGINA - 1);
    if (error) return null;
    linhas.push(...(data ?? []));
    if (!data || data.length < PAGINA) return linhas;
  }
}

async function fotografia(supabase: SupabaseClient, workspaceId: string, ate: string) {
  // A fotografia diária mais recente até o dia de referência do mês.
  const { data, error } = await supabase
    .from("consumo_de_armazenamento")
    .select("dia")
    .eq("workspace_id", workspaceId)
    .lte("dia", ate)
    .order("dia", { ascending: false })
    .limit(1);
  if (error) return null;
  const dia: string | null = data?.[0]?.dia ?? null;
  if (!dia) return { dia: null, linhas: [] as ArmazenamentoDaMarca[] };
  const linhas = await tudo<ArmazenamentoDaMarca>((i, f) => supabase
    .from("consumo_de_armazenamento")
    .select("brand_id, bucket_id, bytes")
    .eq("workspace_id", workspaceId)
    .eq("dia", dia)
    .order("bucket_id")
    .order("brand_id")
    .range(i, f));
  return linhas ? { dia, linhas } : null;
}

export async function GET(request: Request) {
  const resolvido = await autenticacaoDaRota(request);
  if (!resolvido.ok) return resolvido.resposta;
  const { supabase, workspaceId, role } = resolvido.contexto;
  if (role !== "owner") {
    return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  }

  const { mes, inicio, fim } = intervaloDoMes(new URL(request.url).searchParams.get("mes"));
  const agora = new Date();
  const desdeUtc = inicioUtc(agora).mes;

  const [marcas, execucoes, gasto, orcamentos, armazenamento] = await Promise.all([
    supabase.from("brands").select("id, name").eq("workspace_id", workspaceId),
    tudo<ExecucaoDoMes>((i, f) => supabase
      .from("ai_ledger")
      .select("brand_id, task")
      .eq("workspace_id", workspaceId)
      .eq("status", "settled")
      .gte("created_at", inicio)
      .lt("created_at", fim)
      .order("id")
      .range(i, f)),
    // O teto é sempre o de AGORA, qualquer que seja o mês escolhido.
    tudo<GastoDoRazao>((i, f) => supabase
      .from("ai_ledger")
      .select("status, reserved_micros, settled_micros, created_at")
      .eq("workspace_id", workspaceId)
      .in("status", ["reserved", "settled"])
      .gte("created_at", desdeUtc)
      .order("id")
      .range(i, f)),
    supabase.from("ai_budgets").select("brand_id, period, limit_micros, kill_switch").eq("workspace_id", workspaceId),
    fotografia(supabase, workspaceId, diaDeReferencia(mes, agora)),
  ]);

  if (marcas.error || !execucoes || !gasto || orcamentos.error || !armazenamento) {
    console.error(JSON.stringify({ level: "error", msg: "consumo_indisponivel", workspaceId }));
    return NextResponse.json(
      { message: isEnglish ? "Couldn't load the usage." : "Não foi possível carregar o consumo." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const consumo = resumoDoConsumo({
    mes,
    marcas: (marcas.data ?? []).map((m: { id: string; name: string }) => ({ id: m.id, nome: m.name })),
    execucoes,
    gasto: gasto.map((g) => ({ ...g, reserved_micros: Number(g.reserved_micros), settled_micros: g.settled_micros === null ? null : Number(g.settled_micros) })),
    armazenamento: armazenamento.linhas.map((a) => ({ ...a, bytes: Number(a.bytes) })),
    orcamentos: (orcamentos.data ?? []).map((o: Orcamento) => ({ ...o, limit_micros: o.limit_micros === null ? null : Number(o.limit_micros) })),
    fotografia: armazenamento.dia,
    agora,
    semMarca: isEnglish ? "No brand" : "Sem marca",
    marcaApagada: isEnglish ? "Deleted brand" : "Marca apagada",
  });

  return NextResponse.json(consumo, { headers: { "Cache-Control": "private, no-store" } });
}
