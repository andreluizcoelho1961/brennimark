import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { diaDeReferencia, intervaloDoMes } from "@/lib/console/custos";

/**
 * O painel de custos do Console da Brennimark — etapa 1 (28/09/2026).
 *
 * Quem pode ver decide o BANCO: as funções `console_*` recusam com 42501
 * quem não está na equipe (`private.equipe_brennimark`). A rota traduz a
 * recusa em 404 — para quem não é da equipe, o Console não existe.
 *
 * Lê pela SESSÃO, nunca pela chave de serviço: a leitura entre contas é
 * exatamente o que precisa passar pela conferência de equipe.
 */
export async function GET(request: Request) {
  const { mes, inicio, fim } = intervaloDoMes(new URL(request.url).searchParams.get("mes"));
  const supabase = await createClient();

  const [ia, armazenamento, limites] = await Promise.all([
    supabase.rpc("console_custos_de_ia", { p_inicio: inicio, p_fim: fim }),
    supabase.rpc("console_armazenamento", { p_ate: diaDeReferencia(mes) }),
    supabase.rpc("console_limites"),
  ]);

  const recusa = [ia, armazenamento, limites].find((r) => r.error?.code === "42501");
  if (recusa) return NextResponse.json({ error: "nao_encontrado" }, { status: 404 });
  const falha = [ia, armazenamento, limites].find((r) => r.error);
  if (falha) return NextResponse.json({ message: "Não foi possível ler os custos." }, { status: 500 });

  return NextResponse.json(
    { mes, ia: ia.data ?? [], armazenamento: armazenamento.data ?? [], limites: limites.data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
