import type { Metadata } from "next";
import { CoresDoAssinante } from "@/components/ferramentas/CoresDoAssinante";

export const metadata: Metadata = { title: "Cores da marca" };

/**
 * Cores da marca — o Brennimark Cores do assinante (10/10/2026). O acesso à
 * marca é conferido pelo layout; a paleta vem pela sessão.
 */
export default function PaginaDoCores() {
  return (
    <div>
      <div className="border-b border-platform-border px-6 py-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Cores da marca</p>
        <h1 className="mt-1.5 text-[clamp(1.3rem,2.4vw,1.7rem)] font-semibold tracking-tight">Que cor é essa — e é a cor da marca?</h1>
      </div>
      <CoresDoAssinante />
    </div>
  );
}
