import { brandvilleInstance } from "@/brandville/config";
import { platformIdentity } from "@/platform/identity";

export function BrandFooter() {
  return (
    <footer className="px-page-inline py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-xs font-bold uppercase tracking-wider text-release-analog-white">
          {brandvilleInstance.brand.name} — {platformIdentity.displayName}
        </p>
        <p className="text-xs text-text-secondary">
          {brandvilleInstance.legal.footerNotice}
        </p>
      </div>
    </footer>
  );
}
