import { NextResponse } from "next/server";
import { streamText, type LanguageModelUsage } from "ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getModel, supportsVision } from "@/lib/ai/provider";
import { resolveAnalysisRouting, type ResolvedChatAttempt } from "@/lib/ai/settings";
import { buildAnalysisSystemPrompt } from "@/lib/ai/brand-context";
import { brandPromptContext } from "@/lib/brandville/context";
import { classifyAIError, semProvedorConfigurado } from "@/lib/ai/errors";
import { parseAnalysisText } from "@/lib/ai/analysis-result";
import { normalizeAnalysisVerdict } from "@/lib/ai/analysis-result";
import { prepareStreamWithFallback } from "@/lib/ai/stream-fallback";
import { getAnalysisAuthContext, persistAnalysisRun } from "@/lib/analysis/server";
import { alvoDaRota, portaoDeIA } from "@/lib/brandville/contexto-da-rota";
import { buscarTrechos } from "@/lib/ai/buscar";
import type { Trecho } from "@/lib/ai/recuperacao";
import { custoDeReservaMicros, type ModelPricing } from "@/lib/ai/catalogo";
import { decidirExecucao, mensagemDeBloqueio } from "@/lib/ai/execucao";
import { consolidarExecucao, liberarReserva } from "@/lib/ai/orcamento";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);
const ANALYSIS_COMPLETION_TIMEOUT_MS = 90_000;

export const maxDuration = 120;

type AttemptLog = {
  provider: string;
  model: string;
  elapsedMs: number;
  status: "failed" | "completed";
};

type AnalysisEvent =
  | { type: "progress"; stage: "preparing" | "consulting" | "fallback" | "verifying"; message: string; provider?: string; model?: string; elapsedMs: number }
  | { type: "complete"; analysis: ReturnType<typeof parseAnalysisText>; isDemo: boolean; provider: string; model: string; fallbackUsed: boolean; elapsedMs: number; attempts: AttemptLog[]; historyId: string | null; historySaved: boolean; imageSaved: boolean }
  | { type: "error"; error: string; message: string; elapsedMs: number };

function parseImageDataUrl(value: string) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(value);
  if (!match) return null;
  return { mediaType: match[1], data: match[2] };
}


/**
 * A base de conhecimento não respondeu.
 *
 * 503 e NENHUMA chamada ao provedor. Um modelo acionado sem os trechos
 * responderia com conhecimento geral sobre uma marca que ele não conhece — e a
 * resposta sairia com a cara de sempre, fundamentada em nada. Custa dinheiro e
 * produz a falha mais cara do produto: uma regra de marca inventada.
 *
 * Distinto de "não encontrei nada", que é 200 e resposta de insuficiência de
 * evidência. Um é uma afirmação sobre o manual; o outro é a confissão de que
 * não deu para consultá-lo.
 */
function conhecimentoIndisponivel() {
  return NextResponse.json(
    {
      error: "knowledge_unavailable",
      message: isEnglish
        ? "The brand manual couldn't be consulted right now. Try again in a moment."
        : "Não foi possível consultar o manual da marca agora. Tente de novo em instantes.",
    },
    { status: 503 },
  );
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
  const body = await request.json().catch(() => null);
  const imageBase64 = body?.imageBase64 as string | undefined;
  const fileName = (body?.fileName as string | undefined)?.trim() || (isEnglish ? "untitled-piece" : "peça-sem-nome");
  const parentRunId = (body?.parentRunId as string | undefined) || null;
  const question = (body?.question as string | undefined) ?? (isEnglish ? "Does this piece align with the brand system?" : "Essa peça está alinhada com o sistema de marca?");
  const image = imageBase64 ? parseImageDataUrl(imageBase64) : null;

  if (!image) {
    return NextResponse.json({ error: "invalid_input", message: isEnglish ? "Please provide a valid image for analysis." : "Envie uma imagem válida para análise." }, { status: 400 });
  }

  if (!(["image/jpeg", "image/png", "image/webp", "image/gif"] as string[]).includes(image.mediaType)) {
    return NextResponse.json({ error: "unsupported_image", message: isEnglish ? "Use a JPG, PNG, WebP, or GIF image." : "Use uma imagem JPG, PNG, WebP ou GIF." }, { status: 415 });
  }

  const imageBytes = Buffer.from(image.data, "base64").byteLength;
  if (imageBytes > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "image_too_large", message: isEnglish ? "The image must be at most 10 MB." : "A imagem deve ter no máximo 10 MB." }, { status: 413 });
  }

  let authContext;
  try {
    authContext = await getAnalysisAuthContext(alvoDaRota(request));
  } catch {
    return NextResponse.json({ error: "auth_unavailable", message: isEnglish ? "Couldn't verify your access right now." : "Não foi possível validar seu acesso agora." }, { status: 503 });
  }
  if (!authContext) {
    return NextResponse.json({ error: "unauthorized", message: isEnglish ? "Sign in again to analyze and save this piece." : "Entre novamente para analisar e salvar a peça." }, { status: 401 });
  }

  let trechos: Trecho[] = [];
  let brandPrompt;
  let workspaceId: string;
  let brandId: string;
  let executionId: string;
  let supabase: SupabaseClient;
  try {
    /*
     * O portão do G1: a marca precisa ter contratado a ANÁLISE, e não basta
     * ter contratado o chat. Contratar uma coisa não contrata a outra.
     */
    const portao = await portaoDeIA(request, "analysis");
    if (!portao.ok) return portao.resposta;
    workspaceId = portao.auth.workspaceId;
    brandId = portao.brand.id;
    supabase = portao.auth.supabase;
    executionId = (body?.executionId as string | undefined) || crypto.randomUUID();

    /*
     * A análise também recupera, em vez de levar o manual inteiro.
     *
     * Ela não tem pergunta digitada como o chat: a busca é feita sobre o que a
     * peça declara — o nome do arquivo e a pergunta do formulário. É pouco, e
     * é honesto que seja pouco: recuperar sobre pouco devolve pouco, e pouco
     * com procedência é melhor que muito sem relação.
     */
    const recuperacao = await buscarTrechos(
      portao.auth.supabase,
      portao.brand.id,
      `${question} ${fileName}`,
    );
    // Interrompe antes do provedor: julgar uma peça sem o manual seria julgar
    // com conhecimento geral, e o veredito sairia com a mesma confiança.
    if (!recuperacao.ok) return conhecimentoIndisponivel();
    trechos = recuperacao.trechos;
    brandPrompt = brandPromptContext(portao.brand);
  } catch {
    return NextResponse.json({ error: "content_unavailable", message: isEnglish ? "Couldn't load the latest guidelines right now." : "Não foi possível carregar as diretrizes atualizadas agora." }, { status: 503 });
  }

  let attempts: ResolvedChatAttempt[];
  let firstChunkTimeoutMs: number;
  try {
    const routing = await resolveAnalysisRouting();
    // Sem perfil configurado, `attempts` vem vazio — resultado, não exceção.
    // Interrompe AQUI: sem isto, `prepareStreamWithFallback` lançaria um erro
    // genérico sem nome, e a pessoa veria "erro desconhecido" em vez da
    // mensagem que diz a quem pedir.
    if (routing.attempts.length === 0) {
      const { code, message } = semProvedorConfigurado();
      return NextResponse.json({ error: code, message }, { status: 503 });
    }
    attempts = routing.attempts;
    firstChunkTimeoutMs = routing.timeoutMs;
  } catch (error) {
    const { code, message, detalheTecnico } = classifyAIError(error);
    // O detalhe fica no log do servidor. A resposta leva só a mensagem de
    // produto — ela atravessa a rede e aparece na tela.
    console.error(JSON.stringify({ level: "error", msg: "ai_error", code, detalheTecnico }));
    return NextResponse.json({ error: code, message }, { status: 503 });
  }

  const modelosComVisao = attempts.filter((attempt) => supportsVision(attempt.config));
  if (modelosComVisao.length === 0) {
    const configuredModels = attempts.map((attempt) => attempt.config.model).join(", ");
    return NextResponse.json(
      {
        error: "model_no_vision",
        message: isEnglish
          ? `The configured models (${configuredModels}) don't support image analysis. Configure at least one vision-capable model in Settings — Connect Your AI.`
          : `Os modelos configurados (${configuredModels}) não suportam análise de imagens. Configure ao menos um modelo com visão em Configurações — Conecte sua IA.`,
      },
      { status: 422 }
    );
  }

  /*
   * Um único perfil, não a lista inteira — mesmo motivo do chat/route.ts: a
   * reserva de orçamento vale para UM par provedor+modelo, e deixar o
   * fallback trocar de perfil por conta própria liquidaria com um preço que
   * ninguém reservou.
   */
  const visionAttempts = [modelosComVisao[0]];
  let pricing: ModelPricing;
  try {
    const decisao = await decidirExecucao(
      supabase,
      {
        workspaceId, brandId, executionId, task: "analyse-image", question,
        sources: trechos, image: { mediaType: image.mediaType, sizeBytes: imageBytes },
      },
      { provider: visionAttempts[0].config.provider, model: visionAttempts[0].config.model },
    );
    if (!decisao.pode) {
      return NextResponse.json(
        { error: decisao.motivo, message: mensagemDeBloqueio(decisao.motivo, isEnglish) },
        { status: 503 },
      );
    }
    // decidirExecucao só devolve pode:true com preço de imagem verificado
    // (é a checagem que bloqueia antes de chegar aqui) — não-nulo garantido.
    pricing = decisao.capabilities.pricing!;
  } catch (error) {
    const { code, message, detalheTecnico } = classifyAIError(error);
    console.error(JSON.stringify({ level: "error", msg: "ai_error", code, detalheTecnico }));
    return NextResponse.json({ error: code, message }, { status: 503 });
  }

  console.log(JSON.stringify({
    level: "info",
    msg: "analysis_start",
    route: "/api/ai/analyze",
    requestId,
    imageMediaType: image.mediaType,
    imageBytesApprox: imageBytes,
    attemptCount: visionAttempts.length,
  }));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: AnalysisEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const attemptLog: AttemptLog[] = [];
      const attemptStarts = new Map<ResolvedChatAttempt, number>();
      // Preenchido dentro de `start`, abaixo — o único jeito de ler `.usage`
      // depois que só o stream de texto (não o resultado inteiro) foi
      // repassado para prepareStreamWithFallback. Só a promise de uso, não o
      // resultado inteiro de `streamText` — mais simples de tipar.
      let streamUsage: PromiseLike<LanguageModelUsage> | null = null;
      // Liquida com o custo REAL, ou libera se não houver uso nenhum para
      // liquidar. Chamável mais de uma vez sem risco: a função do banco
      // ignora silenciosamente uma segunda chamada para a mesma execução.
      // Extraída como função própria (em vez de inline no try aninhado
      // abaixo) porque o TypeScript, nesta profundidade de try/finally, não
      // consegue estreitar `usage: LanguageModelUsage | null` corretamente
      // quando o código fica no meio do bloco — mesmo padrão de
      // chat/route.ts, onde a extração já era necessária pelo mesmo motivo.
      const encerrarExecucao = async (provider: string, model: string) => {
        const usage = streamUsage ? await Promise.resolve(streamUsage).catch(() => null) : null;
        if (!usage || (usage.inputTokens === undefined && usage.outputTokens === undefined)) {
          await liberarReserva(supabase, executionId);
          return;
        }
        const settledMicros = custoDeReservaMicros(pricing, {
          entrada: usage.inputTokens ?? 0, saida: usage.outputTokens ?? 0,
        });
        await consolidarExecucao(supabase, {
          executionId, settledMicros, provider, model,
          usageSnapshot: {
            inputTokens: usage.inputTokens, outputTokens: usage.outputTokens,
            cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens,
          },
        });
      };

      send({ type: "progress", stage: "preparing", message: isEnglish ? "Preparing the image and brand guidelines…" : "Preparando a imagem e as diretrizes da marca…", elapsedMs: 0 });

      try {
        const prepared = await prepareStreamWithFallback({
          attempts: visionAttempts,
          firstChunkTimeoutMs,
          parentSignal: request.signal,
          onAttemptStart: (attempt, index) => {
            attemptStarts.set(attempt, Date.now());
            send({
              type: "progress",
              stage: index > 0 ? "fallback" : "consulting",
              message: index > 0
                ? (isEnglish ? "The primary AI didn't start responding in time. Consulting the fallback AI…" : "A IA principal não começou a responder no prazo. Consultando a IA de reserva…")
                : (isEnglish ? "Consulting the visual AI…" : "Consultando a IA visual…"),
              provider: attempt.config.provider,
              model: attempt.config.model,
              elapsedMs: Date.now() - startedAt,
            });
          },
          onAttemptFailure: (attempt, _index, error) => {
            const elapsedMs = Date.now() - (attemptStarts.get(attempt) ?? Date.now());
            attemptLog.push({
              provider: attempt.config.provider,
              model: attempt.config.model,
              elapsedMs,
              status: "failed",
            });
            console.error(JSON.stringify({
              level: "error",
              msg: "analysis_attempt_failed",
              route: "/api/ai/analyze",
              requestId,
              provider: attempt.config.provider,
              model: attempt.config.model,
              ms: elapsedMs,
              error: error instanceof Error ? error.message : String(error),
            }));
          },
          start: (attempt, abortSignal) => {
            const result = streamText({
              model: getModel(attempt.config),
              system: buildAnalysisSystemPrompt(trechos, brandPrompt),
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: question },
                    {
                      type: "file",
                      mediaType: image.mediaType,
                      data: { type: "data", data: image.data },
                    },
                  ],
                },
              ],
              abortSignal,
              timeout: { totalMs: ANALYSIS_COMPLETION_TIMEOUT_MS },
              maxRetries: 0,
              include: { requestBody: false },
              onError: ({ error }) => {
                console.error(JSON.stringify({
                  level: "error",
                  msg: "analysis_stream_error",
                  route: "/api/ai/analyze",
                  requestId,
                  provider: attempt.config.provider,
                  model: attempt.config.model,
                  error: error instanceof Error ? error.message : String(error),
                }));
              },
            });
            streamUsage = result.usage;
            return result.textStream;
          },
        });

        try {
          let text = prepared.firstChunk;
          while (true) {
            const next = await prepared.iterator.next();
            if (next.done) break;
            text += next.value;
          }

          const selected = prepared.attempt;
          const selectedElapsedMs = Date.now() - (attemptStarts.get(selected) ?? startedAt);
          attemptLog.push({
            provider: selected.config.provider,
            model: selected.config.model,
            elapsedMs: selectedElapsedMs,
            status: "completed",
          });

          await encerrarExecucao(selected.config.provider, selected.config.model);

          send({ type: "progress", stage: "verifying", message: isEnglish ? "Verifying evidence and saving the diagnosis…" : "Verificando evidências e salvando o diagnóstico…", elapsedMs: Date.now() - startedAt });
          const analysis = parseAnalysisText(text);
          const elapsedMs = Date.now() - startedAt;
          let historyId: string | null = null;
          let historySaved = false;
          let imageSaved = false;
          try {
            const saved = await persistAnalysisRun({
              context: authContext,
              parentRunId,
              fileName,
              imageMediaType: image.mediaType,
              imageData: image.data,
              question,
              verdict: normalizeAnalysisVerdict(analysis.verdict),
              analysis,
              provider: selected.config.provider,
              model: selected.config.model,
              fallbackUsed: prepared.fallbackUsed,
              elapsedMs,
              attempts: attemptLog,
            });
            historyId = saved.id;
            historySaved = true;
            imageSaved = saved.imageSaved;
            if (saved.imageError) {
              console.error(JSON.stringify({ level: "error", msg: "analysis_image_save_failed", requestId, historyId, error: saved.imageError }));
            }
          } catch (saveError) {
            console.error(JSON.stringify({
              level: "error",
              msg: "analysis_history_save_failed",
              requestId,
              error: saveError instanceof Error ? saveError.message : String(saveError),
            }));
          }
          send({
            type: "complete",
            analysis,
            isDemo: selected.isDemo,
            provider: selected.config.provider,
            model: selected.config.model,
            fallbackUsed: prepared.fallbackUsed,
            elapsedMs,
            attempts: attemptLog,
            historyId,
            historySaved,
            imageSaved,
          });
          console.log(JSON.stringify({
            level: "info",
            msg: "analysis_done",
            route: "/api/ai/analyze",
            requestId,
            provider: selected.config.provider,
            model: selected.config.model,
            fallbackUsed: prepared.fallbackUsed,
            ms: Date.now() - startedAt,
          }));
        } finally {
          prepared.cleanup();
        }
      } catch (error) {
        // A reserva já foi feita (antes deste bloco) e a análise não
        // produziu nenhum uso cobrável — libera, para não comer o teto do
        // dia à toa.
        await liberarReserva(supabase, executionId);
        const rootError = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
        const { code, message, detalheTecnico } = classifyAIError(rootError);
        console.error(JSON.stringify({ level: "error", msg: "ai_error", code, detalheTecnico }));
        console.error(JSON.stringify({
          level: "error",
          msg: "analysis_failed",
          route: "/api/ai/analyze",
          requestId,
          error: rootError instanceof Error ? rootError.message : String(rootError),
          ms: Date.now() - startedAt,
        }));
        send({ type: "error", error: code, message, elapsedMs: Date.now() - startedAt });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
