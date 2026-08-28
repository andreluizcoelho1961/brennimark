"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDestinationActive, type ShellSection } from "./navigation";

/**
 * Navegação global do desktop.
 *
 * Ruptura deliberada com a V1, que usava um rail de 64px com códigos de duas
 * letras mais um painel de 256px — dois níveis para uma lista curta, e uma
 * sigla que só significa algo para quem já conhece o produto. Aqui os destinos
 * têm o nome por extenso e uma coluna só.
 *
 * O item ativo é reconhecido por três sinais simultâneos — superfície, peso e
 * um indicador de posição — e nenhum deles é matiz. Estado nunca depende só de
 * cor, e a moldura não tem cor própria para gastar.
 */
export function DesktopSidebar({ sections }: { sections: ShellSection[] }) {
  const pathname = usePathname() ?? "";

  return (
    <nav
      aria-label="Navegação principal"
      className="flex w-[var(--shell-sidebar)] flex-none flex-col gap-[var(--space-shell-5)] overflow-y-auto border-r border-platform-border bg-platform-bg px-[var(--space-shell-3)] py-[var(--space-shell-5)]"
    >
      {sections.map((section) => (
        <div key={section.id} className="flex flex-col gap-[var(--space-shell-1)]">
          <h2 className="px-[var(--space-shell-3)] pb-[var(--space-shell-2)] text-[11px] font-medium tracking-[0.06em] text-platform-text-muted">
            {section.label}
          </h2>
          {section.destinations.map((destination) => {
            const active = isDestinationActive(destination.href, pathname);
            return (
              <Link
                key={destination.href}
                href={destination.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-8 items-center rounded-[var(--radius-control)] px-[var(--space-shell-3)] text-[13px] transition-colors duration-[var(--motion-control)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus ${
                  active
                    ? "bg-platform-signal-soft font-medium text-platform-text"
                    : "font-normal text-platform-text-muted hover:bg-platform-panel hover:text-platform-text"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-platform-signal"
                  />
                )}
                <span className="truncate">{destination.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
