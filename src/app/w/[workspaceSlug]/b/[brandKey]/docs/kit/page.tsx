import type { Metadata } from "next";
import { KitDoAssinante } from "@/components/ferramentas/KitDoAssinante";

export const metadata: Metadata = { title: "Kit da marca" };

/**
 * O Kit da marca — a versão do assinante do Brennimark Kit (10/10/2026). O
 * acesso à marca é conferido pelo layout; as rotas e a RLS decidem o resto.
 */
export default function PaginaDoKit() {
  return (
    <div>
      <div className="border-b border-platform-border px-6 py-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Kit da marca</p>
        <h1 className="mt-1.5 text-[clamp(1.3rem,2.4vw,1.7rem)] font-semibold tracking-tight">Todos os tamanhos do logo, com as regras do manual</h1>
      </div>
      <KitDoAssinante />
    </div>
  );
}
