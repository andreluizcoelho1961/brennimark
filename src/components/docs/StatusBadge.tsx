import type { DocStatus } from "@/content/docs";
import { brandvilleInstance } from "@/brandville/config";

const LABEL: Record<DocStatus, string> = {
  ready: "Pronto",
  draft: "Rascunho",
  pending: "Em construção",
};

const LABEL_EN: Record<DocStatus, string> = {
  ready: "Approved",
  draft: "Draft",
  pending: "In progress",
};

const LABEL_CASE: Record<DocStatus, string> = {
  ready: "Documented",
  draft: "Case synthesis",
  pending: "In progress",
};

const CLASS: Record<DocStatus, string> = {
  ready: "border-release-analog-turquoise text-release-analog-turquoise",
  draft: "border-release-analog-blue text-release-analog-blue",
  pending: "border-border-default text-text-secondary",
};

export function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <span
      className={`inline-block border px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wide ${CLASS[status]}`}
    >
      {(brandvilleInstance.key === "hairline" ? LABEL_CASE : brandvilleInstance.metadata.language === "en" ? LABEL_EN : LABEL)[status]}
    </span>
  );
}
