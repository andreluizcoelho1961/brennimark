import { resolverWorkspaceAtivo } from "@/lib/brennimark/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  type AIProvider,
  type AIProviderConfig,
  type AIRoutingFeature,
  type AIRoutingPolicy,
  type AIRole,
} from "@/lib/ai/provider";
import { montarRotas, type LinhaDeRota } from "@/lib/ai/rotas-da-plataforma";

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

/**
 * A rota de IA que ATENDE um pedido — a da PLATAFORMA (29/09/2026).
 *
 * Decisão do André (28/09): a IA é da Brennimark, nenhuma conta escolhe nem
 * configura. Modelo, reservas e espera vêm do Console
 * (`rotas_de_ia_da_plataforma()`, que só a chave de serviço executa); as
 * chaves, da Vercel. Ver `rotas-da-plataforma.ts` e o ADR-0008.
 *
 * O `workspaceId` segue no contrato porque o que continua sendo POR CONTA é o
 * orçamento: a reserva no razão (`reservar_execucao_de_ia_server`) confere o
 * limite do dia e do mês daquela conta. A rota, não — é a mesma para todas.
 *
 * Até esta data, a rota lia `ai_routing_policies` e as chaves cifradas de
 * `ai_settings` de cada conta. Essas tabelas ficam no banco, sem uso por aqui;
 * a tela que as edita sai na parte 3.
 */
export async function resolveFeatureRouting(
  feature: AIRoutingFeature,
  workspaceId: string,
): Promise<ResolvedAIRouting> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("rotas_de_ia_da_plataforma");
  if (error) throw error;

  const rotas = montarRotas((data ?? []) as LinhaDeRota[], feature);
  if (rotas.descartadas.length) {
    // Só provedor, modelo e motivo — nunca a chave. É o que a equipe precisa
    // para saber por que o Vini pulou uma reserva.
    console.warn("[ia] rotas descartadas", { tarefa: feature, conta: workspaceId, descartadas: rotas.descartadas });
  }
  return { attempts: rotas.attempts, timeoutMs: rotas.timeoutMs, allowCrossProvider: rotas.allowCrossProvider };
}

export async function resolveChatRouting(workspaceId: string): Promise<ResolvedAIRouting> {
  return resolveFeatureRouting("chat", workspaceId);
}

export async function resolveAnalysisRouting(workspaceId: string): Promise<ResolvedAIRouting> {
  return resolveFeatureRouting("analysis", workspaceId);
}

// `resolveConfig` existiu aqui: nenhum chamador a usava, e o tipo prometia
// `{ config, isDemo }` não-opcional mesmo quando `attempts` está vazio —
// `attempts[0]` seria `undefined` sob o tipo de algo que sempre existe.
// Removida como código morto, não como funcionalidade perdida.
