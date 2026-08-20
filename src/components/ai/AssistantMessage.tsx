import Link from "next/link";
import { parseBrandCitations, type BrandCitationStatus } from "@/lib/ai/citations";
import { brandvilleInstance } from "@/brandville/config";

const isEnglish = brandvilleInstance.metadata.language === "en";

const STATUS_CLASS: Record<BrandCitationStatus, string> = {
  PRONTO: "text-release-analog-turquoise",
  RASCUNHO: "text-release-analog-blue",
  "EM CONSTRUÇÃO": "text-text-secondary",
  READY: "text-release-analog-turquoise",
  DRAFT: "text-release-analog-blue",
  "IN PROGRESS": "text-text-secondary",
};

export function AssistantMessage({ content }: { content: string }) {
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-release-analog-white md:text-base">
      {parseBrandCitations(content, isEnglish).map((segment, index) =>
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
            <span className={`font-display text-[9px] font-bold uppercase tracking-wide ${STATUS_CLASS[segment.status]}`}>
              {segment.status}
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        ),
      )}
    </p>
  );
}
