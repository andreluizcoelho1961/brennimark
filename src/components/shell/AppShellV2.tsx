"use client";

import { useCallback, useEffect, useState } from "react";
import type { DocPageEntry } from "@/content/docs";
import type { StatusLabels } from "@/components/docs/status";
import { CommandPalette } from "./CommandPalette";
import { DesktopSidebar } from "./DesktopSidebar";
import { NavigationDrawer } from "./NavigationDrawer";
import { PlatformTopBar } from "./PlatformTopBar";
import type { ShellSection } from "./navigation";

/**
 * Moldura V2.
 *
 * A composição não descende do DocsNav: aquela era rail de siglas + painel +
 * conteúdo, com caixa e borda em quase tudo. Aqui são três zonas — barra,
 * navegação, conteúdo — e o conteúdo recebe a maior parte da área.
 *
 * O canvas entra recuado, sobre o fundo da moldura. O vão é estrutural, não
 * decorativo: é ele que garante o limite quando a marca é preta e a moldura
 * também é escura, ou quando a marca é branca. Um filete encostado numa cor
 * saturada vibra; um vão não.
 */
export function AppShellV2({
  sections,
  docs,
  userEmail,
  brandName,
  brandDescriptor,
  brandLanguage,
  statusLabels,
  basePath,
  children,
}: {
  sections: ShellSection[];
  docs: readonly DocPageEntry[];
  userEmail?: string;
  /** Contexto da marca ativa, resolvido pela requisição. A moldura o exibe
   *  como rótulo; nenhum componente daqui vai buscá-lo por conta própria. */
  brandName?: string;
  brandDescriptor?: string;
  /** Vocabulário editorial da marca. A paleta mostra o status das páginas, e
   *  esse rótulo é da marca — ver StatusBadge. */
  brandLanguage?: string;
  statusLabels?: StatusLabels;
  /** Prefixo alternativo para os destinos. Existe para a rota de comparação
   *  manter a navegação dentro da V2; em produção fica ausente e os destinos
   *  são os reais. String, não função: não atravessa a fronteira de servidor
   *  para cliente de outro jeito. */
  basePath?: string;
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const openSearch = useCallback(() => setSearchOpen(true), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  const destinations = sections.flatMap((section) =>
    section.destinations.map((d) => ({ href: d.href, label: d.label })),
  );

  return (
    <div className="flex h-dvh flex-col bg-platform-bg text-platform-text">
      <PlatformTopBar
          userEmail={userEmail}
          brandName={brandName}
          brandDescriptor={brandDescriptor}
          onOpenSearch={openSearch}
          onOpenNavigation={() => setNavOpen(true)}
        />
      <div className="flex min-h-0 flex-1">
        <DesktopSidebar sections={sections} basePath={basePath} />
        <NavigationDrawer
          open={navOpen}
          sections={sections}
          basePath={basePath}
          onClose={() => setNavOpen(false)}
        />
        {/* No mobile o vão estrutural some: 16px de cada lado de uma tela de
            390 é 8% da largura gasta em moldura. O canvas encosta e a borda
            some junto, porque filete em tela cheia não separa nada. */}
        <main className="min-w-0 flex-1 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)] lg:p-[var(--space-shell-4)]">
          <div className="mx-auto h-full max-w-[1200px] overflow-hidden lg:rounded-[var(--radius-entry)] lg:border lg:border-platform-border">
            {children}
          </div>
        </main>
      </div>
      {searchOpen && (
        <CommandPalette
          docs={docs}
          destinations={destinations}
          basePath={basePath}
          brandLanguage={brandLanguage}
          statusLabels={statusLabels}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
