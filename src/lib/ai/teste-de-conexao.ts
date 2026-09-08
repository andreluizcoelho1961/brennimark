import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIProviderConfig } from "./provider";
import { modeloAutorizado } from "./catalogo";
import {
  decidirExecucao,
  executarComOrcamento,
  type MotivoDeBloqueio,
  type ResultadoDoDespacho,
} from "./execucao";

export const PROMPT_DO_TESTE_DE_CONEXAO = "Reply with exactly one word: ok";

export type ConfiguracaoDoTeste =
  | { ok: true; config: AIProviderConfig }
  | { ok: false; motivo: "invalid_input" | "modelo_nao_catalogado" };

/**
 * Valida o par antes de qualquer adaptador receber a chave.
 *
 * O catálogo autoriza o PAR provedor+modelo. Validar só o provedor repetiria
 * o defeito que a rota de salvamento já fechou: uma string arbitrária chegaria
 * ao fornecedor com credencial real e poderia selecionar um modelo que ninguém
 * revisou nem precificou.
 */
export function validarConfiguracaoDoTeste(body: unknown): ConfiguracaoDoTeste {
  if (!body || typeof body !== "object") return { ok: false, motivo: "invalid_input" };
  const entrada = body as Record<string, unknown>;
  if (
    typeof entrada.provider !== "string" ||
    typeof entrada.model !== "string" ||
    typeof entrada.apiKey !== "string" ||
    entrada.apiKey.length === 0
  ) {
    return { ok: false, motivo: "invalid_input" };
  }
  if (!modeloAutorizado(entrada.provider, entrada.model)) {
    return { ok: false, motivo: "modelo_nao_catalogado" };
  }
  return {
    ok: true,
    config: {
      provider: entrada.provider as AIProviderConfig["provider"],
      model: entrada.model,
      apiKey: entrada.apiKey,
    },
  };
}

export type ResultadoDoTesteDeConexao =
  | { ok: true; executionId: string }
  | { ok: false; motivo: MotivoDeBloqueio };

/**
 * Executa o teste pelo MESMO contrato financeiro das chamadas de produto.
 *
 * Testar uma chave é uma chamada real ao provedor e pode custar. Portanto ela
 * não ganha uma via lateral: catálogo, orçamento, kill switch, idempotência,
 * teto de saída e liquidação continuam valendo. A única diferença é a tarefa
 * curta e sem conhecimento de marca; o teste não lê nem envia o manual.
 */
export async function testarConexaoComOrcamento(params: {
  supabase: SupabaseClient;
  serviceClient: SupabaseClient;
  userId: string;
  workspaceId: string;
  brandId: string;
  executionId: string;
  config: AIProviderConfig;
  parentSignal?: AbortSignal;
  firstChunkTimeoutMs: number;
  dispatch: (
    config: AIProviderConfig,
    signal: AbortSignal,
    maxOutputTokens: number,
  ) => ResultadoDoDespacho;
}): Promise<ResultadoDoTesteDeConexao> {
  const decisao = await decidirExecucao(
    params.supabase,
    params.serviceClient,
    params.userId,
    {
      workspaceId: params.workspaceId,
      brandId: params.brandId,
      executionId: params.executionId,
      task: "prompt",
      role: "",
      question: PROMPT_DO_TESTE_DE_CONEXAO,
      sources: [],
    },
    { provider: params.config.provider, model: params.config.model },
  );
  if (!decisao.pode) return { ok: false, motivo: decisao.motivo };

  const attempt = { config: params.config };
  const execucao = await executarComOrcamento({
    serviceClient: params.serviceClient,
    userId: params.userId,
    executionId: decisao.executionId,
    pricing: decisao.capabilities.pricing!,
    reservedMicros: decisao.reservedMicros,
    attempts: [attempt],
    firstChunkTimeoutMs: params.firstChunkTimeoutMs,
    parentSignal: params.parentSignal,
    dispatch: (selecionado, signal) =>
      params.dispatch(selecionado.config, signal, decisao.maxOutputTokens),
  });

  try {
    // `firstChunk` prova que o provedor começou a responder. Drenar o restante
    // não é decoração: é o `done` do iterator que liquida a reserva com o uso
    // real. Retornar antes deixaria o teste preso como `reserved`.
    while (!(await execucao.iterator.next()).done) {
      // O conteúdo não é usado nem devolvido. A credencial foi testada quando
      // o primeiro chunk chegou; daqui em diante só fechamos a contabilidade.
    }
    return { ok: true, executionId: decisao.executionId };
  } finally {
    execucao.cleanup();
  }
}
