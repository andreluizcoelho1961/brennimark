import { NextResponse } from "next/server";
import { streamText } from "ai";
// Lê o fluxo COMPLETO: o erro do provedor chega a `classifyAIError` em vez de
// virar fluxo vazio (ver `lib/ai/texto-do-fluxo.ts`).
import { textoOuErro } from "@/lib/ai/texto-do-fluxo";
import { getChatProviderOptions, getModel } from "@/lib/ai/provider";
import { classifyAIError } from "@/lib/ai/errors";
import { marcaDaRota } from "@/lib/brandville/contexto-da-rota";
import { createServiceClient } from "@/lib/supabase/service";
import { mensagemDeBloqueio } from "@/lib/ai/execucao";
import {
  PROMPT_DO_TESTE_DE_CONEXAO,
  testarConexaoComOrcamento,
  validarConfiguracaoDoTeste,
} from "@/lib/ai/teste-de-conexao";
import { PRODUCT_LOCALE, inEnglish } from "@/platform/locale";

const isEnglish = inEnglish(PRODUCT_LOCALE);
const TESTE_TIMEOUT_MS = 30_000;

export async function POST(request: Request) {
  // Configuração é governo da conta. A rota resolve também a marca porque o
  // orçamento tem teto por workspace E por marca; aceitar só `?w=` tornaria o
  // custo do teste impossível de atribuir ao segundo teto.
  const contexto = await marcaDaRota(request);
  if (!contexto.ok) return contexto.resposta;
  if (contexto.papel !== "owner") {
    return NextResponse.json({ error: "sem_permissao" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const validacao = validarConfiguracaoDoTeste(body);
  if (!validacao.ok) {
    const message = validacao.motivo === "modelo_nao_catalogado"
      ? mensagemDeBloqueio("modelo_nao_catalogado", isEnglish)
      : (isEnglish ? "Fill in provider, model, and key." : "Preencha provedor, modelo e chave.");
    return NextResponse.json({ ok: false, code: validacao.motivo, message }, { status: 400 });
  }

  const executionId = crypto.randomUUID();
  try {
    const resultado = await testarConexaoComOrcamento({
      supabase: contexto.auth.supabase,
      serviceClient: createServiceClient(),
      userId: contexto.auth.user.id,
      workspaceId: contexto.workspaceId,
      brandId: contexto.brandId,
      executionId,
      config: validacao.config,
      parentSignal: request.signal,
      firstChunkTimeoutMs: TESTE_TIMEOUT_MS,
      dispatch: (config, abortSignal, maxOutputTokens) => {
        const geracao = streamText({
          model: getModel(config),
          prompt: PROMPT_DO_TESTE_DE_CONEXAO,
          providerOptions: getChatProviderOptions(config),
          abortSignal,
          timeout: { totalMs: TESTE_TIMEOUT_MS },
          maxOutputTokens,
          maxRetries: 0,
        });
        return { textStream: textoOuErro(geracao.fullStream), usage: geracao.usage };
      },
    });
    if (!resultado.ok) {
      return NextResponse.json(
        { ok: false, code: resultado.motivo, message: mensagemDeBloqueio(resultado.motivo, isEnglish) },
        { status: 503 },
      );
    }
    const response = NextResponse.json({ ok: true });
    response.headers.set("X-AI-Execution-Id", resultado.executionId);
    return response;
  } catch (error) {
    // A causa está dentro do AggregateError da fila — sem abrir, todo erro
    // virava "não foi possível falar com o provedor" (23/09, Groq 413).
    const raiz = error instanceof AggregateError ? (error.errors.at(-1) ?? error) : error;
    const { code, message, detalheTecnico } = classifyAIError(raiz);
    // Nunca o erro bruto: mensagens de SDK podem conter corpo de requisição.
    // A chave tampouco aparece no objeto estruturado.
    console.error(JSON.stringify({ level: "error", msg: "ai_connection_test_failed", code, detalheTecnico, executionId }));
    return NextResponse.json({ ok: false, code, message }, { status: 200 });
  }
}
