import { NextResponse } from "next/server";
import { streamText } from "ai";
import { fimDoFluxo, textoOuErro } from "@/lib/ai/texto-do-fluxo";
import { getModel, getTranscricaoProviderOptions } from "@/lib/ai/provider";
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
import {
  MAXIMO_DE_PAGINAS_DA_TIPOGRAFIA, instrucoesDaTipografia, lerPaginasPedidas, lerTipografia, lerTipografiaDaIA, paginasDaTipografia,
} from "@/lib/tipografia/tipografia";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const TEMPO_DA_LEITURA_MS = 90_000;
export const maxDuration = 120;

const t = (en: string, pt: string) => (isEnglish ? en : pt);
const recusa = (status: number, error: string, message: string) => NextResponse.json({ error, message }, { status });

/**
 * A IA LÊ A TIPOGRAFIA no manual (14/10/2026) — decisão do André: a fonte da
 * marca vem do manual, conferida e aprovada como a paleta.
 *
 * O caminho é o da sugestão da paleta e da leitura do grid: o portão do
 * assistente, a fila de IA (só modelos que veem imagem — a página de
 * tipografia é espécime), a reserva de orçamento e o razão.
 *
 * Só quem EDITA pede a leitura (é a tela da administração). Grava pelo
 * SISTEMA (`registrar_leitura_da_tipografia`), porque o gatilho do banco faz
 * toda escrita de sessão ser "pessoa": a origem "ia" só existe por ali. Entra
 * como rascunho, só nos usos que ainda não têm fonte — nunca sobrescreve.
 *
 * O teto de uma leitura por marca a cada 24 horas vale quando a IA ACHA as
 * páginas sozinha (o caminho que um clique repetido pagaria de novo). Quem
 * digita as páginas está corrigindo a busca, e passa; o orçamento da conta
 * continua valendo nos dois casos.
 */
export async function POST(request: Request) {
  const portao = await portaoDeIA(request, "chat");
  if (!portao.ok) return portao.resposta;
  const { auth } = portao;
  const brandId = portao.brand.id;
  const workspaceId = auth.workspaceId;

  if (!portao.contexto.capabilities.includes("editar")) {
    return recusa(403, "sem_permissao", t("Only who edits this brand fills the typography.", "Só quem edita esta marca preenche a tipografia."));
  }

  const corpo = await request.json().catch(() => null);
  const { manual, sourceDocumentId } = await lerManualDaMarca(auth.supabase, workspaceId, brandId);
  if (!manual || !sourceDocumentId) {
    return recusa(409, "sem_manual", t("This brand has no manual yet.", "Esta marca ainda não tem manual."));
  }

  const pedidas = lerPaginasPedidas(corpo?.paginas, manual.paginas);
  if (!pedidas.ok) {
    const mensagem = pedidas.motivo === "demais"
      ? t(`Up to ${MAXIMO_DE_PAGINAS_DA_TIPOGRAFIA} pages.`, `Até ${MAXIMO_DE_PAGINAS_DA_TIPOGRAFIA} páginas.`)
      : pedidas.motivo === "fora-do-manual"
        ? t(`The manual has ${manual.paginas} pages.`, `O manual tem ${manual.paginas} páginas.`)
        : t("Type page numbers, separated by commas.", "Digite números de página, separados por vírgula.");
    return recusa(400, "paginas_invalidas", mensagem);
  }
  const digitadas = pedidas.paginas.length > 0;

  let paginas = pedidas.paginas;
  if (!digitadas) {
    const leitura = await lerManualInteiro(auth.supabase, brandId);
    if (!leitura.ok) return recusa(503, "knowledge_unavailable", t("Couldn't read the manual right now.", "Não foi possível ler o manual agora."));
    paginas = paginasDaTipografia(leitura.trechos);
  }
  if (paginas.length === 0) {
    return recusa(422, "tipografia_nao_encontrada", t(
      "Couldn't find the typography pages. Type them (e.g. 30, 31) and try again.",
      "Não achei as páginas de tipografia. Digite-as (ex.: 30, 31) e tente de novo.",
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
    const attempts = routing.attempts.filter((a) => modeloVePaginas(capacidadesDe(a.config.provider, a.config.model)));
    if (attempts.length === 0) {
      return recusa(422, "model_no_vision", t(
        "Typography reading is unavailable right now. If it keeps happening, contact Brennimark support.",
        "A leitura da tipografia está indisponível no momento. Se continuar, fale com o suporte da Brennimark.",
      ));
    }

    executionId = crypto.randomUUID();
    const serviceClient = createServiceClient();
    if (!digitadas) {
      const reserva = await serviceClient.rpc("reservar_leitura_da_tipografia", { p_workspace_id: workspaceId, p_brand_id: brandId });
      if (reserva.error) return recusa(503, "reserva_indisponivel", t("Couldn't read the manual right now.", "Não foi possível ler o manual agora."));
      if (reserva.data !== true) {
        return recusa(429, "leitura_recente", t(
          "The AI already looked for the typography in the last 24 hours. To read again now, type the typography pages.",
          "A IA já procurou a tipografia nas últimas 24 horas. Para ler de novo agora, digite as páginas de tipografia.",
        ));
      }
    }

    const instrucoes = instrucoesDaTipografia(enviadas);
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
    let motivoDoFim: PromiseLike<string> | null = null;
    const execucao = await executarEmFila({
      supabase: auth.supabase,
      serviceClient,
      userId: auth.user.id,
      request: pedido,
      attempts,
      primeira: { pricing: decisao.capabilities.pricing!, reservedMicros: decisao.reservedMicros, maxOutputTokens: decisao.maxOutputTokens },
      firstChunkTimeoutMs: routing.timeoutMs,
      parentSignal: request.signal,
      onAttemptFailure: registrarFalhaNaFila("tipografia", executionId),
      onReservaRecusada: registrarReservaRecusada("tipografia", executionId),
      dispatch: (attempt, abortSignal, tetoDeSaida) => {
        const result = streamText({
          model: getModel(attempt.config),
          system: instrucoes,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Transcreva a tipografia da marca destas páginas." },
              ...vistas.map((v) => ({ type: "file" as const, data: v.bytes, mediaType: "image/jpeg" })),
            ],
          }],
          providerOptions: getTranscricaoProviderOptions(attempt.config),
          abortSignal,
          timeout: { totalMs: TEMPO_DA_LEITURA_MS },
          maxOutputTokens: tetoDeSaida,
          maxRetries: 0,
        });
        motivoDoFim = result.finishReason;
        return { textStream: textoOuErro(result.fullStream), usage: result.usage, fim: fimDoFluxo(result) };
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
    const cortada = (await Promise.resolve(motivoDoFim ?? "unknown").catch(() => "error")) === "length";

    const atual = await lerTipografia(auth.supabase, brandId);
    if (!atual.ok) return recusa(503, "tipografia_indisponivel", t("Couldn't read the current typography.", "Não foi possível ler a tipografia atual."));
    const existentes = new Set(atual.fontes.map((f) => `${f.uso}|${f.segmento}`));
    const encontradas = lerTipografiaDaIA(texto, enviadas);
    const novas = encontradas.filter((f) => !existentes.has(`${f.uso}|${f.segmento}`));
    const proximaOrdem = atual.fontes.reduce((maior, f) => Math.max(maior, f.ordem + 1), 0);

    let lidas = 0;
    for (const [i, f] of novas.entries()) {
      const gravada = await serviceClient.rpc("registrar_leitura_da_tipografia", {
        p_workspace_id: workspaceId, p_brand_id: brandId, p_linha: { ...f, ordem: proximaOrdem + i },
      });
      if (gravada.error) {
        console.error(JSON.stringify({ level: "error", msg: "tipografia_nao_gravada", executionId, uso: f.uso, code: gravada.error.code }));
      } else if (gravada.data === true) {
        lidas += 1;
      }
    }

    console.info(JSON.stringify({
      level: "info", msg: "tipografia_lida", executionId, brandId, paginas: enviadas, digitadas,
      encontradas: encontradas.length, gravadas: lidas, repetidas: encontradas.length - novas.length, cortada, ms: Date.now() - inicio,
      provider: execucao.attempt.config.provider, model: execucao.attempt.config.model,
    }));

    const depois = await lerTipografia(auth.supabase, brandId);
    return NextResponse.json({
      fontes: depois.ok ? depois.fontes : atual.fontes,
      encontradas: encontradas.length,
      lidas,
      repetidas: encontradas.length - novas.length,
      paginas: enviadas,
      cortada,
      semImagem: paginas.filter((p) => !enviadas.includes(p)),
    });
  } catch (error) {
    const raiz = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
    const { code, message, detalheTecnico } = classifyAIError(raiz);
    console.error(JSON.stringify({ level: "error", msg: "ai_error", rota: "tipografia", code, detalheTecnico, executionId }));
    return recusa(502, code, message);
  }
}
