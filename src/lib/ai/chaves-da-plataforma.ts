import type { AIProvider } from "./provider";

/**
 * As chaves de IA da PLATAFORMA — decisão do André, 28/09/2026.
 *
 * A IA é da Brennimark: as chaves moram nas variáveis de ambiente da Vercel,
 * uma por provedor, e NUNCA no banco nem em tela nenhuma. O Console mostra só
 * se a variável existe — nunca o valor, nem um pedaço dele.
 *
 * Na fase de testes (custo zero), as chaves são de contas GRATUITAS: projeto
 * do Google sem faturamento ligado, Groq no plano gratuito.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const VARIAVEL_DA_CHAVE: Record<AIProvider, string> = {
  google: "BRENNIMARK_CHAVE_GOOGLE",
  groq: "BRENNIMARK_CHAVE_GROQ",
  anthropic: "BRENNIMARK_CHAVE_ANTHROPIC",
  openai: "BRENNIMARK_CHAVE_OPENAI",
  openrouter: "BRENNIMARK_CHAVE_OPENROUTER",
  "ollama-cloud": "BRENNIMARK_CHAVE_OLLAMA",
};

/** A chave do provedor, lida do ambiente do servidor — ou `null` se falta. */
export function chaveDaPlataforma(provider: AIProvider, ambiente: Record<string, string | undefined> = process.env): string | null {
  const valor = ambiente[VARIAVEL_DA_CHAVE[provider]]?.trim();
  return valor ? valor : null;
}

/** Quais provedores têm chave — para o Console dizer, sem mostrar valor. */
export function chavesPresentes(ambiente: Record<string, string | undefined> = process.env): Record<AIProvider, boolean> {
  return Object.fromEntries(
    (Object.keys(VARIAVEL_DA_CHAVE) as AIProvider[]).map((p) => [p, chaveDaPlataforma(p, ambiente) !== null]),
  ) as Record<AIProvider, boolean>;
}
