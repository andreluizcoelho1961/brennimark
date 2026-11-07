import "server-only";
import { generateText } from "ai";
import { getModel, type AIProviderConfig } from "@/lib/ai/provider";
import { classifyAIError, type AIErrorCode } from "@/lib/ai/errors";

/**
 * "Testar conexão" da IA própria (ADR-0009): uma chamada mínima ao provedor, com
 * a chave da agência, para dizer se ela vale. Não manda conteúdo de marca
 * nenhum — só uma palavra — e gasta centavos de fração.
 *
 * Devolve um CÓDIGO, nunca a mensagem do provedor: ela carrega fragmento de
 * requisição e, às vezes, parte da chave. O detalhe técnico vai ao log do
 * servidor sem a chave; a tela traduz o código.
 */
export async function testarConexao(config: AIProviderConfig): Promise<{ ok: true } | { ok: false; code: AIErrorCode }> {
  try {
    await generateText({
      model: getModel(config),
      prompt: "Reply with the single word: ok",
      maxOutputTokens: 16,
      abortSignal: AbortSignal.timeout(20_000),
    });
    return { ok: true };
  } catch (error) {
    const { code, detalheTecnico } = classifyAIError(error, true, "propria");
    console.warn("[ia-propria] teste de conexão falhou", { provedor: config.provider, modelo: config.model, code, detalheTecnico });
    return { ok: false, code };
  }
}
