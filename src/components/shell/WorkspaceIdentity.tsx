import { brandvilleInstance } from "@/brandville/config";

/**
 * A marca atual aparece como CONTEXTO de trabalho, não como identidade do
 * produto. Por isso um rótulo tipográfico e não um logo: o logo do cliente
 * pertence ao canvas, onde é conteúdo documentado, não assinatura da moldura.
 *
 * Nenhum token da marca entra aqui — se entrasse, a moldura mudaria de cara a
 * cada instalação, que é exatamente o que a V2 existe para impedir.
 */
export function WorkspaceIdentity() {
  return (
    <span className="flex min-w-0 items-center gap-[var(--space-shell-2)]">
      <span
        aria-hidden
        className="h-4 w-px flex-none bg-platform-border"
      />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium leading-tight text-platform-text">
          {brandvilleInstance.brand.name}
        </span>
        <span className="block truncate text-[11px] leading-tight text-platform-text-muted">
          {brandvilleInstance.brand.descriptor}
        </span>
      </span>
    </span>
  );
}
