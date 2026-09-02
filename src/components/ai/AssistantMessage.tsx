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
  ready: "text-platform-success",
  draft: "text-platform-warning",
  pending: "text-platform-text-muted",
};

/**
 * A citação é instrumento de governança, não conteúdo da marca.
 *
 * Ela já usou tokens batizados com o nome do release de um cliente, e dentro de
 * uma conversa sobre a marca de OUTRO cliente isso vestia a procedência com a
 * cor errada. Aqui tudo é `--platform-*`: quem afirma de onde veio a informação
 * fala a linguagem do produto, não a da marca apresentada.
 */
export function AssistantMessage({ content }: { content: string }) {
  const isEnglish = useIsEnglish();
  const statusLabels = useStatusLabels();
  return (
    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-platform-text md:text-base">
      {parseBrandCitations(content, statusLabels).map((segment, index) =>
        segment.type === "text" ? (
          <span key={`text-${index}`}>{segment.value}</span>
        ) : (
          <Link
            key={`citation-${index}`}
            href={segment.path}
            title={isEnglish ? `Open ${segment.title}` : `Abrir ${segment.title}`}
            className="mx-1 inline-flex flex-wrap items-baseline gap-1 border-b border-platform-border font-medium text-platform-text transition-colors hover:border-platform-signal hover:text-platform-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
          >
            <span>{isEnglish ? "Source" : "Fonte"}: {segment.title}</span>
            <span className={`font-display text-[9px] font-bold uppercase tracking-wide ${segment.statusKey ? STATUS_CLASS[segment.statusKey] : "text-platform-text-muted"}`}>
              {segment.status}
            </span>
            <span aria-hidden="true">↗</span>
          </Link>
        ),
      )}
    </p>
  );
}
