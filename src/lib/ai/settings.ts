import { createServiceClient } from "@/lib/supabase/service";
import { type AIProviderConfig, type AIRoutingFeature } from "@/lib/ai/provider";
import { montarRotas, type LinhaDeRota } from "@/lib/ai/rotas-da-plataforma";
import { montarRotasDaAgencia, type LinhaDaChave, type Encaixe, ENCAIXES_DA_TAREFA } from "@/lib/ai/rotas-da-agencia";
import { decryptApiKey } from "@/lib/ai/crypto";

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
  /**
   * De quem é a IA que atende esta conta (ADR-0009): da `plataforma`, ou
   * `propria` — a da agência. Quem monta a mensagem de "sem IA" precisa saber,
   * porque a quem fala com a nossa IA se diz "fale com o suporte" e a quem trouxe
   * a sua se diz "confira a chave".
   */
  modo: "plataforma" | "propria";
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

  /*
   * O modo da IA mora no PLANO (ADR-0009). Conta que trouxe a sua IA nunca toca
   * nas chaves da Brennimark: se as dela faltarem ou falharem, `attempts` volta
   * vazio e o Vini diz isso — não há "cair na nossa". A pergunta falhar também
   * interrompe: na dúvida sobre quem paga, não se chama provedor nenhum.
   */
  const { data: modo, error: erroDoModo } = await supabase.rpc("modo_de_ia_da_conta", { p_workspace_id: workspaceId });
  if (erroDoModo) throw erroDoModo;
  if (modo === "propria") return resolverRotaDaAgencia(feature, workspaceId);

  const { data, error } = await supabase.rpc("rotas_de_ia_da_plataforma");
  if (error) throw error;

  const rotas = montarRotas((data ?? []) as LinhaDeRota[], feature);
  if (rotas.descartadas.length) {
    // Só provedor, modelo e motivo — nunca a chave. É o que a equipe precisa
    // para saber por que o Vini pulou uma reserva.
    console.warn("[ia] rotas descartadas", { tarefa: feature, conta: workspaceId, descartadas: rotas.descartadas });
  }
  return { attempts: rotas.attempts, timeoutMs: rotas.timeoutMs, allowCrossProvider: rotas.allowCrossProvider, modo: "plataforma" };
}

/** A rota de uma conta no plano "traga a sua": só as chaves que ELA cadastrou. */
async function resolverRotaDaAgencia(feature: AIRoutingFeature, workspaceId: string): Promise<ResolvedAIRouting> {
  const supabase = createServiceClient();
  const linhas: LinhaDaChave[] = [];
  for (const encaixe of ENCAIXES_DA_TAREFA[feature]) {
    // `chave_de_ia_para_uso` só devolve o texto cifrado a conta em modo `propria`
    // e só à chave de serviço; o texto claro existe aqui, em memória, por esta chamada.
    const { data, error } = await supabase.rpc("chave_de_ia_para_uso", { p_workspace_id: workspaceId, p_encaixe: encaixe });
    if (error) throw error;
    const linha = (data as { provedor: string; modelo: string; chave_cifrada: string; chave_iv: string }[] | null)?.[0];
    if (linha) linhas.push({ encaixe: encaixe as Encaixe, provedor: linha.provedor, modelo: linha.modelo, chave_cifrada: linha.chave_cifrada, chave_iv: linha.chave_iv });
  }

  const rotas = montarRotasDaAgencia(linhas, feature, decryptApiKey);
  if (rotas.descartadas.length) {
    console.warn("[ia] encaixes da agência descartados", { tarefa: feature, conta: workspaceId, descartadas: rotas.descartadas });
  }
  return { attempts: rotas.attempts, timeoutMs: rotas.timeoutMs, allowCrossProvider: rotas.allowCrossProvider, modo: "propria" };
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
