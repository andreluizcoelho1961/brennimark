import type { Metadata } from "next";
import { AjudaDaFerramenta } from "@/components/ajuda/AjudaDaFerramenta";
import { GridsDoAssinante } from "@/components/ferramentas/GridsDoAssinante";

export const metadata: Metadata = { title: "Grids da marca" };

/**
 * Os Grids da marca — a versão do assinante do Brennimark Grids (14/10/2026).
 * O acesso à marca é conferido pelo layout; as rotas e a RLS decidem o resto.
 */
export default function PaginaDosGrids() {
  return (
    <div>
      <div className="relative border-b border-platform-border px-6 py-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Grids da marca</p>
        <h1 className="mt-1.5 text-[clamp(1.3rem,2.4vw,1.7rem)] font-semibold tracking-tight">O documento pronto para diagramar, com as regras do manual</h1>
        <div className="mt-4 sm:absolute sm:right-6 sm:top-5 sm:mt-0">
          <AjudaDaFerramenta ferramenta="grids" audiencia="marca" />
        </div>
      </div>
      <GridsDoAssinante />
    </div>
  );
}
