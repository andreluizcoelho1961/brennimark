import { APICallError } from "ai";
import { PRODUCT_LOCALE, inEnglish } from "../../platform/locale";

const isEnglish = inEnglish(PRODUCT_LOCALE);

export type AIErrorCode =
  | "invalid_key"
  | "rate_limited"
  | "model_unavailable"
  | "timed_out"
  | "no_provider"
  | "unknown";

/**
 * O erro do provedor, traduzido — e contido.
 *
 * `message` vai para a tela. `detalheTecnico` vai para o log e NUNCA para a
 * resposta: mensagem de provedor carrega nome de variável de ambiente, caminho
 * de arquivo, fragmento de requisição e, às vezes, parte do prompt — que aqui
 * é o manual de um cliente.
 *
 * O caso que motivou a separação apareceu no primeiro ciclo autenticado: o chat
 * exibiu "No AI provider configured and GROQ_API_KEY is not set. Add
 * GROQ_API_KEY to .env.local…" para quem só queria fazer uma pergunta. Isso
 * ensina a configuração do servidor a quem não administra, e contradiz a
 * política de fronteiras de erro que o Q1 estabeleceu.
 */
export function classifyAIError(
  error: unknown,
): { code: AIErrorCode; message: string; detalheTecnico?: string } {
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
    return { code: "unknown", message: mensagemGenerica(), detalheTecnico: error.message };
  }

  if (error instanceof Error) {
    // Provedor ausente é um estado do PRODUTO, não uma falha técnica: quem
    // consulta precisa saber a quem pedir, e não qual variável falta.
    if (error.name === "SemProvedorDeIA") {
      return {
        code: "no_provider",
        message: isEnglish
          ? "This account's AI isn't set up yet. Ask whoever administers the account to connect a provider."
          : "A IA desta conta ainda não está configurada. Peça a quem administra a conta para conectar um provedor.",
        detalheTecnico: error.message,
      };
    }
    if (error.name === "TimeoutError" || /aborted due to timeout|timed?\s*out|não iniciou a resposta|didn.t start responding/i.test(error.message)) {
      return {
        code: "timed_out",
        message: isEnglish
          ? "The configured AIs took longer than the limit. Try again; if this persists, choose a faster visual AI in settings."
          : "As IAs configuradas demoraram além do limite. Tente novamente; se isso persistir, escolha uma IA visual mais rápida nas configurações.",
      };
    }
    return { code: "unknown", message: mensagemGenerica(), detalheTecnico: error.message };
  }

  return { code: "unknown", message: mensagemGenerica() };
}

function mensagemGenerica(): string {
  return isEnglish
    ? "Couldn't talk to the AI provider. Try again in a moment."
    : "Não foi possível falar com o provedor de IA. Tente de novo em instantes.";
}
