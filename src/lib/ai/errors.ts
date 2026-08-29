import { APICallError } from "ai";
import { PRODUCT_LOCALE, inEnglish } from "../../platform/locale";

const isEnglish = inEnglish(PRODUCT_LOCALE);

export type AIErrorCode = "invalid_key" | "rate_limited" | "model_unavailable" | "timed_out" | "unknown";

export function classifyAIError(error: unknown): { code: AIErrorCode; message: string } {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return { code: "invalid_key", message: isEnglish ? "Invalid API key or no permission for this model." : "Chave de API inválida ou sem permissão para esse modelo." };
    }
    if (error.statusCode === 429) {
      return {
        code: "rate_limited",
        message: isEnglish
          ? "Request limit exceeded. If you're in demo mode, configure your own key in Settings — Connect Your AI."
          : "Limite de requisições excedido. Se estiver no modo demo, configure sua própria chave em Configurações — Conecte sua IA.",
      };
    }
    if (error.statusCode === 404) {
      return { code: "model_unavailable", message: isEnglish ? "Model unavailable for this provider/key." : "Modelo indisponível para esse provedor/chave." };
    }
    return { code: "unknown", message: error.message };
  }

  if (error instanceof Error) {
    if (error.name === "TimeoutError" || /aborted due to timeout|timed?\s*out|não iniciou a resposta|didn.t start responding/i.test(error.message)) {
      return {
        code: "timed_out",
        message: isEnglish
          ? "The configured AIs took longer than the limit. Try again; if this persists, choose a faster visual AI in settings."
          : "As IAs configuradas demoraram além do limite. Tente novamente; se isso persistir, escolha uma IA visual mais rápida nas configurações.",
      };
    }
    return { code: "unknown", message: error.message };
  }

  return { code: "unknown", message: isEnglish ? "Unknown error calling the AI provider." : "Erro desconhecido ao chamar o provedor de IA." };
}
