import { NextResponse } from "next/server";
import { streamText, type ModelMessage } from "ai";
import { getChatProviderOptions, getModel } from "@/lib/ai/provider";
import { resolveChatRouting, type ResolvedChatAttempt } from "@/lib/ai/settings";
import { buildChatSystemPrompt } from "@/lib/ai/brand-context";
import { buscarTrechos, perguntaDasMensagens } from "@/lib/ai/buscar";
import { limitarMensagens, type Trecho } from "@/lib/ai/recuperacao";
import { alvoDaRota } from "@/lib/brandville/contexto-da-rota";
import { getBrandvilleAuthContext } from "@/lib/brandville/server";
import { classifyAIError } from "@/lib/ai/errors";
import { prepareStreamWithFallback } from "@/lib/ai/stream-fallback";
import { resolveWorkspaceContext } from "@/lib/brandville/workspace-context";
import { brandPromptContext } from "@/lib/brandville/context";
import { evaluateChatInitialText } from "@/lib/ai/chat-quality";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

// Mensagem de erro é do produto, não do manual: quem lê é quem está usando o
// Brennimark. Enquanto a preferência de idioma não tem onde ser guardada, o
// padrão do produto responde por todo mundo — e a fonte é uma só.
const isEnglish = inEnglish(PRODUCT_LOCALE);
const CHAT_TIMEOUT_MS = 60_000;

export const maxDuration = 120;

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
    const contexto = await resolveWorkspaceContext(alvoDaRota(request));
    if (!contexto.brand) {
      // Sem marca não há sobre o que responder — e um prompt sem papel nem
      // idioma responderia como se fosse sobre qualquer marca.
      return NextResponse.json(
        { error: "no_brand", message: isEnglish ? "No brand configured yet." : "Nenhuma marca configurada ainda." },
        { status: 409 },
      );
    }
    brandPrompt = brandPromptContext(contexto.brand);

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
    const auth = await getBrandvilleAuthContext(contexto.workspaceSlug ?? undefined);
    if (auth) {
      trechos = await buscarTrechos(
        auth.supabase,
        contexto.brand.id,
        perguntaDasMensagens(messages ?? []),
      );
    }
    const routing = await resolveChatRouting();
    attempts = routing.attempts;
    firstChunkTimeoutMs = routing.timeoutMs;
  } catch (error) {
    const { code, message } = classifyAIError(error);
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
    const { code, message } = classifyAIError(rootError);
    return NextResponse.json({ error: code, message }, { status: 502 });
  }
}
