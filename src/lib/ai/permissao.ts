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

export type Utilidade = "chat" | "analysis" | "history" | "ai-settings";

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
 *   ai-settings      administrar. Chave e roteamento são governo da conta,
 *                    não uso — e a fatura é de quem administra.
 *
 * `ai-settings` NÃO depende de `utilityLinks`: quem administra configura a
 * conta mesmo que nenhuma marca dela ofereça assistente ainda. Amarrar as duas
 * coisas criaria o ovo e a galinha — configurar a IA exigiria uma marca que já
 * usa IA.
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
  if (utilidade === "ai-settings") {
    return capabilities.includes("administrar")
      ? { permitido: true }
      : { permitido: false, motivo: "sem-papel" };
  }

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
