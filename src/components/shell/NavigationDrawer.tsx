"use client";

import { useEffect, useRef } from "react";
import { useIsEnglish } from "@/platform/locale-client";
import { NavigationSections } from "./DesktopSidebar";
import type { ShellSection } from "./navigation";
import { NavegacaoDeDocumentos } from "./NavegacaoDeDocumentos";
import type { DocPageEntry } from "@/content/docs";

const FOCAVEIS =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * A navegação do mobile e do tablet.
 *
 * Entra pela borda esquerda, que é de onde a coluna do desktop viria — o
 * movimento diz de onde a coisa vem, em vez de ser enfeite.
 *
 * O foco fica preso enquanto ela está aberta e volta para o botão que a abriu
 * ao fechar. Sem isso, quem navega por teclado ou leitor de tela continua
 * tabulando pelo conteúdo atrás da gaveta — que está visualmente coberto e
 * segue alcançável, o pior dos dois mundos.
 *
 * A rolagem do corpo é travada: no iOS a página de trás rola sob a gaveta e a
 * pessoa perde o lugar onde estava.
 */
export function NavigationDrawer({
  open,
  sections,
  basePath,
  docs = [],
  onClose,
}: {
  open: boolean;
  sections: ShellSection[];
  basePath?: string;
  /** As páginas do manual, para a gaveta oferecer a mesma navegação da barra. */
  docs?: readonly DocPageEntry[];
  onClose: () => void;
}) {
  const isEnglish = useIsEnglish();
  const painelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const painel = painelRef.current;
    painel?.querySelector<HTMLElement>(FOCAVEIS)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !painel) return;

      const focaveis = [...painel.querySelectorAll<HTMLElement>(FOCAVEIS)];
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];

      if (event.shiftKey && document.activeElement === primeiro) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflowAnterior;
      // A devolução do foco é da moldura, não daqui: só ela sabe quando o
      // `inert` saiu, e focar elemento inerte não faz nada. Ver AppShellV2.
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    /*
      Sem `lg:hidden`. A gaveta era escondida por CSS ao passar de 1024px, e
      escondida não é fechada: `modal` continuava "nav", o resto da aplicação
      continuava inerte, e a única coisa capaz de destravar a tela tinha
      sumido. Girar o aparelho com a navegação aberta travava o aplicativo.

      Ela some quando alguém a fecha, e só então. A alternativa — fechar no
      cruzamento do breakpoint — obrigaria a mandar o foco para algum destino
      do desktop, porque o botão que o receberia acabou de desaparecer; é mais
      peça móvel para resolver um problema que não precisa existir.
    */
    <div className="fixed inset-0 z-50">
      {/*
        O véu é suplementar: fechar clicando fora é atalho de mouse, e já
        existem Escape e um botão explícito. Como botão ele entrava na ordem de
        foco e na árvore acessível, anunciando "Fechar navegação" duas vezes e
        gastando uma parada de teclado antes do primeiro destino.
      */}
      <div aria-hidden onClick={onClose} className="absolute inset-0 bg-platform-scrim" />
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-label={isEnglish ? "Main navigation" : "Navegação principal"}
        data-drawer
        className="absolute inset-y-0 left-0 flex w-[min(20rem,85vw)] flex-col gap-[var(--space-shell-5)] overflow-y-auto border-r border-platform-border bg-platform-bg px-[var(--space-shell-3)] pb-[max(env(safe-area-inset-bottom),var(--space-shell-5))] pl-[max(env(safe-area-inset-left),var(--space-shell-3))] pt-[max(env(safe-area-inset-top),var(--space-shell-4))] motion-safe:animate-[gaveta_var(--motion-panel)_var(--ease-shell)]"
      >
        <div className="flex items-center justify-between px-[var(--space-shell-3)]">
          <span className="text-[11px] uppercase tracking-[0.06em] text-platform-text-muted">
            {isEnglish ? "Navigation" : "Navegação"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={isEnglish ? "Close navigation" : "Fechar navegação"}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] text-platform-text-muted hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>
        <NavigationSections sections={sections} basePath={basePath} onNavigate={onClose} />
        {basePath && (
          <NavegacaoDeDocumentos docs={docs} base={basePath} onNavigate={onClose} />
        )}
      </div>
    </div>
  );
}
