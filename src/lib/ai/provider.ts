import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import { PRODUCT_LOCALE, inEnglish } from "../../platform/locale";
import { CATALOGO, capacidadesDe } from "./catalogo";

const isEnglish = inEnglish(PRODUCT_LOCALE);

export type AIProvider = "groq" | "anthropic" | "openai" | "google" | "openrouter";
export type AIRole = "chat" | "analysis" | "both";
export type AIRoutingFeature = "chat" | "analysis";

export type AIRoutingPolicy = {
  feature: AIRoutingFeature;
  primarySettingId: string | null;
  fallbackSettingId: string | null;
  firstChunkTimeoutMs: number;
  allowCrossProvider: boolean;
  updatedAt?: string;
};

export type AIProviderConfig = {
  provider: AIProvider;
  apiKey: string;
  model: string;
};

export type ModelCommercialInfo = {
  billing: "free" | "paid" | "unknown";
  label: string;
  pricing?: string;
  note?: string;
};

/**
 * Single entry point for turning a provider config into a ready-to-use
 * model instance. Feature code (chat, analysis) must always go through
 * this function — never import an @ai-sdk/* package directly — so that
 * swapping providers is a config change, not a code change.
 */
export function getModel(config: AIProviderConfig): LanguageModel {
  switch (config.provider) {
    case "groq":
      return createGroq({ apiKey: config.apiKey })(config.model);
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey })(config.model);
    case "openai":
      return createOpenAI({ apiKey: config.apiKey })(config.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey })(config.model);
    case "openrouter":
      return createOpenRouter({ apiKey: config.apiKey })(config.model);
    default: {
      const exhaustive: never = config.provider;
      throw new Error(`Unknown AI provider: ${exhaustive}`);
    }
  }
}

/** Provider-specific latency controls kept behind the provider boundary. */
export function getChatProviderOptions(config: AIProviderConfig) {
  if (config.provider !== "groq") return undefined;

  return {
    groq: {
      reasoningFormat: "hidden" as const,
      reasoningEffort: config.model.startsWith("qwen/") ? ("none" as const) : ("low" as const),
    },
  };
}

export const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: "groq", label: "Groq" },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "google", label: "Google" },
  { value: "openrouter", label: "OpenRouter" },
];

/** Suggested models per provider, shown in the settings dropdown. */
export const PROVIDER_MODELS: Record<AIProvider, string[]> = {
  groq: ["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"],
  anthropic: ["claude-sonnet-5", "claude-haiku-4-5-20251001", "claude-opus-4-8"],
  openai: ["gpt-5.1", "gpt-5.1-mini", "gpt-4o"],
  google: ["gemini-2.5-pro", "gemini-2.5-flash"],
  openrouter: [
    "openrouter/free",
    "google/gemma-4-26b-a4b-it:free",
    "qwen/qwen3.5-flash-02-23",
    "anthropic/claude-sonnet-5",
    "openai/gpt-5.1",
    "meta-llama/llama-4-scout",
  ],
};

/**
 * Visão, pelo CATÁLOGO.
 *
 * Havia aqui um `VISION_MODELS` — um conjunto de nomes paralelo à lista de
 * modelos sugeridos. Dois lugares declarando fatos sobre o mesmo modelo é uma
 * chance de discordarem, e a discordância aqui manda imagem para um modelo que
 * não a processa, ou recusa um que processaria.
 *
 * Modelo fora do catálogo devolve `false`: não sei, logo não mando imagem.
 */
export function supportsVision(config: Pick<AIProviderConfig, "model"> & { provider?: string }): boolean {
  if (config.provider) return capacidadesDe(config.provider, config.model)?.vision ?? false;
  // Sem provedor declarado, aceita se ALGUM provedor catalogado oferece visão
  // naquele modelo. É o caminho antigo, e some quando o perfil carregar o par.
  return CATALOGO.some((m) => m.model === config.model && m.capabilities.vision);
}


const MODEL_COMMERCIAL_INFO: Record<string, ModelCommercialInfo> = isEnglish
  ? {
      "openrouter:openrouter/free": {
        billing: "free",
        label: "Free",
        note: "OpenRouter picks an available free model; quality and availability may vary.",
      },
      "openrouter:google/gemma-4-26b-a4b-it:free": {
        billing: "free",
        label: "Free",
        note: "Free vision model recommended as fallback; subject to OpenRouter limits.",
      },
      "openrouter:qwen/qwen3.5-flash-02-23": {
        billing: "paid",
        label: "Paid · fast vision",
        pricing: "Input: $0.065 / 1M tokens · output: $0.26 / 1M tokens.",
        note: "OpenRouter reference checked on 2026-07-21. Actual cost depends on image and response size.",
      },
    }
  : {
      "openrouter:openrouter/free": {
        billing: "free",
        label: "Gratuito",
        note: "A OpenRouter escolhe um modelo gratuito disponível; qualidade e disponibilidade podem variar.",
      },
      "openrouter:google/gemma-4-26b-a4b-it:free": {
        billing: "free",
        label: "Gratuito",
        note: "Modelo visual gratuito recomendado como reserva; sujeito aos limites da OpenRouter.",
      },
      "openrouter:qwen/qwen3.5-flash-02-23": {
        billing: "paid",
        label: "Pago · visual rápido",
        pricing: "Entrada: US$ 0,065 / 1 milhão de tokens · saída: US$ 0,26 / 1 milhão de tokens.",
        note: "Referência da OpenRouter consultada em 21/07/2026. O valor real depende do tamanho da imagem e da resposta.",
      },
    };

export function getModelCommercialInfo(
  provider: AIProvider,
  model: string
): ModelCommercialInfo {
  const known = MODEL_COMMERCIAL_INFO[`${provider}:${model}`];
  if (known) return known;
  if (model === "openrouter/free" || model.endsWith(":free")) {
    return isEnglish
      ? { billing: "free", label: "Free", note: "Subject to the provider's limits and availability." }
      : { billing: "free", label: "Gratuito", note: "Sujeito aos limites e à disponibilidade do provedor." };
  }
  return isEnglish
    ? {
        billing: provider === "openrouter" ? "paid" : "unknown",
        label: provider === "openrouter" ? "May incur charges" : "Charges depend on your plan",
        note: "Confirm pricing and limits directly with the provider before use.",
      }
    : {
        billing: provider === "openrouter" ? "paid" : "unknown",
        label: provider === "openrouter" ? "Pode gerar cobrança" : "Cobrança depende do seu plano",
        note: "Confirme o preço e os limites diretamente no provedor antes de usar.",
      };
}

export function requiresBillingConsent(provider: AIProvider, model: string): boolean {
  return getModelCommercialInfo(provider, model).billing !== "free";
}

export const DEMO_PROVIDER: AIProvider = "groq";
export const DEMO_MODEL = "openai/gpt-oss-20b";
export const DEMO_FALLBACK_MODEL = "openai/gpt-oss-120b";
