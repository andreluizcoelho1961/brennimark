/**
 * O captcha da entrada no tour (Cloudflare Turnstile). Quem pula o captcha não
 * ganha usuário nenhum: a rota confere ANTES de criar qualquer coisa.
 *
 * Sem segredo configurado a conferência falha FECHADA em produção (o tour fica
 * indisponível, nunca aberto). Fora de produção usa a chave de teste pública da
 * Cloudflare, que aprova qualquer token, para o desenvolvimento rodar.
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const URL_DE_CONFERENCIA = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Segredo de teste publicado pela Cloudflare: "sempre passa". Só fora de produção. */
export const SEGREDO_DE_TESTE = "1x0000000000000000000000000000000AA";

export type ResultadoDoCaptcha = "ok" | "recusado" | "indisponivel";

export async function conferirTurnstile(
  entrada: { token: unknown; ip: string | null; segredo: string | undefined; producao: boolean },
  buscar: typeof fetch = fetch,
): Promise<ResultadoDoCaptcha> {
  const segredo = entrada.segredo?.trim() || (entrada.producao ? "" : SEGREDO_DE_TESTE);
  if (!segredo) return "indisponivel";
  if (typeof entrada.token !== "string" || entrada.token.length === 0 || entrada.token.length > 2048) return "recusado";

  const corpo = new URLSearchParams({ secret: segredo, response: entrada.token });
  if (entrada.ip) corpo.set("remoteip", entrada.ip);
  try {
    const r = await buscar(URL_DE_CONFERENCIA, { method: "POST", body: corpo, signal: AbortSignal.timeout(5000) });
    if (!r.ok) return "indisponivel";
    const j = (await r.json()) as { success?: unknown } | null;
    return j !== null && typeof j === "object" && j.success === true ? "ok" : "recusado";
  } catch {
    // A Cloudflare fora do ar não é prova de robô, mas também não é prova de gente: o tour espera.
    return "indisponivel";
  }
}
