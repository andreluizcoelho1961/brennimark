import type { SupabaseClient } from "@supabase/supabase-js";
import type { LanguageModelUsage } from "ai";
import {
  CATALOGO_VERSION, capacidadesDe, custoDeReservaMicros, modeloAutorizado, podeAnalisarImagem,
  type ModelCapabilities, type ModelPricing,
} from "./catalogo";
import {
  consolidarExecucao, killSwitchAtivo, liberarReserva, mensagemDeOrcamento, reservarExecucao,
  type MotivoDeRecusa, type SnapshotDeUso, type SnapshotDePreco,
} from "./orcamento";
import { prepareStreamWithFallback, type PreparedFallbackStream } from "./stream-fallback";
import { LIMITES_DE_IA, type Trecho } from "./recuperacao";

/**
 * O contrato único que toda tarefa de IA atravessa, independente de provedor.
 *
 * Nomenclatura ajustada ao briefing do piloto — `AIExecutionRequest`,
 * `AIModelCapabilities` — sobre o que já existia: `ModelCapabilities` do
 * catálogo é reaproveitada como `AIModelCapabilities`, e `Trecho` da
 * recuperação (A1) como a forma de cada fonte. Duas formas para a mesma
 * coisa seriam duas chances de divergirem.
 *
 * Este módulo NÃO chama nenhum provedor. Ele decide SE uma execução pode
 * prosseguir — catálogo, visão, orçamento — e devolve a decisão. Quem chama
 * um adaptador de verdade é uma peça futura, de quando um perfil real
 * existir; hoje nenhum existe (P1, por decisão: nenhuma chave, nenhum
 * crédito, nenhuma conexão).
 */

export type AIModelCapabilities = ModelCapabilities;

export type AITaskType = "assist" | "analyse-image" | "prompt";

export interface AIImageInput {
  mediaType: string;
  sizeBytes: number;
}

export interface AIExecutionRequest {
  workspaceId: string;
  brandId: string;
  executionId: string;
  task: AITaskType;
  question: string;
  sources: readonly Trecho[];
  image?: AIImageInput;
}

export type MotivoDeBloqueio =
  | "modelo_nao_catalogado"
  | "preco_nao_verificado"
  | "imagem_sem_preco_verificado"
  | "imagem_maior_que_o_limite_do_modelo"
  | MotivoDeRecusa
  | "erro_de_consulta";

export type DecisaoDeExecucao =
  | {
      pode: true; executionId: string; capabilities: AIModelCapabilities;
      maxOutputTokens: number; reservedMicros: number;
    }
  | { pode: false; motivo: MotivoDeBloqueio };

/**
 * Caracteres por token — conversão grosseira, a mesma premissa (e a mesma
 * ressalva) do parecer do P0: docs/plan/parecer-piloto-qwen-p0.md §3,
 * "número sem premissa não é estimativa, é chute".
 */
const CARACTERES_POR_TOKEN = 4;

/**
 * O texto FIXO ao redor do conhecimento recuperado dentro do prompt de
 * sistema — regras de fundamentação e formato para as duas tarefas, mais
 * as regras de cor só na análise (por isso o teto da análise é quase o
 * dobro do chat). MEDIDO chamando `buildChatSystemPrompt`/
 * `buildAnalysisSystemPrompt` de verdade com trechos no teto de
 * `LIMITES_DE_IA` e um papel de marca (`chatRole`/`analysisRole`) de ~150
 * caracteres — ver o teste "o boilerplate medido do prompt de sistema
 * cabe dentro do assumido pela reserva", que roda a MESMA medição e
 * quebra se o texto fixo crescer além do que este número assume.
 *
 * `chatRole`/`analysisRole` são texto livre da marca, sem limite de
 * tamanho validado hoje — os números abaixo incluem ~350 caracteres de
 * folga para um papel mais longo que o medido, mas não são uma garantia
 * formal enquanto essa validação não existir (ver
 * docs/plan/p2-benchmark-multimodal-2026-09-03.md).
 *
 * PT, o pior caso entre os dois idiomas testados:
 *   assist: 2.365 medidos + 350 de folga ≈ 2.800
 *   analyse-image: 3.783 medidos + 350 de folga ≈ 4.200
 */
export const BOILERPLATE_DO_PROMPT_DE_SISTEMA: Record<AITaskType, number> = {
  assist: 2_800,
  "analyse-image": 4_200,
  prompt: 2_800,
};

/**
 * Margem sobre TODO o teto de entrada — cobre o que a contagem de
 * caracteres não modela diretamente: overhead de protocolo (papéis e
 * estrutura de cada mensagem no formato do provedor) e a variância do
 * tokenizador real contra a conversão grosseira de 4 caracteres por
 * token. 20% é generoso de propósito, não medido contra um provedor real
 * — revisar quando o P2B tiver uma chamada de verdade para comparar.
 */
const MARGEM_DE_PROTOCOLO = 1.2;

/**
 * Teto de tokens de ENTRADA por tarefa — o PIOR CASO permitido pelos
 * limites do produto (`LIMITES_DE_IA`), não uma mediana. Uma reserva
 * subestimada é o erro que este produto não aceita; superestimar é seguro
 * porque a consolidação ajusta para o custo real depois.
 */
function tetoDeTokensDeEntrada(task: AITaskType): number {
  const base = LIMITES_DE_IA.maxCaracteresDeContexto + BOILERPLATE_DO_PROMPT_DE_SISTEMA[task];
  const comHistorico = task === "assist"
    ? LIMITES_DE_IA.maxCaracteresDaPergunta + LIMITES_DE_IA.maxMensagens * LIMITES_DE_IA.maxCaracteresPorMensagem
    : LIMITES_DE_IA.maxCaracteresDaPergunta;
  return Math.ceil(((base + comHistorico) / CARACTERES_POR_TOKEN) * MARGEM_DE_PROTOCOLO);
}

/**
 * Teto de tokens de SAÍDA por tarefa. Sem limite de caracteres de resposta
 * no produto hoje — estes números são um teto DELIBERADAMENTE generoso
 * (maior que a mediana usada no benchmark do P0), não uma medição.
 */
function tetoDeTokensDeSaida(task: AITaskType): number {
  return task === "analyse-image" ? 2_500 : 2_000;
}

/**
 * A checagem completa, ANTES de qualquer chamada de rede custar um centavo.
 *
 * A ordem importa, e é a ordem do menor para o maior custo de verificar:
 * catálogo é leitura em memória; visão é leitura em memória; preço
 * verificado é leitura em memória; orçamento é uma escrita transacional no
 * banco. Uma imagem que o modelo recusa, ou um modelo sem preço, não
 * deveria chegar a reservar orçamento nenhum.
 *
 * `reservedMicros` não é mais parâmetro: é CALCULADO aqui, do preço
 * verificado do catálogo — um único lugar que sabe fazer essa conta, em vez
 * de cada chamador ter que adivinhar (ou inventar) um número.
 */
export async function decidirExecucao(
  supabase: SupabaseClient,
  request: AIExecutionRequest,
  perfil: { provider: string; model: string },
): Promise<DecisaoDeExecucao> {
  if (!modeloAutorizado(perfil.provider, perfil.model)) {
    return { pode: false, motivo: "modelo_nao_catalogado" };
  }

  const capabilities = capacidadesDe(perfil.provider, perfil.model);
  if (!capabilities) {
    return { pode: false, motivo: "modelo_nao_catalogado" };
  }

  if (request.image) {
    if (!podeAnalisarImagem(capabilities)) {
      return { pode: false, motivo: "imagem_sem_preco_verificado" };
    }
    if (capabilities.maxImageBytes !== undefined && request.image.sizeBytes > capabilities.maxImageBytes) {
      return { pode: false, motivo: "imagem_maior_que_o_limite_do_modelo" };
    }
  }

  if (!capabilities.pricing) {
    // Sem imagem, o portão de visão nunca roda — este é o único lugar que
    // bloqueia um modelo de TEXTO sem preço verificado.
    return { pode: false, motivo: "preco_nao_verificado" };
  }
  const pricing = capabilities.pricing;

  const priceSnapshot: SnapshotDePreco = {
    ...pricing, catalogVersion: CATALOGO_VERSION, provider: perfil.provider, model: perfil.model,
  };
  // UM número, usado nos dois lugares: a reserva soma este teto, e é o
  // MESMO valor que decidirExecucao devolve para virar `maxOutputTokens` na
  // chamada real. Duas variáveis para "o teto de saída" seriam duas chances
  // de divergirem — e a diferença entre elas é exatamente a folga que
  // deixaria uma resposta real custar mais do que a reserva cobriu.
  const maxOutputTokens = tetoDeTokensDeSaida(request.task);
  const reservedMicros = custoDeReservaMicros(pricing, {
    entrada: tetoDeTokensDeEntrada(request.task),
    saida: maxOutputTokens,
    imagem: request.image ? pricing.maxImageTokens : undefined,
  });

  const reserva = await reservarExecucao(supabase, {
    workspaceId: request.workspaceId,
    brandId: request.brandId,
    executionId: request.executionId,
    task: request.task,
    reservedMicros,
    currency: pricing.currency,
    priceSnapshot,
  });

  if (!reserva.ok) return { pode: false, motivo: reserva.motivo };

  /*
   * Recheck final, o mais perto possível do despacho.
   *
   * A reserva acima já checou o kill switch — mas ele pode ser ligado no
   * instante entre aquela checagem e este retorno. Sem este recheck, uma
   * execução em voo nesse instante ainda seria autorizada a chamar o
   * provedor, mesmo com o botão de pausa já acionado. Se este recheck
   * bloquear, a reserva já feita é liberada: sem isso, ela ficaria presa
   * como 'reserved' até expirar por timeout, ocupando teto sem executar.
   */
  const killSwitch = await killSwitchAtivo(supabase, {
    workspaceId: request.workspaceId,
    brandId: request.brandId,
  });
  if ("erro" in killSwitch) {
    await liberarReserva(supabase, reserva.executionId);
    return { pode: false, motivo: "erro_de_consulta" };
  }
  if (killSwitch.workspace || killSwitch.marca) {
    await liberarReserva(supabase, reserva.executionId);
    return { pode: false, motivo: killSwitch.workspace ? "kill_switch_workspace" : "kill_switch_marca" };
  }

  return { pode: true, executionId: reserva.executionId, capabilities, maxOutputTokens, reservedMicros };
}

/**
 * A mensagem de PRODUTO para qualquer motivo de bloqueio — nunca o código
 * cru na tela. Os motivos de orçamento (`MotivoDeRecusa`/`erro_de_consulta`)
 * já têm mensagem própria em `mensagemDeOrcamento`; os quatro daqui são os
 * que só `decidirExecucao` produz, antes de chegar ao orçamento.
 */
export function mensagemDeBloqueio(motivo: MotivoDeBloqueio, ingles: boolean): string {
  switch (motivo) {
    case "modelo_nao_catalogado":
      return ingles
        ? "The configured model is no longer authorized. Ask whoever administers the account to choose another one in Settings."
        : "O modelo configurado não está mais autorizado. Peça a quem administra a conta para escolher outro em Configurações.";
    case "preco_nao_verificado":
      return ingles
        ? "The configured model doesn't have a confirmed price for paid use yet. Ask whoever administers the account to choose a model with verified pricing."
        : "O modelo configurado ainda não tem preço confirmado para uso pago. Peça a quem administra a conta para escolher um modelo com preço verificado.";
    case "imagem_sem_preco_verificado":
      return ingles
        ? "This model doesn't have confirmed image pricing yet. Choose a model with verified image support, or send text only."
        : "Este modelo ainda não tem custo de imagem confirmado. Escolha um modelo com suporte a imagem verificado, ou envie apenas texto.";
    case "imagem_maior_que_o_limite_do_modelo":
      return ingles
        ? "The image is larger than this model's limit."
        : "A imagem é maior que o limite deste modelo.";
    default:
      return mensagemDeOrcamento(motivo, ingles);
  }
}

/** O que uma chamada real ao provedor devolve — texto e o uso, que só se sabe depois. */
export interface ResultadoDoDespacho {
  textStream: AsyncIterable<string>;
  usage: PromiseLike<LanguageModelUsage>;
}

export interface ExecucaoComOrcamento<TAttempt> {
  firstChunk: string;
  iterator: AsyncIterator<string>;
  attempt: TAttempt;
  fallbackUsed: boolean;
  cleanup: () => void;
  cancel: (reason?: unknown) => Promise<void>;
}

/**
 * Quanto esperar pela promise de uso antes de desistir e liquidar
 * conservador. Existe porque um cancelamento pode deixar essa promise
 * NUNCA resolvendo (o provedor esperava terminar o stream para relatar o
 * uso, e o stream nunca termina) — sem este teto, encerrar a execução
 * ficaria pendurado para sempre, e ninguém receberia resposta nenhuma,
 * nem a de erro.
 */
const TIMEOUT_DE_USO_PADRAO_MS = 5_000;

/**
 * Espera a promise de uso, mas nunca além do teto — `null` quer dizer
 * "não confirmei a tempo", tratado pelo chamador do mesmo jeito que "o
 * provedor não informou": liquidação conservadora, nunca custo zero.
 */
async function aguardarUsoComTimeout(
  usage: PromiseLike<LanguageModelUsage>,
  timeoutMs: number,
): Promise<LanguageModelUsage | null> {
  return Promise.race([
    Promise.resolve(usage).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

/**
 * Despacha UMA execução já decidida (`decidirExecucao` retornou `pode:
 * true`) e garante — por CONSTRUÇÃO, não por disciplina de quem chama —
 * que ela termina liquidada, nunca presa como 'reserved' e nunca liberada
 * de volta para zero depois que o pedido já pode ter saído para o
 * provedor.
 *
 * A distinção que importa é ANTES ou DEPOIS do despacho, não sucesso ou
 * falha:
 *
 * - **Antes do despacho** (nenhuma tentativa chegou a chamar `dispatch`, o
 *   único caso real sendo um `parentSignal` já abortado): nada saiu para o
 *   provedor. Libera integralmente — é o único caminho que ainda existe
 *   para devolver o teto inteiro ao orçamento do dia.
 * - **Depois do despacho, com uso medido**: liquida com o custo REAL.
 * - **Depois do despacho, sem uso confiável** — erro no meio do stream,
 *   cancelamento, ou a promise de uso não resolve com números — NUNCA
 *   libera. O pedido já pode ter chegado ao provedor, que pode cobrar
 *   mesmo sem devolver um relatório final de uso; transformar isso em
 *   custo zero seria inventar uma garantia que não existe. Liquida pelo
 *   TETO reservado (o mesmo número que já era o pior caso assumido) e
 *   marca `usage_unknown` no ledger, para reconciliação manual se o
 *   provedor publicar uso tardio.
 *
 * A garantia mora no `iterator` devolvido: quem chama só drena do jeito
 * que já drenava — `next()` decide sozinho ao terminar ou lançar,
 * `return()` (cancelamento) também. Um `encerrado` interno faz o que
 * acontecer primeiro vencer; as funções do banco também são idempotentes,
 * então mesmo uma corrida aqui seria inofensiva — duas camadas, não uma
 * confiando na outra.
 *
 * Nenhum fallback automático: só `attempts[0]` é tentado, mesmo que
 * `attempts` traga mais — a reserva foi calculada para UM preço, e deixar
 * esta função trocar de perfil por conta própria liquidaria com um preço
 * que ninguém reservou.
 */
export async function executarComOrcamento<TAttempt extends { config: { provider: string; model: string } }>(
  params: {
    supabase: SupabaseClient;
    executionId: string;
    pricing: ModelPricing;
    /** O mesmo valor que `decidirExecucao` reservou — o teto usado na
     *  liquidação conservadora quando o uso real não está disponível. */
    reservedMicros: number;
    attempts: readonly TAttempt[];
    firstChunkTimeoutMs: number;
    /** Teto de espera pela promise de uso ao encerrar — ver `TIMEOUT_DE_USO_PADRAO_MS`. */
    usageTimeoutMs?: number;
    parentSignal?: AbortSignal;
    validateInitialText?: (text: string, streamEnded: boolean) => "accept" | "continue" | "reject";
    dispatch: (attempt: TAttempt, signal: AbortSignal) => ResultadoDoDespacho;
    onAttemptStart?: (attempt: TAttempt, index: number) => void;
    onAttemptFailure?: (attempt: TAttempt, index: number, error: unknown) => void;
  },
): Promise<ExecucaoComOrcamento<TAttempt>> {
  const { supabase, executionId, pricing, reservedMicros, dispatch } = params;
  const usageTimeoutMs = params.usageTimeoutMs ?? TIMEOUT_DE_USO_PADRAO_MS;
  const attemptsRestritos = params.attempts.slice(0, 1) as TAttempt[];

  let usageCapturado: PromiseLike<LanguageModelUsage> | null = null;
  // Marcado no instante em que ALGUMA tentativa chega a ser despachada —
  // é o que decide se uma falha depois disso ainda pode liberar
  // integralmente (não pode) ou precisa liquidar conservador (precisa).
  let attemptDespachado: TAttempt | null = null;

  let encerrado = false;

  /** A liquidação conservadora — nunca vira custo zero. */
  const consolidarConservador = async () => {
    const usageSnapshot: SnapshotDeUso = { unknown: true };
    await consolidarExecucao(supabase, {
      executionId, settledMicros: reservedMicros,
      provider: attemptDespachado?.config.provider ?? "desconhecido",
      model: attemptDespachado?.config.model ?? "desconhecido",
      usageSnapshot,
    });
  };

  /** Encerramento depois do despacho — tenta o uso real, cai para o conservador. */
  const encerrarPosDespacho = async () => {
    if (encerrado) return;
    encerrado = true;
    const usage = usageCapturado ? await aguardarUsoComTimeout(usageCapturado, usageTimeoutMs) : null;
    if (!usage || (usage.inputTokens === undefined && usage.outputTokens === undefined)) {
      await consolidarConservador();
      return;
    }
    const settledMicros = custoDeReservaMicros(pricing, {
      entrada: usage.inputTokens ?? 0, saida: usage.outputTokens ?? 0,
    });
    const usageSnapshot: SnapshotDeUso = {
      inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
      cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
    };
    await consolidarExecucao(supabase, {
      executionId, settledMicros,
      provider: attemptDespachado!.config.provider, model: attemptDespachado!.config.model,
      usageSnapshot,
    });
  };

  let prepared: PreparedFallbackStream<TAttempt>;
  try {
    prepared = await prepareStreamWithFallback<TAttempt>({
      attempts: attemptsRestritos,
      firstChunkTimeoutMs: params.firstChunkTimeoutMs,
      parentSignal: params.parentSignal,
      validateInitialText: params.validateInitialText,
      onAttemptStart: params.onAttemptStart,
      onAttemptFailure: params.onAttemptFailure,
      start: (attempt, signal) => {
        // Marcado ANTES do despacho de fato — mesmo que `dispatch` lance
        // de forma síncrona, não há como saber se o pedido já tocou a
        // rede, e errar para o lado conservador é a escolha segura.
        attemptDespachado = attempt;
        const resultado = dispatch(attempt, signal);
        usageCapturado = resultado.usage;
        return resultado.textStream;
      },
    });
  } catch (error) {
    if (attemptDespachado) {
      await encerrarPosDespacho();
    } else {
      // Nenhuma tentativa chegou a ser despachada — o único caso real é
      // `parentSignal` já abortado antes do primeiro attempt. Nada saiu
      // para o provedor: aqui, e só aqui, liberar integralmente é seguro.
      encerrado = true;
      await liberarReserva(supabase, executionId);
    }
    throw error;
  }

  const originalIterator = prepared.iterator;
  const iterator: AsyncIterator<string> = {
    async next() {
      try {
        const resultado = await originalIterator.next();
        if (resultado.done) await encerrarPosDespacho();
        return resultado;
      } catch (error) {
        await encerrarPosDespacho();
        throw error;
      }
    },
    async return(value) {
      await encerrarPosDespacho();
      return originalIterator.return ? originalIterator.return(value) : { done: true, value };
    },
  };

  return {
    firstChunk: prepared.firstChunk,
    iterator,
    attempt: prepared.attempt,
    fallbackUsed: prepared.fallbackUsed,
    cleanup: prepared.cleanup,
    cancel: async (reason) => {
      prepared.cancel(reason);
      await encerrarPosDespacho();
    },
  };
}
