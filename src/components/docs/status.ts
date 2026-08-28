import type { DocStatus } from "../../content/docs";

export type StatusLabels = Record<DocStatus, string>;

const PT: StatusLabels = { ready: "Pronto", draft: "Rascunho", pending: "Em construção" };
const EN: StatusLabels = { ready: "Approved", draft: "Draft", pending: "In progress" };

/**
 * Governança na linguagem visual da plataforma, nunca na da marca.
 *
 * O selo pinta o próprio fundo em vez de confiar no que está atrás: ele aparece
 * dentro do canvas, sobre o fundo do cliente, que pode ser branco puro ou preto
 * puro. Sem fundo próprio, a mesma cor de texto seria ilegível em metade das
 * marcas.
 *
 * A cor vem sempre acompanhada do rótulo — estado nunca é indicado só por matiz.
 */
export const STATUS_CLASSES: Record<DocStatus, string> = {
  ready: "bg-platform-panel border-platform-success text-platform-success",
  draft: "bg-platform-panel border-platform-warning text-platform-warning",
  pending: "bg-platform-panel border-platform-border text-platform-text-muted",
};

/**
 * Uma instância pode trazer o próprio vocabulário editorial. O core aplica o
 * que recebe sem saber de qual marca veio — a alternativa era ramificar por
 * `key`, que transforma necessidade de um cliente em regra de produto.
 */
export function resolveStatusLabels({
  language,
  override,
}: {
  language: string;
  override?: StatusLabels;
}): StatusLabels {
  if (override) return override;
  return language === "en" ? EN : PT;
}
