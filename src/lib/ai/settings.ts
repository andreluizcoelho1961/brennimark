import { resolverWorkspaceAtivo } from "@/lib/brandville/server";
import { createClient } from "@/lib/supabase/server";
import { decryptApiKey } from "@/lib/ai/crypto";
import {
  type AIProvider,
  type AIProviderConfig,
  type AIRoutingFeature,
  type AIRoutingPolicy,
  type AIRole,
} from "@/lib/ai/provider";
import { modeloAutorizado } from "@/lib/ai/catalogo";

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

/**
 * O workspace desta requisição, ou o motivo de não haver um.
 *
 * Antes: `.limit(1)` em workspace_members. Para quem participa de dois, isso
 * gravava a chave de IA — e a fatura dela — no workspace que o banco devolvesse
 * primeiro. Agora a resolução é a mesma do resto do produto: com slug, aquele;
 * sem slug, o único; havendo mais de um, uma recusa nomeada em vez de um
 * palpite.
 */
export async function resolverWorkspaceDaRequisicao(
  workspaceSlug?: string,
): Promise<{ id: string } | { motivo: "anonimo" | "ambiguo" | "nao-encontrado" }> {
  const r = await resolverWorkspaceAtivo(workspaceSlug);
  if (r.tipo === "workspace") return { id: r.workspace.id };
  if (r.tipo === "nao-encontrado") return { motivo: "nao-encontrado" };
  if (r.tipo === "escolher") {
    // Zero opções não é ambiguidade: é conta inexistente, e quem chama trata
    // como sessão sem conta.
    return { motivo: r.opcoes.length === 0 ? "anonimo" : "ambiguo" };
  }
  return { motivo: "anonimo" };
}

/** Compatibilidade: null tanto para sem sessão quanto para ambíguo. Quem
 *  precisa distinguir usa resolverWorkspaceDaRequisicao. */
export async function getCurrentWorkspaceId(workspaceSlug?: string): Promise<string | null> {
  const r = await resolverWorkspaceDaRequisicao(workspaceSlug);
  return "id" in r ? r.id : null;
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
    // Este `limit(1)` NÃO decide workspace nem marca: o workspace já veio
    // resolvido no parâmetro, e a ordenação por `updated_at` torna a escolha
    // determinística — a configuração mais recente daquele papel. É o único
    // limite de uma linha que sobreviveu ao M1, e sobreviveu por isso.
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  /*
   * Revalida contra o catálogo NA HORA da chamada, não só ao salvar.
   *
   * `ai/settings/route.ts` já recusa gravar um par fora do catálogo — mas o
   * catálogo pode mudar DEPOIS de uma configuração ter sido salva (um
   * modelo descatalogado, por exemplo). Sem esta checagem aqui, uma
   * configuração salva quando válida continuaria sendo usada mesmo depois
   * de deixar de ser autorizada — o catálogo vira decoração na hora de
   * salvar e nada mais.
   */
  if (!modeloAutorizado(data.provider, data.model)) return null;

  return {
    provider: data.provider as AIProvider,
    model: data.model,
    apiKey: decryptApiKey(data.api_key_ciphertext, data.api_key_iv),
  };
}

/*
 * Aqui viviam três fallbacks implícitos: `getDemoConfig` (chave de ambiente
 * `GROQ_API_KEY`, sempre ausente em qualquer ambiente real deste projeto),
 * `getExplicitChatFallbackConfig` (três variáveis paralelas só para chat) e
 * `getSameProviderFallback` (trocava de modelo dentro do mesmo provedor sem
 * ninguém pedir).
 *
 * O briefing do piloto Qwen é explícito: "o fallback global por
 * GROQ_API_KEY deve ser removido ou explicitamente desabilitado" — e nenhum
 * fallback implícito pode consumir crédito de outro perfil ou workspace sem
 * ser uma escolha registrada.
 *
 * Removidos, não desabilitados: `GROQ_API_KEY` nunca esteve definida em
 * nenhum ambiente deste produto (confirmado por inspeção — ver
 * docs/plan/parecer-piloto-qwen-p0.md §1), então o caminho existia só para
 * lançar uma exceção que a camada de erro convertia em mensagem de produto.
 * Chegar à mensagem certa por acidente de uma variável ausente é o padrão
 * exato que este produto rejeita em todo outro lugar — falha por design, não
 * por acaso. Ver `resolveLegacyRouting` abaixo: sem config, `attempts` fica
 * vazio, e é o CHAMADOR que decide a mensagem — de propósito.
 */

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
  // Mesma revalidação de getActiveConfig: o catálogo pode ter mudado desde
  // que esta linha foi salva.
  if (!modeloAutorizado(data.provider, data.model)) return null;

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

/**
 * Sem `ai_routing_policies`, ou sem workspace: o único config possível é o
 * `ai_settings` ativo do workspace, se existir. `attempts` vazio é uma
 * resposta válida — "não há perfil configurado" — e não uma exceção. Quem
 * chama decide a mensagem: ver `conhecimentoIndisponivel`-e-equivalentes nas
 * rotas, que tratam `attempts.length === 0` como o estado esperado de uma
 * conta sem IA configurada, não como falha.
 */
async function resolveLegacyRouting(feature: AIRoutingFeature, workspaceId: string | null): Promise<ResolvedAIRouting> {
  const config = workspaceId ? await getActiveConfig(workspaceId, feature) : null;
  const attempts = config ? [{ config, isDemo: false }] : [];

  return {
    attempts,
    timeoutMs: DEFAULT_ROUTING_TIMEOUT_MS[feature],
    allowCrossProvider: false,
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

// `resolveConfig` existiu aqui: nenhum chamador a usava, e o tipo prometia
// `{ config, isDemo }` não-opcional mesmo quando `attempts` está vazio —
// `attempts[0]` seria `undefined` sob o tipo de algo que sempre existe.
// Removida como código morto, não como funcionalidade perdida.
