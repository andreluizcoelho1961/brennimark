import Link from "next/link";
import { parseBrandCitations } from "@/lib/ai/citations";
import { useStatusLabels } from "@/platform/brand-vocabulary-client";
import type { DocStatus } from "@/content/docs";
import { useIsEnglish } from "@/platform/locale-client";


/**
 * A cor vem da CHAVE do estado, não do texto dele.
 *
 * Esta tabela era indexada pelo rótulo — PRONTO, READY, e os outros quatro.
 * Uma marca que chamasse o estado de "Documentado" cairia fora da tabela e o
 * selo sairia sem classe nenhuma. O texto é da marca; o significado é do
 * produto, e é ele que decide a cor.
 */
const STATUS_CLASS: Record<DocStatus, string> = {
  ready: "text-release-analog-turquoise",
  draft: "text-release-analog-blue",
  pending: "text-text-secondary",
};

export function AssistantMessage({ content }: { content: string }) {
  const isEnglish = useIsEnglish();
  const statusLabels = useStatusLabels();
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-release-analog-white md:text-base">
      {parseBrandCitations(content, statusLabels).map((segment, index) =>
        segment.type === "text" ? (
          <span key={`text-${index}`}>{segment.value}</span>
        ) : (
          <Link
            key={`citation-${index}`}
            href={segment.path}
            title={isEnglish ? `Open ${segment.title}` : `Abrir ${segment.title}`}
            className="mx-1 inline-flex flex-wrap items-baseline gap-1 border-b border-release-analog-turquoise/50 font-medium text-release-analog-turquoise transition-colors hover:border-release-analog-white hover:text-release-analog-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-release-analog-turquoise"
          >
            <span>{isEnglish ? "Source" : "Fonte"}: {segment.title}</span>
            <span className={`font-display text-[9px] font-bold uppercase tracking-wide ${segment.statusKey ? STATUS_CLASS[segment.statusKey] : "text-text-secondary"}`}>
              {segment.status}
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        ),
      )}
    </p>
  );
}
