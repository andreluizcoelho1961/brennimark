import type { ReactNode } from "react";
import Link from "next/link";
import { LogoDaPlataforma } from "@/components/shell/LogoDaPlataforma";

/**
 * As ferramentas gratuitas do Brennimark (09/10/2026): páginas públicas, sem
 * login, que rodam inteiras no navegador de quem usa. São a isca do site
 * (especificação do Kit, §6) e usam a moldura da plataforma (`--platform-*`),
 * não a do site: são instrumento, e é assim que o assinante as vê lá dentro.
 */
export default function LayoutDasFerramentas({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-platform-bg text-platform-text">
      <header data-moldura-topo className="flex h-[var(--shell-topbar)] items-center gap-4 border-b border-platform-border px-6">
        <Link href="/" aria-label="Brennimark — página inicial" className="flex items-center">
          <LogoDaPlataforma className="hidden h-[24px] w-auto text-platform-text sm:block" />
          <LogoDaPlataforma soSimbolo className="h-[24px] w-auto sm:hidden" />
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-platform-text-muted">Ferramentas</span>
        <Link href="/assinar" className="ml-auto text-sm text-platform-text-muted underline-offset-4 hover:text-platform-text hover:underline">
          Conhecer os planos
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
