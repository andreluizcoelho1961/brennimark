import { NextResponse } from "next/server";
import { streamText } from "ai";
import { textoOuErro } from "@/lib/ai/texto-do-fluxo";
import { getChatProviderOptions, getModel } from "@/lib/ai/provider";
import { resolveChatRouting } from "@/lib/ai/settings";
import { capacidadesDe } from "@/lib/ai/catalogo";
import { lerPaginasVistas, modeloVePaginas } from "@/lib/ai/paginas-para-ver";
import { lerManualInteiro } from "@/lib/ai/manual-inteiro";
import { classifyAIError, semProvedorConfigurado } from "@/lib/ai/errors";
import { executarEmFila, decidirExecucao, mensagemDeBloqueio } from "@/lib/ai/execucao";
import { registrarFalhaNaFila, registrarReservaRecusada } from "@/lib/ai/log-da-fila";
import { createServiceClient } from "@/lib/supabase/service";
import { portaoDeIA } from "@/lib/brennimark/contexto-da-rota";
import { lerManualDaMarca } from "@/lib/assets/regra-do-manual";
import { COLUNAS_DA_PALETA, deLinha, lerPaleta } from "@/lib/paleta/paleta";
import {
  instrucoesDaSugestao, lerPaginasPedidas, lerSugestao, paginasDaPaleta, soOQueFalta, MAXIMO_DE_PAGINAS_DA_SUGESTAO,
} from "@/lib/paleta/sugestao";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const TEMPO_DA_LEITURA_MS = 90_000;

export const maxDuration = 120;

const t = (en: string, pt: string) => (isEnglish ? en : pt);
const recusa = (status: number, error: string, message: string) => NextResponse.json({ error, message }, { status });

/**
 * A ficha da paleta sugerida pela IA — decisão do André, 27/09/2026.
 *
 * A IA lê as IMAGENS das páginas de cor do manual (#50) e devolve as cores;
 * a rota grava só as que FALTAM na ficha, como rascunho e com origem "ia".
 * Uma pessoa confere e aprova — o banco não deixa a sugestão nascer aprovada.
 *
 * O caminho é o do Vini: o mesmo portão (a marca contratou o assistente), a
 * mesma fila de IA — só os modelos que veem imagem —, a mesma reserva de
 * orçamento e o mesmo razão. Quem pode gravar decide o BANCO (`editar`); a
 * rota confere antes só para não gastar IA com quem vai ser recusado.
 */
export async function POST(request: Request) {
  const portao = await portaoDeIA(request, "chat");
  if (!portao.ok) return portao.resposta;
  const { auth } = portao;
  const brandId = portao.brand.id;
  const workspaceId = auth.workspaceId;

  if (!portao.contexto.capabilities.includes("editar")) {
    return recusa(403, "sem_permissao", t("Only who edits this brand fills the palette.", "Só quem edita esta marca preenche a paleta."));
  }

  const corpo = await request.json().catch(() => null);
  const { manual, sourceDocumentId } = await lerManualDaMarca(auth.supabase, workspaceId, brandId);
  if (!manual || !sourceDocumentId) {
    return recusa(409, "sem_manual", t("This brand has no manual yet.", "Esta marca ainda não tem manual."));
  }

  const pedidas = lerPaginasPedidas(corpo?.paginas, manual.paginas);
  if (!pedidas.ok) {
    const mensagem = pedidas.motivo === "demais"
      ? t(`Up to ${MAXIMO_DE_PAGINAS_DA_SUGESTAO} pages.`, `Até ${MAXIMO_DE_PAGINAS_DA_SUGESTAO} páginas.`)
      : pedidas.motivo === "fora-do-manual"
        ? t(`The manual has ${manual.paginas} pages.`, `O manual tem ${manual.paginas} páginas.`)
        : t("Type page numbers, separated by commas.", "Digite números de página, separados por vírgula.");
    return recusa(400, "paginas_invalidas", mensagem);
  }

  // Sem páginas digitadas, acha a paleta pelo texto já indexado.
  let paginas = pedidas.paginas;
  if (paginas.length === 0) {
    const leitura = await lerManualInteiro(auth.supabase, brandId);
    if (!leitura.ok) {
      return recusa(503, "knowledge_unavailable", t("Couldn't read the manual right now.", "Não foi possível ler o manual agora."));
    }
    paginas = paginasDaPaleta(leitura.trechos);
  }
  if (paginas.length === 0) {
    return recusa(422, "paleta_nao_encontrada", t(
      "Couldn't find the palette pages. Type them (e.g. 21, 22) and try again.",
      "Não achei as páginas da paleta. Digite-as (ex.: 21, 22) e tente de novo.",
    ));
  }

  const vistas = await lerPaginasVistas(auth.supabase, sourceDocumentId, paginas);
  if (vistas.length === 0) {
    return recusa(409, "paginas_sem_imagem", t(
      `Pages ${paginas.join(", ")} aren't prepared yet. In the manual, use "Prepare the manual for Vini" first.`,
      `As páginas ${paginas.join(", ")} ainda não foram preparadas. No manual, use antes "Preparar o manual para o Vini".`,
    ));
  }
  const enviadas = vistas.map((v) => v.pagina);

  let executionId: string | undefined;
  try {
    const routing = await resolveChatRouting(workspaceId);
    if (routing.attempts.length === 0) {
      const { code, message } = semProvedorConfigurado();
      return recusa(503, code, message);
    }
    // Só quem vê imagem lê uma tabela de amostras.
    const attempts = routing.attempts.filter((a) => modeloVePaginas(capacidadesDe(a.config.provider, a.config.model)));
    if (attempts.length === 0) {
      return recusa(422, "model_no_vision", t(
        "None of the configured AIs reads images. Configure one with vision in Settings.",
        "Nenhuma das IAs configuradas lê imagem. Configure uma com visão nas Configurações.",
      ));
    }

    executionId = crypto.randomUUID();
    const serviceClient = createServiceClient();
    const instrucoes = instrucoesDaSugestao(isEnglish, enviadas);
    const pedido = {
      workspaceId, brandId, executionId, task: "assist" as const, role: "",
      question: instrucoes, sources: [], imagensDePagina: vistas.length,
    };
    const decisao = await decidirExecucao(
      auth.supabase, serviceClient, auth.user.id, pedido,
      { provider: attempts[0].config.provider, model: attempts[0].config.model },
    );
    if (!decisao.pode) return recusa(503, decisao.motivo, mensagemDeBloqueio(decisao.motivo, isEnglish));

    const inicio = Date.now();
    const execucao = await executarEmFila({
      supabase: auth.supabase,
      serviceClient,
      userId: auth.user.id,
      request: pedido,
      attempts,
      primeira: { pricing: decisao.capabilities.pricing!, reservedMicros: decisao.reservedMicros, maxOutputTokens: decisao.maxOutputTokens },
      firstChunkTimeoutMs: routing.timeoutMs,
      parentSignal: request.signal,
      onAttemptFailure: registrarFalhaNaFila("paleta", executionId),
      onReservaRecusada: registrarReservaRecusada("paleta", executionId),
      dispatch: (attempt, abortSignal, tetoDeSaida) => {
        const result = streamText({
          model: getModel(attempt.config),
          system: instrucoes,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: t("Transcribe the palette in these pages.", "Transcreva a paleta destas páginas.") },
              ...vistas.map((v) => ({ type: "image" as const, image: v.bytes, mediaType: "image/jpeg" })),
            ],
          }],
          providerOptions: getChatProviderOptions(attempt.config),
          abortSignal,
          timeout: { totalMs: TEMPO_DA_LEITURA_MS },
          maxOutputTokens: tetoDeSaida,
          maxRetries: 0,
        });
        return { textStream: textoOuErro(result.fullStream), usage: result.usage };
      },
    });

    let texto = execucao.firstChunk;
    try {
      while (true) {
        const proximo = await execucao.iterator.next();
        if (proximo.done) break;
        texto += proximo.value;
      }
    } finally {
      execucao.cleanup();
    }

    const sugeridas = lerSugestao(texto, enviadas);
    const atual = await lerPaleta(auth.supabase, brandId);
    if (!atual.ok) {
      return recusa(503, "paleta_indisponivel", t("Couldn't read the current palette.", "Não foi possível ler a ficha atual."));
    }
    const { novas, repetidas } = soOQueFalta(sugeridas, atual.cores);
    const proximaOrdem = atual.cores.reduce((maior, c) => Math.max(maior, c.ordem + 1), 0);

    let gravadas: Record<string, unknown>[] = [];
    if (novas.length > 0) {
      const { data, error } = await auth.supabase.from("paleta_da_marca")
        .insert(novas.map((cor, i) => ({
          workspace_id: workspaceId, brand_id: brandId, ...cor, ordem: proximaOrdem + i, origem: "ia",
        })))
        .select(COLUNAS_DA_PALETA);
      if (error?.code === "42501") {
        return recusa(403, "sem_permissao", t("Only who edits this brand fills the palette.", "Só quem edita esta marca preenche a paleta."));
      }
      if (error || !data) {
        return recusa(500, "falha_ao_gravar", t("Couldn't save the suggested colors.", "Não foi possível guardar as cores sugeridas."));
      }
      gravadas = data as Record<string, unknown>[];
    }

    console.info(JSON.stringify({
      level: "info", msg: "paleta_sugerida", executionId, brandId, paginas: enviadas,
      lidas: sugeridas.length, novas: gravadas.length, repetidas, ms: Date.now() - inicio,
      provider: execucao.attempt.config.provider, model: execucao.attempt.config.model,
    }));

    return NextResponse.json({
      cores: gravadas.map(deLinha),
      lidas: sugeridas.length,
      repetidas,
      paginas: enviadas,
      // Páginas pedidas que não tinham imagem: a tela diz que ficaram de fora.
      semImagem: paginas.filter((p) => !enviadas.includes(p)),
    });
  } catch (error) {
    const raiz = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
    const { code, message, detalheTecnico } = classifyAIError(raiz);
    console.error(JSON.stringify({ level: "error", msg: "ai_error", rota: "paleta", code, detalheTecnico, executionId }));
    return recusa(502, code, message);
  }
}
