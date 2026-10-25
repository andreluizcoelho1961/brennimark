import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { streamText } from "ai";
import { fimDoFluxo, textoOuErro } from "@/lib/ai/texto-do-fluxo";
import { getModel, getTranscricaoProviderOptions } from "@/lib/ai/provider";
import { resolveChatRouting } from "@/lib/ai/settings";
import { capacidadesDe } from "@/lib/ai/catalogo";
import { lerPaginasVistas, modeloVePaginas } from "@/lib/ai/paginas-para-ver";
import { lerManualInteiro } from "@/lib/ai/manual-inteiro";
import { classifyAIError, semProvedorConfigurado } from "@/lib/ai/errors";
import { inEnglish } from "@/platform/locale";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { executarEmFila, decidirExecucao, mensagemDeBloqueio } from "@/lib/ai/execucao";
import { registrarFalhaNaFila, registrarReservaRecusada } from "@/lib/ai/log-da-fila";
import { createServiceClient } from "@/lib/supabase/service";
import { devolverReserva, esperaDaLeitura } from "@/lib/ai/reserva-da-leitura";
import { portaoDeIA } from "@/lib/brennimark/contexto-da-rota";
import { lerManualDaMarca } from "@/lib/assets/regra-do-manual";
import {
  COLUNAS_DAS_REGRAS_DE_GRID, deLinhaDaRegraDeGrid, instrucoesDoGrid, lerRegrasDeGridDaIA, paginasDoGrid, type RegraDeGrid,
} from "@/lib/grids/regras";

const TEMPO_DA_LEITURA_MS = 90_000;
export const maxDuration = 120;

const recusa = (status: number, error: string, message: string) => NextResponse.json({ error, message }, { status });

/**
 * O Grids do assinante LÊ O GRID no manual (14/10/2026).
 *
 * O mesmo caminho da leitura das regras do logo (Kit, 10/10): o portão do
 * assistente, a fila de IA (só modelos que veem imagem — grid é diagrama), a
 * reserva de orçamento e o razão. Basta CONSULTAR a marca. Grava pelo SISTEMA
 * (`registrar_leitura_das_regras_de_grid`), como rascunho de origem "ia", só
 * nos formatos que ainda não têm regra — nunca sobrescreve. No máximo uma
 * leitura por marca a cada 24 horas, reservada no banco antes de gastar IA.
 */
export async function POST(request: Request) {
  const isEnglish = inEnglish(await idiomaDaSessao());
  const portao = await portaoDeIA(request, "chat");
  if (!portao.ok) return portao.resposta;
  const { auth } = portao;
  const brandId = portao.brand.id;
  const workspaceId = auth.workspaceId;

  const ler = async () => {
    const r = await auth.supabase.from("regras_de_grid").select(COLUNAS_DAS_REGRAS_DE_GRID).eq("brand_id", brandId);
    return r.error ? null : (r.data ?? []).map((l) => deLinhaDaRegraDeGrid(l as Record<string, unknown>)).filter((x): x is RegraDeGrid => x !== null);
  };
  const regras = await ler();
  if (!regras) return recusa(503, "regras_indisponiveis", (isEnglish ? "Couldn't read the rules right now." : "Não foi possível ler as regras agora."));

  const { manual, sourceDocumentId } = await lerManualDaMarca(auth.supabase, workspaceId, brandId);
  if (!manual || !sourceDocumentId) return recusa(409, "sem_manual", (isEnglish ? "This brand doesn't have a manual yet." : "Esta marca ainda não tem manual."));

  const leitura = await lerManualInteiro(auth.supabase, brandId);
  if (!leitura.ok) return recusa(503, "knowledge_unavailable", (isEnglish ? "Couldn't read the manual right now." : "Não foi possível ler o manual agora."));
  const paginas = paginasDoGrid(leitura.trechos).filter((p) => p <= manual.paginas);
  if (paginas.length === 0) {
    return NextResponse.json({ regras, lidas: 0, paginas: [], message: (isEnglish ? "The manual doesn't mention grids or layout on the pages Brennimark read. Grids uses Brennimark's proposal; whoever edits the brand can save the grid for each format." : "O manual não fala de grid nem de diagramação nas páginas que o Brennimark leu. O Grids usa a proposta do Brennimark; quem edita a marca pode guardar o grid de cada formato.") });
  }

  const vistas = await lerPaginasVistas(auth.supabase, sourceDocumentId, paginas);
  if (vistas.length === 0) {
    return recusa(409, "paginas_sem_imagem", (isEnglish ? `Pages ${paginas.join(", ")} haven't been prepared yet. In the manual, first use "Prepare the manual for Vini".` : `As páginas ${paginas.join(", ")} ainda não foram preparadas. No manual, use antes "Preparar o manual para o Vini".`));
  }
  const enviadas = vistas.map((v) => v.pagina);

  let executionId: string | undefined;
  // Desfaz a reserva do teto se a leitura não acontecer (falha da IA, orçamento recusado).
  let devolver: (() => Promise<void>) | null = null;
  try {
    const routing = await resolveChatRouting(workspaceId);
    if (routing.attempts.length === 0) {
      const { code, message } = semProvedorConfigurado(isEnglish);
      return recusa(503, code, message);
    }
    const attempts = routing.attempts.filter((a) => modeloVePaginas(capacidadesDe(a.config.provider, a.config.model)));
    if (attempts.length === 0) {
      return recusa(422, "model_no_vision", (isEnglish ? "Reading the grid is unavailable at the moment. If it continues, talk to Brennimark support." : "A leitura do grid está indisponível no momento. Se continuar, fale com o suporte da Brennimark."));
    }

    executionId = crypto.randomUUID();
    const serviceClient = createServiceClient();
    // Uma leitura por marca a cada 24 h, reservada antes de gastar IA (revisão
    // de segurança do Kit, 10/10/2026): sem isto, cada abertura do Grids numa marca cujo
    // manual não tem as regras pagaria outra leitura.
    const reserva = await serviceClient.rpc("reservar_leitura_das_regras_de_grid", { p_workspace_id: workspaceId, p_brand_id: brandId });
    if (reserva.error) return recusa(503, "reserva_indisponivel", (isEnglish ? "Couldn't read the manual right now." : "Não foi possível ler o manual agora."));
    if (reserva.data !== true) {
      return NextResponse.json({
        regras, lidas: 0, paginas: [], recente: true,
        message: (isEnglish ? "This brand's manual was read in the last 24 hours. Whoever edits the brand can save the grid for each format." : "O manual desta marca foi lido nas últimas 24 horas. Quem edita a marca pode guardar o grid de cada formato."),
      });
    }
    devolver = () => devolverReserva(serviceClient, "leituras_das_regras_de_grid", brandId);
    // O pedido à IA é em português, como os manuais; só os nomes dos formatos vêm do catálogo.
    const instrucoes = instrucoesDoGrid(enviadas, await getTranslations({ locale: "pt-BR", namespace: "ferramentas.grids" }));
    const pedido = {
      workspaceId, brandId, executionId, task: "assist" as const, role: "",
      question: instrucoes, sources: [], imagensDePagina: vistas.length,
    };
    const decisao = await decidirExecucao(
      auth.supabase, serviceClient, auth.user.id, pedido,
      { provider: attempts[0].config.provider, model: attempts[0].config.model },
    );
    if (!decisao.pode) { await devolver?.(); return recusa(503, decisao.motivo, mensagemDeBloqueio(decisao.motivo, isEnglish)); }

    const inicio = Date.now();
    const execucao = await executarEmFila({
      supabase: auth.supabase,
      serviceClient,
      userId: auth.user.id,
      request: pedido,
      attempts,
      primeira: { pricing: decisao.capabilities.pricing!, reservedMicros: decisao.reservedMicros, maxOutputTokens: decisao.maxOutputTokens },
      firstChunkTimeoutMs: esperaDaLeitura(routing.timeoutMs),
      parentSignal: request.signal,
      onAttemptFailure: registrarFalhaNaFila("grids-regras", executionId),
      onReservaRecusada: registrarReservaRecusada("grids-regras", executionId),
      dispatch: (attempt, abortSignal, tetoDeSaida) => {
        const result = streamText({
          model: getModel(attempt.config),
          system: instrucoes,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Transcreva as regras de grid e diagramação destas páginas." },
              ...vistas.map((v) => ({ type: "file" as const, data: v.bytes, mediaType: "image/jpeg" })),
            ],
          }],
          providerOptions: getTranscricaoProviderOptions(attempt.config),
          abortSignal,
          timeout: { totalMs: TEMPO_DA_LEITURA_MS },
          maxOutputTokens: tetoDeSaida,
          maxRetries: 0,
        });
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

    // Só entra o grid que a marca ainda não tem: a identidade é formato × segmento × variante.
    const chave = (x: { formato: string; segmento: string; variante: string }) => `${x.formato}|${x.segmento}|${x.variante}`;
    const existentes = new Set(regras.map(chave));
    const encontradas = lerRegrasDeGridDaIA(texto, enviadas).filter((l) => !existentes.has(chave(l)));
    let lidas = 0;
    for (const l of encontradas) {
      const gravada = await serviceClient.rpc("registrar_leitura_das_regras_de_grid", { p_workspace_id: workspaceId, p_brand_id: brandId, p_regra: l });
      if (gravada.error) {
        console.error(JSON.stringify({ level: "error", msg: "grid_regra_nao_gravada", executionId, formato: l.formato, code: gravada.error.code }));
      } else if (gravada.data === true) {
        lidas += 1;
      }
    }

    console.info(JSON.stringify({
      level: "info", msg: "grids_regras_lidas", executionId, brandId, paginas: enviadas, encontradas: encontradas.length, lidas, ms: Date.now() - inicio,
      provider: execucao.attempt.config.provider, model: execucao.attempt.config.model,
    }));

    return NextResponse.json({ regras: (await ler()) ?? regras, lidas, paginas: enviadas });
  } catch (error) {
    await devolver?.();
    const raiz = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
    const { code, message, detalheTecnico } = classifyAIError(raiz, isEnglish);
    console.error(JSON.stringify({ level: "error", msg: "ai_error", rota: "grids-regras", code, detalheTecnico, executionId }));
    return recusa(502, code, message);
  }
}
