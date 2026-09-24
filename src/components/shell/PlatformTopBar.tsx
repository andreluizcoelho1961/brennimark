"use client";

import { SeletorDeContexto, type OpcaoDeContexto } from "./SeletorDeContexto";
import { platformIdentity } from "@/platform/identity";
import { useIsEnglish } from "@/platform/locale-client";
import { WorkspaceIdentity } from "./WorkspaceIdentity";
import { SegmentadoDaMarca } from "./SegmentadoDaMarca";

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
  segmentado,
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
  /**
   * Os endereços do segmentado `Manual │ Materiais │ Complementos`. Sem marca
   * aberta, vêm vazios e o segmentado aparece apagado (plano da interface §2).
   */
  segmentado?: { manual?: string; materiais?: string };
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

      {/*
        A zona do Brennimark: espaço PRÓPRIO, separado da marca aberta por um
        filete — pedido do André em 24/09 ("mais arejado"). Largura fixa em tela
        larga, para o nome da plataforma não andar conforme o nome da marca
        muda; a marca, o segmentado e as ações começam depois dela.
      */}
      <span className="flex h-full flex-none items-center border-r border-platform-border pr-[var(--space-shell-3)] lg:min-w-[11rem] lg:pr-[var(--space-shell-5)]">
        <span className="truncate text-[13px] font-semibold tracking-tight text-platform-text">
          {platformIdentity.displayName}
        </span>
      </span>

      <span className="flex min-w-0 items-center gap-[var(--space-shell-3)]">
        {/* Com contexto, o nome da marca É o controle de troca. Sem ele —
            preview local, rota de comparação — continua sendo só rótulo. */}
        {contextoAtivo ? (
          <SeletorDeContexto {...contextoAtivo} />
        ) : (
          <WorkspaceIdentity name={brandName} descriptor={brandDescriptor} />
        )}
      </span>

      {/* A barra de cima é do CONTEÚDO da marca. Sempre presente, como os
          menus de um aplicativo de desenho: sem marca aberta, apagada. */}
      <div className="hidden md:block">
        <SegmentadoDaMarca manual={segmentado?.manual} materiais={segmentado?.materiais} />
      </div>

      {/*
        O encaixe das ações da tela aberta — no manual: Índice, Buscar, Zoom,
        •••. Fica vazio fora do manual; quem o preenche é a própria tela, por
        portal (`MolduraDoManual.tsx`), e o estado continua com ela.
      */}
      <div id="acoes-da-tela" data-acoes-da-tela className="hidden min-w-0 items-center xl:flex" />

      <div className="ml-auto flex items-center gap-[var(--space-shell-3)]">
        <button
          type="button"
          onClick={onOpenSearch}
          aria-label={searchLabel}
          className="flex h-11 w-11 items-center justify-center gap-[var(--space-shell-2)] rounded-[var(--radius-control)] text-platform-text-muted transition-colors duration-[var(--motion-control)] hover:text-platform-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-platform-focus sm:h-8 sm:w-56 sm:justify-start sm:border sm:border-platform-border sm:bg-platform-panel sm:px-[var(--space-shell-3)] sm:text-left sm:text-[13px] sm:hover:border-platform-signal-soft md:max-[1799px]:w-8 md:max-[1799px]:justify-center md:max-[1799px]:px-0"
        >
          <span aria-hidden>⌕</span>
          {/* De 768 a 1800 px a barra leva o segmentado (e, a partir de 1280, as
              ações do manual): a busca da plataforma fica só no ícone — o ⌘K
              continua valendo. Em 768, com a zona do Brennimark, o texto
              estourava a tela em 15 px (CI de 24/09). A faixa é FECHADA
              (`md:max-[1799px]`): `md:hidden` com `min-[1800px]:inline` dependia
              da ordem das regras, e em produção o `md` venceu — a busca ficou
              no ícone até em 1920 px (ensaio de 24/09). */}
          <span className="hidden truncate sm:inline md:max-[1799px]:hidden">{searchLabel}</span>
          <kbd className="ml-auto hidden font-mono text-[10px] text-platform-text-muted sm:inline md:max-[1799px]:hidden">⌘K</kbd>
        </button>
        {userEmail && (
          <span className="hidden max-w-[14rem] truncate font-mono text-[11px] text-platform-text-muted min-[1800px]:inline">
            {userEmail}
          </span>
        )}
        {children}
      </div>
    </header>
  );
}
