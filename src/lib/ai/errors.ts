import { APICallError } from "ai";
import { PRODUCT_LOCALE, inEnglish } from "../../platform/locale";

const isEnglish = inEnglish(PRODUCT_LOCALE);

export type AIErrorCode =
  | "invalid_key"
  | "rate_limited"
  | "overloaded"
  | "model_unavailable"
  | "timed_out"
  | "request_too_large"
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
/**
 * A resposta para "esta conta não tem IA configurada" — direta, sem exceção.
 *
 * Antes, este estado só era alcançado LANÇANDO um erro nomeado `SemProvedorDeIA`
 * de dentro de `getDemoConfig()`, que por sua vez só existia porque
 * `GROQ_API_KEY` estava ausente — um acidente de variável de ambiente
 * disfarçado de fluxo de controle. O piloto Qwen removeu esse fallback (ver
 * settings.ts); agora "sem perfil configurado" é um RESULTADO que
 * `resolveFeatureRouting` devolve (`attempts: []`), não uma exceção que
 * alguém precisa lançar de propósito para simular.
 *
 * `classifyAIError` continua reconhecendo o erro nomeado `SemProvedorDeIA`,
 * caso algum caminho futuro prefira lançar — mas o caminho direto é este.
 */
export function semProvedorConfigurado(): { code: "no_provider"; message: string } {
  return {
    code: "no_provider",
    message: isEnglish
      ? "This account's AI isn't set up yet. Ask whoever administers the account to connect a provider."
      : "A IA desta conta ainda não está configurada. Peça a quem administra a conta para conectar um provedor.",
  };
}

/**
 * Provedor sobrecarregado — ensaio de 23/09/2026.
 *
 * O Google respondeu "This model is currently experiencing high demand" e a
 * tela disse "não foi possível falar com o provedor", que soa como defeito
 * nosso e não diz o que fazer. Sobrecarga é do PROVEDOR, passa em minutos, e
 * a pessoa precisa saber as duas coisas. 503 é o código do Google para isso
 * ("UNAVAILABLE"); 529 é o da Anthropic; o texto cobre quem manda outro.
 */
const SOBRECARGA = /high demand|overloaded|over capacity|temporarily unavailable|\bUNAVAILABLE\b/i;

/** Groq: "Request too large for model … tokens per minute" (HTTP 413), 23/09/2026. */
const GRANDE_DEMAIS = /request too large|tokens per minute/i;

function sobrecarga(): { code: "overloaded"; message: string } {
  return {
    code: "overloaded",
    message: isEnglish
      ? "The AI model is overloaded right now — high demand at the provider. This usually clears in a few minutes; try again shortly."
      : "O modelo de IA está sobrecarregado agora — alta demanda no provedor. Isso costuma passar em alguns minutos; tente de novo daqui a pouco.",
  };
}

export function classifyAIError(
  error: unknown,
): { code: AIErrorCode; message: string; detalheTecnico?: string } {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 503 || error.statusCode === 529 || SOBRECARGA.test(error.message)) {
      return { ...sobrecarga(), detalheTecnico: error.message };
    }
    if (error.statusCode === 413 || GRANDE_DEMAIS.test(error.message)) {
      return {
        code: "request_too_large",
        message: isEnglish
          ? "This request is larger than the current plan of the AI provider allows per minute. Try again in a minute; if it persists, tell whoever administers the account."
          : "Este pedido passa do que o plano atual do provedor de IA aceita por minuto. Tente de novo daqui a um minuto; se continuar, avise quem administra a conta.",
        detalheTecnico: error.message,
      };
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      return { code: "invalid_key", message: isEnglish ? "Invalid API key or no permission for this model." : "Chave de API inválida ou sem permissão para esse modelo." };
    }
    if (error.statusCode === 429) {
      return {
        code: "rate_limited",
        // Até 23/09 esta frase mandava "configurar a própria chave no modo
        // demo" — um modo que não existe mais, dito a quem só consulta.
        message: isEnglish
          ? "The AI provider's usage limit was reached. Try again in a few minutes; if it persists, tell whoever administers the account."
          : "O limite de uso do provedor de IA foi atingido. Tente de novo em alguns minutos; se continuar, avise quem administra a conta.",
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
      return { ...semProvedorConfigurado(), detalheTecnico: error.message };
    }
    if (SOBRECARGA.test(error.message)) {
      return { ...sobrecarga(), detalheTecnico: error.message };
    }
    if (error.name === "TimeoutError" || /aborted due to timeout|timed?\s*out|não iniciou a resposta|didn.t start responding/i.test(error.message)) {
      return {
        code: "timed_out",
        message: isEnglish
          // Até 23/09 mandava "escolher uma IA visual mais rápida" — sem sentido
          // para a pergunta ou o prompt, e dito a quem não configura nada.
          ? "The AI took too long to start answering. Try again in a moment; the provider may be overloaded."
          : "A IA demorou demais para começar a responder. Tente de novo daqui a pouco; o provedor pode estar sobrecarregado.",
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
