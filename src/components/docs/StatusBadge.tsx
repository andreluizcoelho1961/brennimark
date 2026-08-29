import type { DocStatus } from "@/content/docs";
import { PlatformSurface } from "@/components/shell/PlatformSurface";
import { STATUS_CLASSES, resolveStatusLabels, type StatusLabels } from "./status";

/**
 * O selo é o único lugar da moldura que fala a língua do MANUAL, e não a da
 * interface — e é de propósito.
 *
 * "Pronto", "Rascunho" e "Em construção" descrevem o estado editorial que a
 * marca declara sobre o próprio conteúdo, e a marca pode redefinir esses nomes
 * em `statusLabels`. Traduzir isso para o idioma da interface diria, na tela,
 * algo diferente do que a marca aprovou.
 *
 * Idioma e vocabulário chegam por propriedade, vindos da marca resolvida.
 */
export function StatusBadge({
  status,
  brandLanguage,
  statusLabels,
}: {
  status: DocStatus;
  brandLanguage?: string;
  statusLabels?: StatusLabels;
}) {
  const labels = resolveStatusLabels({ language: brandLanguage ?? "pt-BR", override: statusLabels });

  return (
    <PlatformSurface
      as="span"
      className={`inline-block border px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {labels[status]}
    </PlatformSurface>
  );
}
