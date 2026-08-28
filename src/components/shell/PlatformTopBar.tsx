"use client";

import { brandvilleInstance } from "@/brandville/config";
import { platformIdentity } from "@/platform/identity";
import { WorkspaceIdentity } from "./WorkspaceIdentity";

/**
 * Barra da plataforma: identidade provisória do produto, contexto da marca,
 * busca e sessão. Altura fixa de 56px.
 *
 * A busca é um campo, não um botão que abre um modal escondido: na V1 a única
 * porta era ⌘K, invisível para quem não conhece o atalho.
 */
export function PlatformTopBar({
  userEmail,
  onOpenSearch,
  children,
}: {
  userEmail?: string;
  onOpenSearch?: () => void;
  children?: React.ReactNode;
}) {
  const isEnglish = brandvilleInstance.metadata.language === "en";
  const searchLabel = isEnglish ? "Search" : "Buscar";

  return (
    <header
      className="flex h-[var(--shell-topbar)] flex-none items-center gap-[var(--space-shell-4)] border-b border-platform-border bg-platform-bg px-[var(--space-shell-4)]"
      aria-label={platformIdentity.displayName}
    >
      <span className="flex min-w-0 items-center gap-[var(--space-shell-3)]">
        <span className="truncate text-[13px] font-semibold tracking-tight text-platform-text">
          {platformIdentity.displayName}
        </span>
        <WorkspaceIdentity />
      </span>

      <div className="ml-auto flex items-center gap-[var(--space-shell-3)]">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-8 w-56 items-center gap-[var(--space-shell-2)] rounded-[var(--radius-control)] border border-platform-border bg-platform-panel px-[var(--space-shell-3)] text-left text-[13px] text-platform-text-muted transition-colors duration-[var(--motion-control)] hover:border-platform-signal-soft hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
        >
          <span aria-hidden>⌕</span>
          <span className="truncate">{searchLabel}</span>
          <kbd className="ml-auto font-mono text-[10px] text-platform-text-muted">⌘K</kbd>
        </button>
        {userEmail && (
          <span className="max-w-[14rem] truncate font-mono text-[11px] text-platform-text-muted">
            {userEmail}
          </span>
        )}
        {children}
      </div>
    </header>
  );
}
