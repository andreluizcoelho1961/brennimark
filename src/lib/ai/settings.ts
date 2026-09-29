import { createServiceClient } from "@/lib/supabase/service";
import { type AIProviderConfig, type AIRoutingFeature } from "@/lib/ai/provider";
import { montarRotas, type LinhaDeRota } from "@/lib/ai/rotas-da-plataforma";

/*
 * Resolução da rota de IA de um pedido. Desde 29/09/2026 (ADR-0008) a rota é
 * da PLATAFORMA: aqui não há mais leitura nem edição da configuração de uma
 * conta — a tela "Provedores de IA" e as rotas `/api/ai/settings`,
 * `/api/ai/routing` e `/api/ai/test-connection` saíram na parte 3 da etapa 2.
 * As tabelas `ai_settings` e `ai_routing_policies` ficam no banco, sem uso.
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
