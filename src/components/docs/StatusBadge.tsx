import type { DocStatus } from "@/content/docs";
import { brandvilleInstance } from "@/brandville/config";
import { PlatformSurface } from "@/components/shell/PlatformSurface";
import { STATUS_CLASSES, resolveStatusLabels } from "./status";

export function StatusBadge({ status }: { status: DocStatus }) {
  const labels = resolveStatusLabels({
    language: brandvilleInstance.metadata.language,
    override: brandvilleInstance.statusLabels,
  });

  return (
    <PlatformSurface
      as="span"
      className={`inline-block border px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wide ${STATUS_CLASSES[status]}`}
    >
      {labels[status]}
    </PlatformSurface>
  );
}
