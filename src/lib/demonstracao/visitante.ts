/**
 * O visitante do tour no caminho da IA (fatia 3). Duas regras, no servidor:
 *
 *   1. o visitante só usa o chat do Vini (e as conversas dele); qualquer outra
 *      rota de IA — copiloto de prompts, leitura de regras, sugestão de paleta,
 *      análise de imagem — recusa. Isso é a cerca do "só 2 perguntas, nada de
 *      análise", e não depende de a interface esconder o botão;
 *   2. cada pergunta ao chat passa pelo contador do banco ANTES do provedor.
 *
 * O critério é o mesmo do banco (`private.visitante_do_tour`): `app_metadata.tour`
 * (que só o servidor escreve) ou login anônimo. `user_metadata` nunca vale.
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export type UsuarioDoTour = { app_metadata?: Record<string, unknown> | null; is_anonymous?: boolean | null };

export function ehVisitanteDoTour(usuario: UsuarioDoTour | null | undefined): boolean {
  if (!usuario) return false;
  return usuario.app_metadata?.tour === true || usuario.is_anonymous === true;
}

export type MotivoDoLimite = "esgotado" | "expirado" | "inativo" | "teto_do_dia" | "desconhecido";

/** O banco devolve o motivo em texto; qualquer outra coisa vale como o mais restritivo. */
export function motivoDoContador(retorno: unknown): "ok" | MotivoDoLimite {
  if (retorno === "ok") return "ok";
  if (retorno === "esgotado" || retorno === "expirado" || retorno === "inativo" || retorno === "teto_do_dia") return retorno;
  return "desconhecido";
}

const TEXTOS: Record<MotivoDoLimite, { "pt-BR": string; en: string }> = {
  esgotado: {
    "pt-BR": "Suas perguntas do tour acabaram. Assine o Brennimark para conversar com o Vini sobre a sua marca, sem limite de tour.",
    en: "Your tour questions are used up. Subscribe to Brennimark to talk to Vini about your own brand.",
  },
  expirado: {
    "pt-BR": "O seu tour expirou. Entre de novo para fazer outra visita.",
    en: "Your tour has expired. Enter again for another visit.",
  },
  inativo: {
    "pt-BR": "O tour está em manutenção. Volte em instantes.",
    en: "The tour is under maintenance. Please check back shortly.",
  },
  teto_do_dia: {
    "pt-BR": "O Vini do tour atingiu o limite de perguntas de hoje. Volte amanhã ou fale com a gente.",
    en: "Vini hit today's tour question limit. Come back tomorrow or talk to us.",
  },
  desconhecido: {
    "pt-BR": "Não foi possível usar o tour agora. Tente de novo.",
    en: "We couldn't use the tour right now. Please try again.",
  },
};

export function textoDoLimite(motivo: MotivoDoLimite, ingles: boolean): string {
  return TEXTOS[motivo][ingles ? "en" : "pt-BR"];
}

/** O status HTTP de cada recusa: limite de uso é 429; o resto, 403/503. */
export function statusDoLimite(motivo: MotivoDoLimite): number {
  if (motivo === "esgotado" || motivo === "teto_do_dia") return 429;
  if (motivo === "inativo") return 503;
  return 403;
}

/** O estado que a faixa do tour mostra ("1 de 2"). `null` se o banco não devolveu a forma esperada. */
export function lerEstadoDoTour(data: unknown): { feitas: number; limite: number; restantes: number } | null {
  const linha = Array.isArray(data) ? data[0] : data;
  if (!linha || typeof linha !== "object") return null;
  const { feitas, limite } = linha as { feitas?: unknown; limite?: unknown };
  if (typeof feitas !== "number" || typeof limite !== "number") return null;
  return { feitas, limite, restantes: Math.max(0, limite - feitas) };
}
