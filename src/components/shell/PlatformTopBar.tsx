"use client";

import { SeletorDeContexto, type OpcaoDeContexto } from "./SeletorDeContexto";
import { platformIdentity } from "@/platform/identity";
import { useIsEnglish } from "@/platform/locale-client";
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
  brandName,
  contextoAtivo,
  brandDescriptor,
  onOpenSearch,
  onOpenNavigation,
  navigationOpen = false,
  children,
}: {
  userEmail?: string;
  brandName?: string;
  contextoAtivo?: {
    workspaceSlug: string;
    brandKey: string;
    opcoes: readonly OpcaoDeContexto[];
  };
  brandDescriptor?: string;
  navigationOpen?: boolean;
  onOpenSearch?: () => void;
  /** Ausente no desktop, onde a navegação é uma coluna permanente. */
  onOpenNavigation?: () => void;
  children?: React.ReactNode;
}) {
  const isEnglish = useIsEnglish();
  const searchLabel = isEnglish ? "Search" : "Buscar";
  const searchLabelNav = isEnglish ? "Open navigation" : "Abrir navegação";

  return (
    <header
      className="flex h-[calc(var(--shell-topbar)+env(safe-area-inset-top))] flex-none items-center gap-[var(--space-shell-4)] border-b border-platform-border bg-platform-bg pl-[max(env(safe-area-inset-left),var(--space-shell-4))] pr-[max(env(safe-area-inset-right),var(--space-shell-4))] pt-[env(safe-area-inset-top)]"
      aria-label={platformIdentity.displayName}
    >
      {onOpenNavigation && (
        <button
          type="button"
          onClick={onOpenNavigation}
          aria-label={searchLabelNav}
          aria-haspopup="dialog"
          aria-expanded={navigationOpen}
          className="-ml-2 flex h-11 w-11 flex-none items-center justify-center rounded-[var(--radius-control)] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus lg:hidden"
        >
          <span aria-hidden className="text-[15px]">☰</span>
        </button>
      )}

      <span className="flex min-w-0 items-center gap-[var(--space-shell-3)]">
        <span className="truncate text-[13px] font-semibold tracking-tight text-platform-text">
          {platformIdentity.displayName}
        </span>
        {/* Com contexto, o nome da marca É o controle de troca. Sem ele —
            preview local, rota de comparação — continua sendo só rótulo. */}
        {contextoAtivo ? (
          <SeletorDeContexto {...contextoAtivo} />
        ) : (
          <WorkspaceIdentity name={brandName} descriptor={brandDescriptor} />
        )}
      </span>

      <div className="ml-auto flex items-center gap-[var(--space-shell-3)]">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={searchLabel}
          className="flex h-11 w-11 items-center justify-center gap-[var(--space-shell-2)] rounded-[var(--radius-control)] text-platform-text-muted transition-colors duration-[var(--motion-control)] hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus sm:h-8 sm:w-56 sm:justify-start sm:border sm:border-platform-border sm:bg-platform-panel sm:px-[var(--space-shell-3)] sm:text-left sm:text-[13px] sm:hover:border-platform-signal-soft"
        >
          <span aria-hidden>⌕</span>
          <span className="hidden truncate sm:inline">{searchLabel}</span>
          <kbd className="ml-auto hidden font-mono text-[10px] text-platform-text-muted sm:inline">⌘K</kbd>
        </button>
        {userEmail && (
          <span className="hidden max-w-[14rem] truncate font-mono text-[11px] text-platform-text-muted md:inline">
            {userEmail}
          </span>
        )}
        {children}
      </div>
    </header>
  );
}
