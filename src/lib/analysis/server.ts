import { NextResponse } from "next/server";
import { portaoDeIA } from "@/lib/brennimark/contexto-da-rota";
import type { ActiveBrand } from "@/lib/brennimark/brand-row";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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
  /** A marca da requisição. Sem ela a análise pertencia à CONTA, e o histórico
   *  de quatro marcas era um só. */
  brandId: string;
};

/**
 * O contexto do HISTÓRICO, com o portão da utilidade aplicado.
 *
 * `getAnalysisAuthContext` resolve sessão, conta e marca — e só isso. A tela do
 * histórico já exigia `podeUsar(..., "history")` no layout, mas as rotas não:
 * quem chamasse `/api/analysis/history*` direto recebia JSON, URLs assinadas e
 * PDF numa marca que não contratou a utilidade. Achado 4 do Codex Security
 * (15/09/2026).
 *
 * O portão vive em `portaoDeIA`, que é o mesmo que a rota de análise usa — um
 * lugar só decide, e a ordem "não contratada antes de sem papel" (que evita
 * revelar o que a marca contratou pela diferença entre 403 e 404) vem junto.
 *
 * Devolve o mesmo formato que o resto das rotas de histórico já esperava, para
 * o corpo delas não mudar.
 */
export async function contextoDoHistorico(
  request: Request,
): Promise<
  | { ok: true; context: AnalysisAuthContext; brand: ActiveBrand }
  | { ok: false; resposta: NextResponse }
> {
  const portao = await portaoDeIA(request, "history");
  if (!portao.ok) return { ok: false, resposta: portao.resposta };

  return {
    ok: true,
    brand: portao.brand,
    context: {
      supabase: portao.auth.supabase,
      user: portao.auth.user,
      workspaceId: portao.auth.workspaceId,
      brandId: portao.brand.id,
    },
  };
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
      brand_id: context.brandId,
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

  const path = evidencePath(context.workspaceId, context.brandId, inserted.id, input.imageMediaType);
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
    .eq("workspace_id", context.workspaceId)
    .eq("brand_id", context.brandId);

  if (updateError) {
    await context.supabase.storage.from(ANALYSIS_EVIDENCE_BUCKET).remove([path]);
    return { id: inserted.id as string, imageSaved: false, imageError: updateError.message };
  }

  return { id: inserted.id as string, imageSaved: true, imageError: null };
}
