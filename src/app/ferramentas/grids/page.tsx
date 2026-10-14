import type { Metadata } from "next";
import { Grids } from "@/components/ferramentas/Grids";

export const metadata: Metadata = {
  title: "Brennimark Grids — o grid pronto para o InDesign",
  description: "Escolha o formato e o tipo de grid — manuscrito, colunas, modular ou hierárquico, com desconstrução — e baixe o documento pronto para o InDesign. Tudo feito no seu computador.",
  robots: { index: false, follow: false },
};

/**
 * O Brennimark Grids gratuito (13/10/2026). A página é estática: o grid é
 * calculado e o IDML montado no navegador de quem usa.
 */
export default function PaginaDoGrids() {
  return (
    <>
      <div className="border-b border-platform-border px-6 py-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-platform-text-muted">Brennimark Grids</p>
        <h1 className="mt-2 text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-tight">O grid pronto para o InDesign, em qualquer formato</h1>
        <p className="mt-2 max-w-[46rem] text-[15px] leading-relaxed text-platform-text-muted">
          Manuscrito, colunas, modular ou hierárquico — com grid sobreposto e rotacionado. Margens, medianiz, linha de base, sangria e área segura das plataformas, num documento que abre pronto para diagramar. Gratuito, e nada sai do seu computador.
        </p>
      </div>
      <Grids />
    </>
  );
}
