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
  COLUNAS_DAS_REGRAS, chavesQueFaltam, deLinhaDaRegra, instrucoesDasRegras, lerRegrasDaIA, paginasDasRegras, type RegraDoLogo,
} from "@/lib/kit/regras";

const TEMPO_DA_LEITURA_MS = 90_000;
export const maxDuration = 120;

const recusa = (status: number, error: string, message: string) => NextResponse.json({ error, message }, { status });

/**
 * O Kit do assinante LÊ AS REGRAS DO LOGO no manual (10/10/2026).
 *
 * Mesmo caminho da paleta sugerida: o portão do assistente, a fila de IA (só
 * modelos que veem imagem — a área de proteção é diagrama), a reserva de
 * orçamento e o razão. Diferenças:
 *   - basta CONSULTAR a marca: o Kit é de quem trabalha com ela, e a leitura
 *     não altera nada do que uma pessoa respondeu;
 *   - grava pelo SISTEMA (`registrar_leitura_das_regras_do_logo`), como
 *     rascunho de origem "ia", e só nas regras que faltam — nunca sobrescreve;
 *   - no máximo uma leitura por marca a cada 24 horas (reservada no banco
 *     antes de gastar IA); com as regras gravadas, a tela nem pede.
 */
export async function POST(request: Request) {
  const portao = await portaoDeIA(request, "chat");
  if (!portao.ok) return portao.resposta;
  const { auth } = portao;
  const brandId = portao.brand.id;
  const workspaceId = auth.workspaceId;

  const atuais = await auth.supabase.from("regras_do_logo").select(COLUNAS_DAS_REGRAS).eq("brand_id", brandId);
  if (atuais.error) return recusa(503, "regras_indisponiveis", "Não foi possível ler as regras agora.");
  const regras = (atuais.data ?? []).map((l) => deLinhaDaRegra(l as Record<string, unknown>)).filter((x): x is RegraDoLogo => x !== null);
  const faltam = chavesQueFaltam(regras);
  if (faltam.length === 0) return NextResponse.json({ regras, lidas: 0, paginas: [] });

  const { manual, sourceDocumentId } = await lerManualDaMarca(auth.supabase, workspaceId, brandId);
  if (!manual || !sourceDocumentId) return recusa(409, "sem_manual", "Esta marca ainda não tem manual.");

  // As páginas: as que quem edita ligou ao Logotipo valem antes da busca.
  const item = await auth.supabase.from("brand_asset_items").select("regra_paginas")
    .eq("brand_id", brandId).eq("tipo", "logo").order("ordem", { ascending: true }).limit(1).maybeSingle<{ regra_paginas: number[] }>();
  const leitura = await lerManualInteiro(auth.supabase, brandId);
  if (!leitura.ok) return recusa(503, "knowledge_unavailable", "Não foi possível ler o manual agora.");
  const paginas = paginasDasRegras(leitura.trechos, item.data?.regra_paginas ?? []).filter((p) => p <= manual.paginas);
  if (paginas.length === 0) {
    return recusa(422, "regras_nao_encontradas", "Não achei no manual as páginas de área de proteção e redução mínima. Quem edita a marca pode ligá-las ao item Logotipo, nos Materiais.");
  }

  const vistas = await lerPaginasVistas(auth.supabase, sourceDocumentId, paginas);
  if (vistas.length === 0) {
    return recusa(409, "paginas_sem_imagem", `As páginas ${paginas.join(", ")} ainda não foram preparadas. No manual, use antes "Preparar o manual para o Vini".`);
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
      return recusa(422, "model_no_vision", "A leitura das regras está indisponível no momento. Se continuar, fale com o suporte da Brennimark.");
    }

    executionId = crypto.randomUUID();
    const serviceClient = createServiceClient();
    // Uma leitura por marca a cada 24 h, reservada antes de gastar IA (revisão
    // de segurança, 10/10/2026): sem isto, cada abertura do Kit numa marca cujo
    // manual não tem as regras pagaria outra leitura.
    const reserva = await serviceClient.rpc("reservar_leitura_das_regras_do_logo", { p_workspace_id: workspaceId, p_brand_id: brandId });
    if (reserva.error) return recusa(503, "reserva_indisponivel", "Não foi possível ler o manual agora.");
    if (reserva.data !== true) {
      return NextResponse.json({
        regras, lidas: 0, paginas: [], recente: true,
        message: "O manual desta marca foi lido nas últimas 24 horas. Quem edita a marca pode informar as regras que faltam.",
      });
    }
    const instrucoes = instrucoesDasRegras(enviadas);
    const pedido = {
      workspaceId, brandId, executionId, task: "assist" as const, role: "",
      question: instrucoes, sources: [], imagensDePagina: vistas.length,
    };
    const decisao = await decidirExecucao(
      auth.supabase, serviceClient, auth.user.id, pedido,
      { provider: attempts[0].config.provider, model: attempts[0].config.model },
    );
    if (!decisao.pode) return recusa(503, decisao.motivo, mensagemDeBloqueio(decisao.motivo, false));

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
      onAttemptFailure: registrarFalhaNaFila("kit-regras", executionId),
      onReservaRecusada: registrarReservaRecusada("kit-regras", executionId),
      dispatch: (attempt, abortSignal, tetoDeSaida) => {
        const result = streamText({
          model: getModel(attempt.config),
          system: instrucoes,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: "Transcreva as regras de uso do logo destas páginas." },
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

    const encontradas = lerRegrasDaIA(texto, enviadas).filter((l) => faltam.includes(l.chave));
    const lidas: typeof encontradas = [];
    for (const l of encontradas) {
      const gravada = await serviceClient.rpc("registrar_leitura_das_regras_do_logo", {
        p_workspace_id: workspaceId, p_brand_id: brandId, p_chave: l.chave, p_valor: l.valor, p_descricao: l.descricao, p_pagina: l.pagina,
      });
      if (gravada.error) {
        console.error(JSON.stringify({ level: "error", msg: "kit_regra_nao_gravada", executionId, chave: l.chave, code: gravada.error.code }));
      } else if (gravada.data === true) {
        lidas.push(l);
      }
    }

    console.info(JSON.stringify({
      level: "info", msg: "kit_regras_lidas", executionId, brandId, paginas: enviadas, encontradas: encontradas.length, lidas: lidas.length, ms: Date.now() - inicio,
      provider: execucao.attempt.config.provider, model: execucao.attempt.config.model,
    }));

    const depois = await auth.supabase.from("regras_do_logo").select(COLUNAS_DAS_REGRAS).eq("brand_id", brandId);
    return NextResponse.json({
      regras: (depois.data ?? []).map((l) => deLinhaDaRegra(l as Record<string, unknown>)).filter((x): x is RegraDoLogo => x !== null),
      lidas: lidas.length,
      paginas: enviadas,
    });
  } catch (error) {
    const raiz = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
    const { code, message, detalheTecnico } = classifyAIError(raiz);
    console.error(JSON.stringify({ level: "error", msg: "ai_error", rota: "kit-regras", code, detalheTecnico, executionId }));
    return recusa(502, code, message);
  }
}
