import { NextResponse } from "next/server";
import { streamText } from "ai";
import { textoOuErro } from "@/lib/ai/texto-do-fluxo";
import { getChatProviderOptions, getModel } from "@/lib/ai/provider";
import { resolveChatRouting } from "@/lib/ai/settings";
import { marcaDeFim } from "@/lib/ai/fim-da-resposta";
import { idDeConversa } from "@/lib/ai/conversas";
import { guardarTroca } from "@/lib/ai/guardar-conversa";
import { CABECALHO_DE_PAGINAS, codificarMapa, mapaDePaginas } from "@/lib/ai/paginas-citadas";
import { buscarTrechos } from "@/lib/ai/buscar";
import { portaoDeIA } from "@/lib/brandville/contexto-da-rota";
import { classifyAIError, semProvedorConfigurado } from "@/lib/ai/errors";
import { executarComOrcamento, decidirExecucao, mensagemDeBloqueio } from "@/lib/ai/execucao";
import { createServiceClient } from "@/lib/supabase/service";
import {
  CABECALHO_DE_REGRAS, MAX_CARACTERES_DA_DESCRICAO, consultaDoPrompt, ehTipoDePrompt, regrasDosTrechos, regrasPermitidas,
  resumoDasRegras, separarRegras, sistemaDoCopiloto,
} from "@/lib/ai/copiloto";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

/**
 * O copiloto de criação — fatia 4c (ADR-0004 §3.1 e §3.2).
 *
 * Duas etapas, na mesma rota:
 *
 *   `regras`  busca no manual o que governa a peça descrita e devolve a lista,
 *             separada em APROVADAS (entram sozinhas) e RASCUNHOS (só por
 *             escolha). Sem IA e sem custo — é a busca de sempre.
 *   `gerar`   busca DE NOVO, monta o conjunto permitido (aprovadas + os
 *             rascunhos marcados que de fato vieram da busca) e pede ao modelo
 *             um prompt feito só disso.
 *
 * ⚖️ O conteúdo das regras nunca vem do navegador: ele manda só a descrição e
 * os slugs marcados, e o servidor refaz a busca. Um rascunho não marcado nem
 * chega ao modelo — é assim que "só regra aprovada entra em silêncio" deixa de
 * depender de o modelo se comportar.
 *
 * Mesma porta do chat (`portaoDeIA(…, "chat")`): quem consulta a marca também
 * gera prompt (ADR-0004 §3.6), onde o assistente foi contratado. O consumo vai
 * ao razão como operação `prompt` — por marca e por operação (§3.4).
 */
const isEnglish = inEnglish(PRODUCT_LOCALE);
const t = (pt: string, en: string) => (isEnglish ? en : pt);
const PROMPT_TIMEOUT_MS = 60_000;
/**
 * A espera pela PRIMEIRA palavra do prompt: no mínimo 45 s.
 *
 * O copiloto reaproveitava a espera da política do chat (20 s no Ensaio), e
 * compor um prompt a partir de várias seções do manual pesa mais que responder
 * uma pergunta: no ensaio de 23/09 o Gemini passou dos 20 s sem começar.
 * Esperar um pouco mais é melhor que falhar; a política do chat, se maior,
 * continua valendo.
 */
const ESPERA_MINIMA_DO_PROMPT_MS = 45_000;

export const maxDuration = 120;

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);
  const etapa = corpo?.etapa === "gerar" ? "gerar" : corpo?.etapa === "regras" ? "regras" : null;
  const descricao = typeof corpo?.descricao === "string" ? corpo.descricao.trim() : "";
  const tipo = corpo?.tipo;

  if (!etapa) return NextResponse.json({ error: "invalid_input", message: t("Pedido inválido.", "Invalid request.") }, { status: 400 });
  if (!descricao || descricao.length > MAX_CARACTERES_DA_DESCRICAO) {
    return NextResponse.json({
      error: "invalid_input",
      message: t(`Descreva a peça em até ${MAX_CARACTERES_DA_DESCRICAO} caracteres.`, `Describe the piece in up to ${MAX_CARACTERES_DA_DESCRICAO} characters.`),
    }, { status: 400 });
  }
  if (!ehTipoDePrompt(tipo)) {
    return NextResponse.json({ error: "invalid_input", message: t("Escolha imagem, vídeo ou texto.", "Choose image, video or text.") }, { status: 400 });
  }

  let executionId: string | undefined;
  let fimDoProvedor: { unificado: PromiseLike<string>; bruto: PromiseLike<string | undefined> } | null = null;
  try {
    const portao = await portaoDeIA(request, "chat");
    if (!portao.ok) return portao.resposta;

    const recuperacao = await buscarTrechos(portao.auth.supabase, portao.brand.id, consultaDoPrompt(descricao, tipo));
    if (!recuperacao.ok) {
      return NextResponse.json({
        error: "knowledge_unavailable",
        message: t("Não foi possível consultar o manual da marca agora. Tente de novo em instantes.", "The brand manual couldn't be consulted right now. Try again in a moment."),
      }, { status: 503 });
    }
    const regras = regrasDosTrechos(recuperacao.trechos);

    if (etapa === "regras") {
      const { aprovadas, rascunhos } = separarRegras(regras);
      return NextResponse.json(
        { aprovadas: resumoDasRegras(aprovadas), rascunhos: resumoDasRegras(rascunhos) },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const permitidas = regrasPermitidas(regras, corpo?.rascunhos);
    const slugs = new Set(permitidas.map((r) => r.slug));
    const trechosPermitidos = recuperacao.trechos.filter((tr) => slugs.has(tr.documentSlug));

    const routing = await resolveChatRouting(portao.auth.workspaceId);
    if (routing.attempts.length === 0) {
      const { code, message } = semProvedorConfigurado();
      return NextResponse.json({ error: code, message }, { status: 503 });
    }
    const attempts = [routing.attempts[0]];
    executionId = (corpo?.executionId as string | undefined) || crypto.randomUUID();
    const serviceClient = createServiceClient();

    const decisao = await decidirExecucao(
      portao.auth.supabase,
      serviceClient,
      portao.auth.user.id,
      {
        workspaceId: portao.auth.workspaceId, brandId: portao.brand.id, executionId, task: "prompt",
        role: portao.brand.ai.chatRole, question: descricao, sources: trechosPermitidos,
      },
      { provider: attempts[0].config.provider, model: attempts[0].config.model },
    );
    if (!decisao.pode) {
      return NextResponse.json({ error: decisao.motivo, message: mensagemDeBloqueio(decisao.motivo, isEnglish) }, { status: 503 });
    }

    const sistema = sistemaDoCopiloto(permitidas, tipo, portao.brand.brand.name);
    // Medida, não palpite (CLAUDE.md, "instrumentar antes de teorizar"): quanto
    // o provedor levou até a primeira palavra. Sem o texto, que é do cliente.
    const inicioDaEspera = Date.now();
    const execucao = await executarComOrcamento({
      serviceClient,
      userId: portao.auth.user.id,
      executionId,
      pricing: decisao.capabilities.pricing!,
      reservedMicros: decisao.reservedMicros,
      attempts,
      firstChunkTimeoutMs: Math.max(routing.timeoutMs, ESPERA_MINIMA_DO_PROMPT_MS),
      parentSignal: request.signal,
      dispatch: (attempt, abortSignal) => {
        const result = streamText({
          model: getModel(attempt.config),
          system: sistema,
          messages: [{ role: "user", content: descricao }],
          providerOptions: getChatProviderOptions(attempt.config),
          abortSignal,
          timeout: { totalMs: PROMPT_TIMEOUT_MS },
          maxOutputTokens: decisao.maxOutputTokens,
          maxRetries: 0,
          onError: ({ error }) => {
            console.error(`[api/ai/prompt] ${attempt.config.provider}/${attempt.config.model}`, error);
          },
        });
        fimDoProvedor = { unificado: result.finishReason, bruto: result.rawFinishReason };
        return { textStream: textoOuErro(result.fullStream), usage: result.usage };
      },
    });

    console.info(JSON.stringify({
      level: "info", msg: "ai_primeira_palavra", rota: "prompt", ms: Date.now() - inicioDaEspera,
      provider: execucao.attempt.config.provider, model: execucao.attempt.config.model, executionId,
    }));
    let primeiro = execucao.firstChunk;
    // O prompt gerado entra na conversa do autor, com as regras que usou —
    // a trilha que o ADR-0004 §3.5 pede, legível só por quem gerou.
    let promptInteiro = primeiro;
    const conversaId = idDeConversa(corpo?.conversaId);
    const encoder = new TextEncoder();
    const fluxo = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (primeiro) {
            controller.enqueue(encoder.encode(primeiro));
            primeiro = "";
            return;
          }
          const next = await execucao.iterator.next();
          if (next.done) {
            const [motivo, bruto] = await Promise.all([
              Promise.resolve(fimDoProvedor?.unificado ?? "unknown").catch(() => "error"),
              Promise.resolve(fimDoProvedor?.bruto).catch(() => undefined),
            ]);
            const marca = marcaDeFim(motivo);
            if (marca) {
              console.warn(JSON.stringify({ level: "warn", msg: "ai_resposta_incompleta", motivo, motivoDoProvedor: bruto ?? null, executionId }));
              controller.enqueue(encoder.encode(marca));
            }
            if (conversaId) {
              await guardarTroca({
                supabase: portao.auth.supabase, conversaId,
                workspaceId: portao.auth.workspaceId, brandId: portao.brand.id, autor: portao.auth.user.id,
                pergunta: descricao,
                resposta: {
                  conteudo: promptInteiro, tipo: "prompt", regras: resumoDasRegras(permitidas),
                  paginas: mapaDePaginas(trechosPermitidos), incompleta: Boolean(marca),
                },
              });
            }
            execucao.cleanup();
            controller.close();
            return;
          }
          promptInteiro += next.value;
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

    const resposta = new Response(fluxo, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
    resposta.headers.set("X-AI-Execution-Id", executionId);
    // Procedência: quais regras o prompt usou, com status — rascunho escolhido
    // aparece como rascunho. Codificado: o cabeçalho só carrega ASCII.
    resposta.headers.set(CABECALHO_DE_REGRAS, encodeURIComponent(JSON.stringify(resumoDasRegras(permitidas))));
    resposta.headers.set(CABECALHO_DE_PAGINAS, codificarMapa(mapaDePaginas(trechosPermitidos)));
    return resposta;
  } catch (error) {
    const raiz = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
    const { code, message, detalheTecnico } = classifyAIError(raiz);
    console.error(JSON.stringify({ level: "error", msg: "ai_error", rota: "prompt", code, detalheTecnico, executionId }));
    return NextResponse.json({ error: code, message }, { status: 502 });
  }
}
