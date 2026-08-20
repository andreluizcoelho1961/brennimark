import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/ai/crypto";
import {
  DEMO_FALLBACK_MODEL,
  DEMO_MODEL,
  DEMO_PROVIDER,
  PROVIDERS,
  type AIProvider,
  type AIProviderConfig,
  type AIRoutingFeature,
  type AIRoutingPolicy,
  type AIRole,
} from "@/lib/ai/provider";

export type StoredAISetting = {
  id: string;
  provider: AIProvider;
  model: string;
  role: AIRole;
  apiKeyLast4: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** The signed-in user's workspace id, or null if unauthenticated (e.g. NEXT_PUBLIC_SKIP_AUTH dev mode). */
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return data?.workspace_id ?? null;
}

export async function listSettings(workspaceId: string): Promise<StoredAISetting[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_settings")
    .select("id, provider, model, role, api_key_last4, is_active, created_at, updated_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    provider: row.provider as AIProvider,
    model: row.model,
    role: row.role as AIRole,
    apiKeyLast4: row.api_key_last4,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export const DEFAULT_ROUTING_TIMEOUT_MS: Record<AIRoutingFeature, number> = {
  chat: 8_000,
  analysis: 30_000,
};

export function roleCoversFeature(role: AIRole, feature: AIRoutingFeature): boolean {
  return role === "both" || role === feature;
}

function defaultPolicy(feature: AIRoutingFeature): AIRoutingPolicy {
  return {
    feature,
    primarySettingId: null,
    fallbackSettingId: null,
    firstChunkTimeoutMs: DEFAULT_ROUTING_TIMEOUT_MS[feature],
    allowCrossProvider: false,
  };
}

export async function listRoutingPolicies(workspaceId: string): Promise<AIRoutingPolicy[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_routing_policies")
    .select("feature, primary_setting_id, fallback_setting_id, first_chunk_timeout_ms, allow_cross_provider, updated_at")
    .eq("workspace_id", workspaceId);

  if (error) throw error;

  const stored = new Map((data ?? []).map((row) => [row.feature as AIRoutingFeature, row]));
  return (["chat", "analysis"] as const).map((feature) => {
    const row = stored.get(feature);
    if (!row) return defaultPolicy(feature);
    return {
      feature,
      primarySettingId: row.primary_setting_id,
      fallbackSettingId: row.fallback_setting_id,
      firstChunkTimeoutMs: row.first_chunk_timeout_ms,
      allowCrossProvider: row.allow_cross_provider,
      updatedAt: row.updated_at,
    };
  });
}

/** The workspace's active saved config for a role, decrypted — or null if none is set. */
export async function getActiveConfig(workspaceId: string, role: "chat" | "analysis"): Promise<AIProviderConfig | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_settings")
    .select("provider, model, api_key_ciphertext, api_key_iv")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .in("role", [role, "both"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    provider: data.provider as AIProvider,
    model: data.model,
    apiKey: decryptApiKey(data.api_key_ciphertext, data.api_key_iv),
  };
}

export function getDemoConfig(): AIProviderConfig {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "No AI provider configured and GROQ_API_KEY is not set. Add GROQ_API_KEY to .env.local for the free-tier demo fallback, or configure a provider in Configurações — Conecte sua IA."
    );
  }
  return { provider: DEMO_PROVIDER, model: DEMO_MODEL, apiKey };
}

function getExplicitChatFallbackConfig(): AIProviderConfig | null {
  const provider = process.env.AI_CHAT_FALLBACK_PROVIDER;
  const model = process.env.AI_CHAT_FALLBACK_MODEL;
  const apiKey = process.env.AI_CHAT_FALLBACK_API_KEY;

  if (!provider && !model && !apiKey) return null;
  if (!provider || !model || !apiKey || !PROVIDERS.some((candidate) => candidate.value === provider)) {
    throw new Error(
      "Configure AI_CHAT_FALLBACK_PROVIDER, AI_CHAT_FALLBACK_MODEL e AI_CHAT_FALLBACK_API_KEY em conjunto."
    );
  }

  return { provider: provider as AIProvider, model, apiKey };
}

function getSameProviderFallback(primary: AIProviderConfig): AIProviderConfig | null {
  if (primary.provider !== "groq" || primary.model === DEMO_FALLBACK_MODEL) return null;
  return { ...primary, model: DEMO_FALLBACK_MODEL };
}

export type ResolvedChatAttempt = {
  config: AIProviderConfig;
  isDemo: boolean;
  settingId?: string;
};

export type ResolvedAIRouting = {
  attempts: ResolvedChatAttempt[];
  timeoutMs: number;
  allowCrossProvider: boolean;
};

async function getSettingConfig(
  workspaceId: string,
  settingId: string | null,
  feature: AIRoutingFeature
): Promise<ResolvedChatAttempt | null> {
  if (!settingId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_settings")
    .select("id, provider, model, role, api_key_ciphertext, api_key_iv, is_active")
    .eq("workspace_id", workspaceId)
    .eq("id", settingId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.is_active || !roleCoversFeature(data.role as AIRole, feature)) return null;

  return {
    settingId: data.id,
    isDemo: false,
    config: {
      provider: data.provider as AIProvider,
      model: data.model,
      apiKey: decryptApiKey(data.api_key_ciphertext, data.api_key_iv),
    },
  };
}

async function resolveLegacyRouting(feature: AIRoutingFeature, workspaceId: string | null): Promise<ResolvedAIRouting> {
  const config = workspaceId ? await getActiveConfig(workspaceId, feature) : null;
  const primary = config ? { config, isDemo: false } : { config: getDemoConfig(), isDemo: true };
  const explicitFallback = feature === "chat" ? getExplicitChatFallbackConfig() : null;
  const fallback = explicitFallback ?? getSameProviderFallback(primary.config);
  const attempts = !fallback || (fallback.provider === primary.config.provider && fallback.model === primary.config.model)
    ? [primary]
    : [primary, { config: fallback, isDemo: primary.isDemo }];

  return {
    attempts,
    timeoutMs: DEFAULT_ROUTING_TIMEOUT_MS[feature],
    allowCrossProvider: Boolean(explicitFallback),
  };
}

export async function resolveFeatureRouting(feature: AIRoutingFeature): Promise<ResolvedAIRouting> {
  const workspaceId = await getCurrentWorkspaceId();
  if (!workspaceId) return resolveLegacyRouting(feature, null);

  const supabase = await createClient();
  const { data: policy, error } = await supabase
    .from("ai_routing_policies")
    .select("primary_setting_id, fallback_setting_id, first_chunk_timeout_ms, allow_cross_provider")
    .eq("workspace_id", workspaceId)
    .eq("feature", feature)
    .maybeSingle();

  if (error) throw error;
  if (!policy) return resolveLegacyRouting(feature, workspaceId);

  const [primary, fallback] = await Promise.all([
    getSettingConfig(workspaceId, policy.primary_setting_id, feature),
    getSettingConfig(workspaceId, policy.fallback_setting_id, feature),
  ]);
  const attempts = [primary, fallback].filter((attempt): attempt is ResolvedChatAttempt => Boolean(attempt));
  const uniqueAttempts = attempts.filter(
    (attempt, index) => index === 0 || attempt.settingId !== attempts[0]?.settingId
  );

  if (
    uniqueAttempts.length > 1 &&
    uniqueAttempts[0].config.provider !== uniqueAttempts[1].config.provider &&
    !policy.allow_cross_provider
  ) {
    uniqueAttempts.splice(1);
  }

  if (uniqueAttempts.length === 0) {
    const demo = await resolveLegacyRouting(feature, null);
    return { ...demo, timeoutMs: policy.first_chunk_timeout_ms };
  }

  return {
    attempts: uniqueAttempts,
    timeoutMs: policy.first_chunk_timeout_ms,
    allowCrossProvider: policy.allow_cross_provider,
  };
}

/**
 * Cross-provider fallback is opt-in through dedicated server variables.
 * Without that consent, Groq may only switch models under the same key/provider.
 */
export async function resolveChatRouting(): Promise<ResolvedAIRouting> {
  return resolveFeatureRouting("chat");
}

export async function resolveAnalysisRouting(): Promise<ResolvedAIRouting> {
  return resolveFeatureRouting("analysis");
}

/** Resolves the config to use for a feature: workspace's own setting, or the shared demo fallback. */
export async function resolveConfig(role: "chat" | "analysis"): Promise<{ config: AIProviderConfig; isDemo: boolean }> {
  const routing = await resolveFeatureRouting(role);
  return routing.attempts[0];
}
