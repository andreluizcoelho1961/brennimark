import { NextResponse } from "next/server";
import { getAnalysisAuthContext } from "@/lib/analysis/server";
import { alvoDaRota } from "@/lib/brandville/contexto-da-rota";
import {
  ANALYSIS_EVIDENCE_BUCKET,
  ANALYSIS_RUN_SELECT,
  createSignedEvidenceUrls,
  mapAnalysisRow,
  type AnalysisFeedback,
  type AnalysisRow,
} from "@/lib/analysis/history";

const FEEDBACK_VALUES: AnalysisFeedback[] = ["correct", "partial", "incorrect"];
const EXPECTED_VERDICTS = ["aligned", "partially_aligned", "misaligned"] as const;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAnalysisAuthContext(alvoDaRota(request));
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data, error } = await context.supabase
    .from("analysis_runs")
    .select(ANALYSIS_RUN_SELECT)
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .eq("brand_id", context.brandId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "history_unavailable", message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const row = data as unknown as AnalysisRow;
  const urls = await createSignedEvidenceUrls(context.supabase, [row]).catch(() => new Map<string, string>());
  return NextResponse.json({ run: mapAnalysisRow(row, row.image_path ? (urls.get(row.image_path) ?? null) : null) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAnalysisAuthContext(alvoDaRota(request));
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("feedbackRating" in body) {
    if (body.feedbackRating === null) {
      update.feedback_rating = null;
      update.feedback_note = null;
      update.feedback_by = null;
      update.feedback_at = null;
    } else if (FEEDBACK_VALUES.includes(body.feedbackRating)) {
      update.feedback_rating = body.feedbackRating;
      update.feedback_note = typeof body.feedbackNote === "string" ? body.feedbackNote.trim().slice(0, 2_000) || null : null;
      update.feedback_by = context.user.id;
      update.feedback_at = new Date().toISOString();
    } else {
      return NextResponse.json({ error: "invalid_feedback" }, { status: 400 });
    }
  }

  if ("calibrationEnabled" in body) {
    if (typeof body.calibrationEnabled !== "boolean") {
      return NextResponse.json({ error: "invalid_calibration" }, { status: 400 });
    }
    if (body.calibrationEnabled) {
      if (!EXPECTED_VERDICTS.includes(body.calibrationExpectedVerdict)) {
        return NextResponse.json({ error: "expected_verdict_required" }, { status: 400 });
      }
      update.calibration_enabled = true;
      update.calibration_expected_verdict = body.calibrationExpectedVerdict;
      update.calibration_label = typeof body.calibrationLabel === "string"
        ? body.calibrationLabel.trim().slice(0, 120) || null
        : null;
    } else {
      update.calibration_enabled = false;
      update.calibration_expected_verdict = null;
      update.calibration_label = null;
    }
  }

  if (Object.keys(update).length === 1) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });

  const { data, error } = await context.supabase
    .from("analysis_runs")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .eq("brand_id", context.brandId)
    .select(ANALYSIS_RUN_SELECT)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "update_failed", message: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const row = data as unknown as AnalysisRow;
  const urls = await createSignedEvidenceUrls(context.supabase, [row]).catch(() => new Map<string, string>());
  return NextResponse.json({ run: mapAnalysisRow(row, row.image_path ? (urls.get(row.image_path) ?? null) : null) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAnalysisAuthContext(alvoDaRota(request));
  if (!context) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data } = await context.supabase
    .from("analysis_runs")
    .select("image_path")
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .eq("brand_id", context.brandId)
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (data.image_path) {
    const { error: storageError } = await context.supabase.storage
      .from(ANALYSIS_EVIDENCE_BUCKET)
      .remove([data.image_path]);
    if (storageError) return NextResponse.json({ error: "evidence_delete_failed", message: storageError.message }, { status: 500 });
  }

  const { error } = await context.supabase
    .from("analysis_runs")
    .delete()
    .eq("id", id)
    .eq("workspace_id", context.workspaceId)
    .eq("brand_id", context.brandId);
  if (error) return NextResponse.json({ error: "delete_failed", message: error.message }, { status: 500 });
  return new Response(null, { status: 204 });
}
