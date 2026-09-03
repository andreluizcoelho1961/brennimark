import type { AIProvider } from "./provider";

/**
 * O catálogo de modelos autorizados, e o que cada um sabe fazer.
 *
 * Duas coisas mudam em relação ao que havia:
 *
 * **O modelo passa a ser validado.** A rota de configuração validava o
 * PROVEDOR contra uma lista e aceitava qualquer string em `model`. Uma string
 * arbitrária chegava ao adaptador e daí ao provedor — no melhor caso um erro
 * caro, no pior um modelo que ninguém revisou processando o manual de um
 * cliente. O briefing é explícito: não aceitar qualquer string de modelo
 * enviada pelo cliente.
 *
 * **As capacidades são DECLARADAS, não adivinhadas.** Antes existia um conjunto
 * `VISION_MODELS`, e nada mais: nenhum limite de contexto, nenhum limite de
 * imagem. A interface tinha de supor, e supor errado sobre tamanho de imagem é
 * uma chamada rejeitada depois de a pessoa ter esperado o upload.
 *
 * O que este arquivo NÃO é: uma lista de preços nem uma opinião sobre
 * qualidade. Essa decisão sai do benchmark com a GE, não daqui.
 */
export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  streaming: boolean;
  /** Contexto do modelo, em tokens. Ausente quando o provedor não publica. */
  maxContextTokens?: number;
  /** Maior imagem aceita, em bytes. Ausente quando não há limite documentado. */
  maxImageBytes?: number;
  supportsStructuredOutput?: boolean;
}

export interface ModeloDoCatalogo {
  provider: AIProvider;
  model: string;
  /** Rótulo curto para a interface. O id do modelo não é nome de produto. */
  label: string;
  capabilities: ModelCapabilities;
}

const MB = 1024 * 1024;

/**
 * Conservador por construção.
 *
 * `vision: false` quando não há confirmação — um modelo que recusa imagem
 * devolve erro claro; um modelo que aceita e processa mal devolve um parecer
 * errado sobre a marca de um cliente, com a mesma confiança de um certo.
 */
export const CATALOGO: readonly ModeloDoCatalogo[] = [
  // ─── Groq ────────────────────────────────────────────────────────────────
  {
    provider: "groq", model: "openai/gpt-oss-20b", label: "GPT-OSS 20B",
    capabilities: { text: true, vision: false, streaming: true, maxContextTokens: 131_072 },
  },
  {
    provider: "groq", model: "openai/gpt-oss-120b", label: "GPT-OSS 120B",
    capabilities: { text: true, vision: false, streaming: true, maxContextTokens: 131_072 },
  },
  {
    provider: "groq", model: "qwen/qwen3.6-27b", label: "Qwen 3.6 27B",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 131_072, maxImageBytes: 20 * MB,
    },
  },

  // ─── Anthropic ───────────────────────────────────────────────────────────
  {
    provider: "anthropic", model: "claude-sonnet-5", label: "Claude Sonnet 5",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 200_000, maxImageBytes: 5 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "anthropic", model: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 200_000, maxImageBytes: 5 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "anthropic", model: "claude-opus-4-8", label: "Claude Opus 4.8",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 200_000, maxImageBytes: 5 * MB, supportsStructuredOutput: true,
    },
  },

  // ─── OpenAI ──────────────────────────────────────────────────────────────
  {
    provider: "openai", model: "gpt-5.1", label: "GPT-5.1",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 400_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "openai", model: "gpt-5.1-mini", label: "GPT-5.1 mini",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 400_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "openai", model: "gpt-4o", label: "GPT-4o",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 128_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },

  // ─── Google ──────────────────────────────────────────────────────────────
  {
    provider: "google", model: "gemini-2.5-pro", label: "Gemini 2.5 Pro",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 1_000_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },
  {
    provider: "google", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 1_000_000, maxImageBytes: 20 * MB, supportsStructuredOutput: true,
    },
  },

  // ─── OpenRouter ──────────────────────────────────────────────────────────
  //
  // `openrouter/free` escolhe um modelo disponível a cada chamada. Declaro
  // `vision: true` porque o roteador respeita as capacidades pedidas na
  // requisição, e NÃO declaro contexto nem limite de imagem: eles mudam com o
  // modelo sorteado, e um número aqui seria invenção.
  {
    provider: "openrouter", model: "openrouter/free", label: "OpenRouter — gratuito",
    capabilities: { text: true, vision: true, streaming: true },
  },
  {
    provider: "openrouter", model: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5 (OpenRouter)",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 200_000, maxImageBytes: 5 * MB,
    },
  },
  {
    provider: "openrouter", model: "openai/gpt-5.1", label: "GPT-5.1 (OpenRouter)",
    capabilities: {
      text: true, vision: true, streaming: true,
      maxContextTokens: 400_000, maxImageBytes: 20 * MB,
    },
  },
  {
    provider: "openrouter", model: "meta-llama/llama-4-scout", label: "Llama 4 Scout",
    capabilities: { text: true, vision: false, streaming: true, maxContextTokens: 128_000 },
  },
  /*
   * Estes três já eram usados: estavam no conjunto `VISION_MODELS` e na lista
   * sugerida da tela. Entram no catálogo porque a alternativa seria a tela
   * oferecer o que o catálogo recusa — o produto recusando o que ele mesmo
   * sugeriu. Foi o teste de coerência que os encontrou.
   *
   * Sem limite de imagem declarado: são rotas gratuitas do OpenRouter, cujo
   * modelo efetivo varia, e um número aqui seria invenção.
   */
  {
    provider: "openrouter", model: "google/gemma-4-26b-a4b-it:free", label: "Gemma 4 26B (gratuito)",
    capabilities: { text: true, vision: true, streaming: true },
  },
  {
    provider: "openrouter", model: "qwen/qwen3.5-flash-02-23", label: "Qwen 3.5 Flash",
    capabilities: { text: true, vision: true, streaming: true, maxContextTokens: 128_000 },
  },
  {
    provider: "openrouter", model: "nvidia/nemotron-3-ultra-550b-a55b:free", label: "Nemotron 3 Ultra (gratuito)",
    capabilities: { text: true, vision: true, streaming: true },
  },
];

/** O modelo está autorizado NESTE provedor? */
export function modeloAutorizado(provider: string, model: string): boolean {
  return CATALOGO.some((m) => m.provider === provider && m.model === model);
}

/**
 * As capacidades de um par provedor+modelo, ou `null` se não catalogado.
 *
 * `null` não é "sem capacidade": é "não sei", e quem chama trata como recusa.
 * Devolver um objeto com tudo `false` faria um modelo desconhecido parecer um
 * modelo limitado, e essas duas coisas pedem respostas diferentes.
 */
export function capacidadesDe(provider: string, model: string): ModelCapabilities | null {
  return CATALOGO.find((m) => m.provider === provider && m.model === model)?.capabilities ?? null;
}

/** Os modelos de um provedor, para a interface oferecer — nunca texto livre. */
export function modelosDe(provider: AIProvider): readonly ModeloDoCatalogo[] {
  return CATALOGO.filter((m) => m.provider === provider);
}
