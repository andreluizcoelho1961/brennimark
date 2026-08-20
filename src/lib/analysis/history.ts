import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StructuredAnalysis, AnalysisVerdict } from "@/lib/ai/analysis-result";
import { sanitizeStructuredAnalysis } from "@/lib/ai/analysis-result";

export type { AnalysisVerdict } from "@/lib/ai/analysis-result";

export const ANALYSIS_EVIDENCE_BUCKET = "analysis-evidence";

export type AnalysisAttempt = {
  provider: string;
  model: string;
  elapsedMs: number;
  status: "failed" | "completed";
};

export type AnalysisFeedback = "correct" | "partial" | "incorrect";

export type AnalysisRun = {
  id: string;
  workspaceId: string;
  parentRunId: string | null;
  fileName: string;
  imageMediaType: string;
  imageSizeBytes: number;
  imageUrl: string | null;
  question: string;
  verdict: AnalysisVerdict;
  analysis: StructuredAnalysis;
  provider: string;
  model: string;
  fallbackUsed: boolean;
  elapsedMs: number;
  attempts: AnalysisAttempt[];
  feedbackRating: AnalysisFeedback | null;
  feedbackNote: string | null;
  feedbackAt: string | null;
  calibrationEnabled: boolean;
  calibrationLabel: string | null;
  calibrationExpectedVerdict: Exclude<AnalysisVerdict, "unknown"> | null;
  createdAt: string;
  updatedAt: string;
};

type AnalysisRow = {
  id: string;
  workspace_id: string;
  parent_run_id: string | null;
  file_name: string;
  image_media_type: string;
  image_size_bytes: number;
  image_path: string | null;
  question: string;
  verdict: AnalysisVerdict;
  analysis: StructuredAnalysis;
  provider: string;
  model: string;
  fallback_used: boolean;
  elapsed_ms: number;
  attempts: AnalysisAttempt[];
  feedback_rating: AnalysisFeedback | null;
  feedback_note: string | null;
  feedback_at: string | null;
  calibration_enabled: boolean;
  calibration_label: string | null;
  calibration_expected_verdict: Exclude<AnalysisVerdict, "unknown"> | null;
  created_at: string;
  updated_at: string;
};

export const ANALYSIS_RUN_SELECT = [
  "id",
  "workspace_id",
  "parent_run_id",
  "file_name",
  "image_media_type",
  "image_size_bytes",
  "image_path",
  "question",
  "verdict",
  "analysis",
  "provider",
  "model",
  "fallback_used",
  "elapsed_ms",
  "attempts",
  "feedback_rating",
  "feedback_note",
  "feedback_at",
  "calibration_enabled",
  "calibration_label",
  "calibration_expected_verdict",
  "created_at",
  "updated_at",
].join(", ");

export function imageDataToBuffer(data: string) {
  return Buffer.from(data, "base64");
}

export function fingerprintImage(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function extensionFor(mediaType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return extensions[mediaType] ?? "img";
}

export function evidencePath(workspaceId: string, runId: string, mediaType: string) {
  return `${workspaceId}/${runId}/evidence.${extensionFor(mediaType)}`;
}

export function mapAnalysisRow(row: AnalysisRow, imageUrl: string | null = null): AnalysisRun {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    parentRunId: row.parent_run_id,
    fileName: row.file_name,
    imageMediaType: row.image_media_type,
    imageSizeBytes: row.image_size_bytes,
    imageUrl,
    question: row.question,
    verdict: row.verdict,
    analysis: sanitizeStructuredAnalysis(row.analysis),
    provider: row.provider,
    model: row.model,
    fallbackUsed: row.fallback_used,
    elapsedMs: row.elapsed_ms,
    attempts: row.attempts ?? [],
    feedbackRating: row.feedback_rating,
    feedbackNote: row.feedback_note,
    feedbackAt: row.feedback_at,
    calibrationEnabled: row.calibration_enabled,
    calibrationLabel: row.calibration_label,
    calibrationExpectedVerdict: row.calibration_expected_verdict,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createSignedEvidenceUrls(
  supabase: SupabaseClient,
  rows: AnalysisRow[],
  expiresIn = 3_600,
) {
  const paths = rows.map((row) => row.image_path).filter((path): path is string => Boolean(path));
  if (paths.length === 0) return new Map<string, string>();

  const { data, error } = await supabase.storage
    .from(ANALYSIS_EVIDENCE_BUCKET)
    .createSignedUrls(paths, expiresIn);
  if (error) throw error;

  const urls = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

export type { AnalysisRow };
