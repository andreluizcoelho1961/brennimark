import { NextResponse } from "next/server";
import { streamText, type ModelMessage } from "ai";
import { getChatProviderOptions, getModel } from "@/lib/ai/provider";
import { resolveChatRouting, type ResolvedChatAttempt } from "@/lib/ai/settings";
import { buildChatSystemPrompt } from "@/lib/ai/brand-context";
import { buscarTrechos, perguntaDasMensagens } from "@/lib/ai/buscar";
import { limitarMensagens, type Trecho } from "@/lib/ai/recuperacao";
import { portaoDeIA } from "@/lib/brandville/contexto-da-rota";
import { classifyAIError, semProvedorConfigurado } from "@/lib/ai/errors";
import { executarComOrcamento, decidirExecucao, mensagemDeBloqueio } from "@/lib/ai/execucao";
import { brandPromptContext } from "@/lib/brandville/context";
import type { BrandPromptContext } from "@/lib/ai/brand-context";
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
  let brandPrompt: BrandPromptContext;
  let executionId: string | undefined;
  let maxOutputTokens: number;
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
    // O cliente PODE enviar o próprio execution_id (torna um retry de rede
    // idempotente ponta a ponta, e é o identificador comum entre a
    // requisição, a reserva e o ledger); sem ele, um novo é gerado aqui —
    // sem idempotência entre tentativas, mas sem bloquear o produto
    // enquanto o cliente não manda o seu.
    executionId = (body?.executionId as string | undefined) || crypto.randomUUID();

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
    // Sem perfil configurado, `attempts` vem vazio — resultado, não exceção.
    // Interrompe AQUI: sem isto, `executarComOrcamento` chegaria a
    // `prepareStreamWithFallback` com uma lista vazia e lançaria um erro
    // genérico sem nome, e a pessoa veria "erro desconhecido" em vez da
    // mensagem que diz a quem pedir.
    if (routing.attempts.length === 0) {
      const { code, message } = semProvedorConfigurado();
      return NextResponse.json({ error: code, message }, { status: 503 });
    }
    // Só o primeiro perfil chega a `executarComOrcamento` — ela mesma
    // ignora qualquer outro, mas nem monta a lista maior aqui: a reserva
    // abaixo é calculada para ESTE par provedor+modelo.
    attempts = [routing.attempts[0]];
    firstChunkTimeoutMs = routing.timeoutMs;

    const decisao = await decidirExecucao(
      portao.auth.supabase,
      { workspaceId: portao.auth.workspaceId, brandId: portao.brand.id, executionId, task: "assist", question: perguntaDasMensagens(messages), sources: trechos },
      { provider: attempts[0].config.provider, model: attempts[0].config.model },
    );
    if (!decisao.pode) {
      return NextResponse.json(
        { error: decisao.motivo, message: mensagemDeBloqueio(decisao.motivo, isEnglish) },
        { status: 503 },
      );
    }
    maxOutputTokens = decisao.maxOutputTokens;

    const execucao = await executarComOrcamento({
      supabase: portao.auth.supabase,
      executionId,
      // decidirExecucao só devolve pode:true com preço verificado — a
      // checagem que bloqueia antes de chegar aqui — não-nulo garantido.
      pricing: decisao.capabilities.pricing!,
      reservedMicros: decisao.reservedMicros,
      attempts,
      firstChunkTimeoutMs,
      parentSignal: request.signal,
      validateInitialText: evaluateChatInitialText,
      dispatch: (attempt, abortSignal) => {
        const result = streamText({
          model: getModel(attempt.config),
          system: buildChatSystemPrompt(trechos, brandPrompt),
          messages,
          providerOptions: getChatProviderOptions(attempt.config),
          abortSignal,
          timeout: { totalMs: CHAT_TIMEOUT_MS },
          maxOutputTokens,
          maxRetries: 0,
          onError: ({ error }) => {
            console.error(`[api/ai/chat] ${attempt.config.provider}/${attempt.config.model}`, error);
          },
        });
        return { textStream: result.textStream, usage: result.usage };
      },
    });

    let firstChunk = execucao.firstChunk;
    const encoder = new TextEncoder();
    const responseStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (firstChunk) {
            controller.enqueue(encoder.encode(firstChunk));
            firstChunk = "";
            return;
          }

          const next = await execucao.iterator.next();
          if (next.done) {
            execucao.cleanup();
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(next.value));
        } catch (error) {
          execucao.cleanup();
          controller.error(error);
        }
      },
      async cancel(reason) {
        await execucao.cancel(reason);
        execucao.cleanup();
      },
    });

    const selected = execucao.attempt;
    const response = new Response(responseStream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
    response.headers.set("X-AI-Demo-Mode", selected.isDemo ? "true" : "false");
    response.headers.set("X-AI-Provider", selected.config.provider);
    response.headers.set("X-AI-Model", selected.config.model);
    response.headers.set("X-AI-Fallback-Used", execucao.fallbackUsed ? "true" : "false");
    // O identificador comum entre requisição, reserva e ledger — quem
    // administra consegue rastrear uma execução específica sem precisar de
    // outro id.
    response.headers.set("X-AI-Execution-Id", executionId);
    return response;
  } catch (error) {
    // executarComOrcamento já libera a reserva antes de repassar o erro —
    // este catch cobre tanto as falhas anteriores a ela (portão, busca,
    // roteamento) quanto o que ela deixa passar.
    const rootError = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
    const { code, message, detalheTecnico } = classifyAIError(rootError);
    console.error(JSON.stringify({ level: "error", msg: "ai_error", code, detalheTecnico, executionId }));
    return NextResponse.json({ error: code, message }, { status: 502 });
  }
}
