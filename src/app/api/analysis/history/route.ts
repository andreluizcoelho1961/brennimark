import { NextResponse } from "next/server";
import { contextoDoHistorico } from "@/lib/analysis/server";
import {
  ANALYSIS_RUN_SELECT,
  createSignedEvidenceUrls,
  mapAnalysisRow,
  type AnalysisRow,
} from "@/lib/analysis/history";

export async function GET(request: Request) {
  // O portão da utilidade junto com a autorização: sem `history` contratada na
  // marca, a rota responde 404 antes de tocar no banco (achado 4, 15/09/2026).
  const portao = await contextoDoHistorico(request);
  if (!portao.ok) return portao.resposta;
  const { context } = portao;

  const url = new URL(request.url);
  const requestedLimit = Number(url.searchParams.get("limit") ?? 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100;

  const { data, error } = await context.supabase
    .from("analysis_runs")
    .select(ANALYSIS_RUN_SELECT)
    .eq("workspace_id", context.workspaceId)
    .eq("brand_id", context.brandId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: "history_unavailable", message: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as AnalysisRow[];
  let signedUrls = new Map<string, string>();
  try {
    signedUrls = await createSignedEvidenceUrls(context.supabase, rows);
  } catch (signedUrlError) {
    console.error("[api/analysis/history] signed URLs", signedUrlError);
  }

  return NextResponse.json({
    runs: rows.map((row) => mapAnalysisRow(row, row.image_path ? (signedUrls.get(row.image_path) ?? null) : null)),
  });
}
