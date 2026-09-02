import { NextResponse } from "next/server";
import { streamText, type ModelMessage } from "ai";
import { getChatProviderOptions, getModel } from "@/lib/ai/provider";
import { resolveChatRouting, type ResolvedChatAttempt } from "@/lib/ai/settings";
import { buildChatSystemPrompt } from "@/lib/ai/brand-context";
import { buscarTrechos, perguntaDasMensagens } from "@/lib/ai/buscar";
import { limitarMensagens, type Trecho } from "@/lib/ai/recuperacao";
import { portaoDeIA } from "@/lib/brandville/contexto-da-rota";
import { classifyAIError } from "@/lib/ai/errors";
import { prepareStreamWithFallback } from "@/lib/ai/stream-fallback";
import { brandPromptContext } from "@/lib/brandville/context";
import { evaluateChatInitialText } from "@/lib/ai/chat-quality";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);
const CHAT_TIMEOUT_MS = 60_000;

export const maxDuration = 120;


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
  const body = await request.json().catch(() => null);
  const recebidas = body?.messages as ModelMessage[] | undefined;
  // Histórico limitado pelas duas pontas antes de qualquer outra coisa: as
  // últimas mensagens, cada uma cortada por tamanho. Uma única mensagem colada
  // estouraria o orçamento e as outras deixariam de caber.
  const messages = recebidas ? limitarMensagens(recebidas) : undefined;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "invalid_input", message: isEnglish ? "Send at least one message." : "Envie ao menos uma mensagem." }, { status: 400 });
  }

  let attempts: ResolvedChatAttempt[];
  let firstChunkTimeoutMs: number;
  let trechos: Trecho[] = [];
  let brandPrompt;
  try {
    /*
     * O portão do G1, no servidor.
     *
     * Ele resolve a marca E aplica a matriz: a marca precisa ter contratado o
     * assistente, e quem pergunta precisa ao menos consultar. A navegação já
     * esconde o link de quem não pode — mas esconder um link não fecha a rota,
     * e quem souber a URL chegava aqui do mesmo jeito.
     */
    const portao = await portaoDeIA(request, "chat");
    if (!portao.ok) return portao.resposta;
    brandPrompt = brandPromptContext(portao.brand);

    /*
     * A recuperação, e não o manual inteiro.
     *
     * A busca é sobre a ÚLTIMA pergunta de quem escreve, não sobre a conversa
     * toda: buscar sobre o histórico inteiro traz os assuntos já encerrados e
     * afoga a pergunta atual — a recuperação pioraria quanto mais longa a
     * conversa, que é o oposto do esperado.
     *
     * `brand.id` vai como parâmetro à função de busca, que é `security
     * invoker`. Não existe filtro para errar aqui.
     */
    const recuperacao = await buscarTrechos(
      portao.auth.supabase,
      portao.brand.id,
      perguntaDasMensagens(messages ?? []),
    );
    // A falha da busca interrompe AQUI, antes de resolver o roteamento e antes
    // de qualquer chamada ao provedor.
    if (!recuperacao.ok) return conhecimentoIndisponivel();
    trechos = recuperacao.trechos;
    const routing = await resolveChatRouting();
    attempts = routing.attempts;
    firstChunkTimeoutMs = routing.timeoutMs;
  } catch (error) {
    const { code, message, detalheTecnico } = classifyAIError(error);
    // O detalhe fica no log do servidor. A resposta leva só a mensagem de
    // produto — ela atravessa a rede e aparece na tela.
    console.error(JSON.stringify({ level: "error", msg: "ai_error", code, detalheTecnico }));
    return NextResponse.json({ error: code, message }, { status: 503 });
  }

  try {
    const prepared = await prepareStreamWithFallback({
      attempts,
      firstChunkTimeoutMs,
      parentSignal: request.signal,
      validateInitialText: evaluateChatInitialText,
      start: (attempt, abortSignal) =>
        streamText({
          model: getModel(attempt.config),
          system: buildChatSystemPrompt(trechos, brandPrompt),
          messages,
          providerOptions: getChatProviderOptions(attempt.config),
          abortSignal,
          timeout: { totalMs: CHAT_TIMEOUT_MS },
          maxRetries: 0,
          onError: ({ error }) => {
            console.error(`[api/ai/chat] ${attempt.config.provider}/${attempt.config.model}`, error);
          },
        }).textStream,
    });

    let firstChunk = prepared.firstChunk;
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (firstChunk) {
            controller.enqueue(encoder.encode(firstChunk));
            firstChunk = "";
            return;
          }

          const next = await prepared.iterator.next();
          if (next.done) {
            prepared.cleanup();
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(next.value));
        } catch (error) {
          prepared.cleanup();
          controller.error(error);
        }
      },
      async cancel(reason) {
        prepared.cancel(reason);
        prepared.cleanup();
        if (prepared.iterator.return) await prepared.iterator.return();
      },
    });

    const selected = prepared.attempt;
    const response = new Response(responseStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    response.headers.set("X-AI-Demo-Mode", selected.isDemo ? "true" : "false");
    response.headers.set("X-AI-Provider", selected.config.provider);
    response.headers.set("X-AI-Model", selected.config.model);
    response.headers.set("X-AI-Fallback-Used", prepared.fallbackUsed ? "true" : "false");
    return response;
  } catch (error) {
    const rootError = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
    const { code, message, detalheTecnico } = classifyAIError(rootError);
        console.error(JSON.stringify({ level: "error", msg: "ai_error", code, detalheTecnico }));
    return NextResponse.json({ error: code, message }, { status: 502 });
  }
}
