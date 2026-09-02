import { NextResponse } from "next/server";
import { getAnalysisAuthContext } from "@/lib/analysis/server";
import { alvoDaRota } from "@/lib/brandville/contexto-da-rota";
import {
  ANALYSIS_RUN_SELECT,
  createSignedEvidenceUrls,
  mapAnalysisRow,
  type AnalysisRow,
} from "@/lib/analysis/history";

export async function GET(request: Request) {
  const context = await getAnalysisAuthContext(alvoDaRota(request));
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
