import type { BrandCapability } from "../../platform/capabilities";

/**
 * Quem pode usar o quê, no servidor.
 *
 * A navegação já filtra destinos por capacidade — quem não administra não vê o
 * link de configurações. Isso decide o que APARECE, e nunca decidiu o que é
 * PERMITIDO: quem souber a URL da API chega nela do mesmo jeito, e uma marca
 * que não contratou o assistente respondia perguntas se alguém chamasse a rota
 * direto.
 *
 * Módulo puro: a matriz é a peça que autoriza gasto de IA e leitura de
 * credencial, e precisa ser contável sem subir aplicação nenhuma.
 */

export type Utilidade = "chat" | "analysis" | "history";

export type Veredito =
  | { permitido: true }
  /** Não contratada por esta marca. 404: a funcionalidade não existe aqui. */
  | { permitido: false; motivo: "nao-contratada" }
  /** Contratada, mas não para este papel. 403. */
  | { permitido: false; motivo: "sem-papel" };

/**
 * A marca contratou esta funcionalidade?
 *
 * `utilityLinks` é escolha de quem instalou a marca, declarada na importação.
 * Uma conta pode ter contratado o assistente e não a análise de peças, e o
 * produto precisa respeitar isso onde a decisão tem efeito — que é no servidor,
 * não no menu.
 */
export function marcaOferece(
  utilityLinks: readonly string[] | undefined,
  utilidade: Utilidade,
): boolean {
  return (utilityLinks ?? []).includes(utilidade);
}

/**
 * A matriz do G1.
 *
 *   chat, analysis   consultar, E a marca precisa ter contratado
 *   history          consultar, E contratada
 *
 * `ai-settings` (configurar a IA da conta, só quem administrava) saiu em
 * 29/09/2026: a IA é da plataforma e nenhuma conta a configura (ADR-0008).
 */
export function podeUsar({
  utilidade,
  capabilities,
  utilityLinks,
}: {
  utilidade: Utilidade;
  capabilities: readonly BrandCapability[];
  utilityLinks: readonly string[] | undefined;
}): Veredito {
  // A ordem importa: "não contratada" é respondido antes de "sem papel".
  // O contrário revelaria, a quem não tem papel, quais funcionalidades a marca
  // contratou — pela diferença entre 403 e 404.
  if (!marcaOferece(utilityLinks, utilidade)) {
    return { permitido: false, motivo: "nao-contratada" };
  }
  return capabilities.includes("consultar")
    ? { permitido: true }
    : { permitido: false, motivo: "sem-papel" };
}
