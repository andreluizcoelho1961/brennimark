import { resolverWorkspaceAtivo } from "@/lib/brandville/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  ANALYSIS_EVIDENCE_BUCKET,
  evidencePath,
  fingerprintImage,
  imageDataToBuffer,
  type AnalysisAttempt,
} from "@/lib/analysis/history";
import type { AnalysisVerdict, StructuredAnalysis } from "@/lib/ai/analysis-result";

export type AnalysisAuthContext = {
  supabase: SupabaseClient;
  user: User;
  workspaceId: string;
};

/**
 * Sessão e workspace para as rotas de análise.
 *
 * O `.limit(1)` que estava aqui gravava o histórico de análise da pessoa no
 * primeiro workspace que o banco devolvesse. Agora usa a mesma resolução do
 * resto: o pedido, o único, ou nenhum — nunca "o primeiro".
 */
export async function getAnalysisAuthContext(
  workspaceSlug?: string,
): Promise<AnalysisAuthContext | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const r = await resolverWorkspaceAtivo(workspaceSlug);
  if (r.tipo !== "workspace") return null;

  return { supabase, user, workspaceId: r.workspace.id };
}

export async function persistAnalysisRun(input: {
  context: AnalysisAuthContext;
  parentRunId?: string | null;
  fileName: string;
  imageMediaType: string;
  imageData: string;
  question: string;
  verdict: AnalysisVerdict;
  analysis: StructuredAnalysis;
  provider: string;
  model: string;
  fallbackUsed: boolean;
  elapsedMs: number;
  attempts: AnalysisAttempt[];
}) {
  const { context } = input;
  const imageBuffer = imageDataToBuffer(input.imageData);
  const { data: inserted, error: insertError } = await context.supabase
    .from("analysis_runs")
    .insert({
      workspace_id: context.workspaceId,
      created_by: context.user.id,
      parent_run_id: input.parentRunId ?? null,
      file_name: input.fileName.slice(0, 240),
      image_media_type: input.imageMediaType,
      image_size_bytes: imageBuffer.byteLength,
      image_fingerprint: fingerprintImage(imageBuffer),
      question: input.question.slice(0, 2_000),
      verdict: input.verdict,
      analysis: input.analysis,
      provider: input.provider,
      model: input.model,
      fallback_used: input.fallbackUsed,
      elapsed_ms: input.elapsedMs,
      attempts: input.attempts,
    })
    .select("id")
    .single();

  if (insertError) throw insertError;

  const path = evidencePath(context.workspaceId, inserted.id, input.imageMediaType);
  const { error: uploadError } = await context.supabase.storage
    .from(ANALYSIS_EVIDENCE_BUCKET)
    .upload(path, imageBuffer, {
      contentType: input.imageMediaType,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    return { id: inserted.id as string, imageSaved: false, imageError: uploadError.message };
  }

  const { error: updateError } = await context.supabase
    .from("analysis_runs")
    .update({ image_path: path, updated_at: new Date().toISOString() })
    .eq("id", inserted.id)
    .eq("workspace_id", context.workspaceId);

  if (updateError) {
    await context.supabase.storage.from(ANALYSIS_EVIDENCE_BUCKET).remove([path]);
    return { id: inserted.id as string, imageSaved: false, imageError: updateError.message };
  }

  return { id: inserted.id as string, imageSaved: true, imageError: null };
}
