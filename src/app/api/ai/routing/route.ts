import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ROUTING_TIMEOUT_MS,
  listRoutingPolicies,
  roleCoversFeature,
} from "@/lib/ai/settings";
import type { AIProvider, AIRole, AIRoutingFeature } from "@/lib/ai/provider";
import { donoDaRota } from "@/lib/brennimark/contexto-da-rota";

const FEATURES = new Set<AIRoutingFeature>(["chat", "analysis"]);
const MIN_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 60_000;

export async function GET(request: Request) {
  const contexto = await donoDaRota(request);
  // Sem sessão devolve a política padrão, não editável. Ambiguidade e
  // não-encontrado sobem como estão: fingir "padrão" esconderia que existe
  // política configurada — na outra conta.
  if (!contexto.ok) {
    if (contexto.resposta.status !== 401) return contexto.resposta;
    return NextResponse.json({
      editable: false,
      policies: (["chat", "analysis"] as const).map((feature) => ({
        feature,
        primarySettingId: null,
        fallbackSettingId: null,
        firstChunkTimeoutMs: DEFAULT_ROUTING_TIMEOUT_MS[feature],
        allowCrossProvider: false,
      })),
    });
  }

  return NextResponse.json({
    editable: true,
    policies: await listRoutingPolicies(contexto.workspaceId),
  });
}

export async function PUT(request: Request) {
  const contexto = await donoDaRota(request);
  if (!contexto.ok) return contexto.resposta;
  const workspaceId = contexto.workspaceId;

  const body = await request.json().catch(() => null);
  const feature = body?.feature as AIRoutingFeature | undefined;
  const primarySettingId = body?.primarySettingId as string | undefined;
  const fallbackSettingId = (body?.fallbackSettingId as string | null | undefined) || null;
  const firstChunkTimeoutMs = body?.firstChunkTimeoutMs as number | undefined;
  const allowCrossProvider = body?.allowCrossProvider as boolean | undefined;

  if (
    !feature ||
    !FEATURES.has(feature) ||
    !primarySettingId ||
    (fallbackSettingId && fallbackSettingId === primarySettingId) ||
    typeof firstChunkTimeoutMs !== "number" ||
    !Number.isInteger(firstChunkTimeoutMs) ||
    firstChunkTimeoutMs < MIN_TIMEOUT_MS ||
    firstChunkTimeoutMs > MAX_TIMEOUT_MS ||
    typeof allowCrossProvider !== "boolean"
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const selectedIds = [primarySettingId, fallbackSettingId].filter((id): id is string => Boolean(id));
  const supabase = await createClient();
  const { data: settings, error: settingsError } = await supabase
    .from("ai_settings")
    .select("id, provider, role, is_active")
    .eq("workspace_id", workspaceId)
    .in("id", selectedIds);

  if (settingsError) {
    return NextResponse.json({ error: "settings_lookup_failed", message: settingsError.message }, { status: 500 });
  }

  const byId = new Map((settings ?? []).map((setting) => [setting.id, setting]));
  const selected = selectedIds.map((id) => byId.get(id));
  if (
    selected.some(
      (setting) => !setting || !setting.is_active || !roleCoversFeature(setting.role as AIRole, feature)
    )
  ) {
    return NextResponse.json({ error: "invalid_setting_for_feature" }, { status: 400 });
  }

  const primaryProvider = byId.get(primarySettingId)?.provider as AIProvider;
  const fallbackProvider = fallbackSettingId ? (byId.get(fallbackSettingId)?.provider as AIProvider) : null;
  if (fallbackProvider && fallbackProvider !== primaryProvider && !allowCrossProvider) {
    return NextResponse.json({ error: "cross_provider_consent_required" }, { status: 400 });
  }

  const { error } = await supabase.from("ai_routing_policies").upsert(
    {
      workspace_id: workspaceId,
      feature,
      primary_setting_id: primarySettingId,
      fallback_setting_id: fallbackSettingId,
      first_chunk_timeout_ms: firstChunkTimeoutMs,
      allow_cross_provider: allowCrossProvider,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,feature" }
  );

  if (error) return NextResponse.json({ error: "save_failed", message: error.message }, { status: 500 });
  return NextResponse.json({ policies: await listRoutingPolicies(workspaceId) });
}
