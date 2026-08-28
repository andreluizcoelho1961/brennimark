import { DesktopSidebar } from "./DesktopSidebar";
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
  userEmail,
  children,
}: {
  sections: ShellSection[];
  userEmail?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col bg-platform-bg text-platform-text">
      <PlatformTopBar userEmail={userEmail} />
      <div className="flex min-h-0 flex-1">
        <DesktopSidebar sections={sections} />
        <main className="min-w-0 flex-1 overflow-y-auto p-[var(--space-shell-4)]">
          <div className="mx-auto h-full max-w-[1200px] overflow-hidden rounded-[var(--radius-entry)] border border-platform-border">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
