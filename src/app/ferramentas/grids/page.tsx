import type { Metadata } from "next";
import { Grids } from "@/components/ferramentas/Grids";
import { ConviteDaFerramenta } from "@/components/ferramentas/ConviteDaFerramenta";

export const metadata: Metadata = {
  title: "Brennimark Grids — o grid pronto para o InDesign",
  description: "Escolha o formato e o tipo de grid — manuscrito, colunas, modular ou hierárquico — e baixe o documento pronto para o InDesign. Tudo feito no seu computador.",
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
        <h1 className="mt-2 text-[clamp(1.4rem,2.6vw,1.9rem)] font-semibold tracking-tight">O grid pronto para o InDesign, nos formatos mais usados</h1>
        <p className="mt-2 max-w-[46rem] text-[15px] leading-relaxed text-platform-text-muted">
          Manuscrito, colunas, modular ou hierárquico. Margens, medianiz, linha de base, sangria e área segura das plataformas, num documento que abre pronto para diagramar. Gratuito, com um cadastro rápido na hora de baixar. Nada sai do seu computador.
        </p>
      </div>
      <Grids />
      <ConviteDaFerramenta
        titulo="Com a marca do cliente, o documento já nasce pronto."
        itens={["Logo na área de proteção que o manual define", "Cores aprovadas e estilos de texto com a fonte da marca", "Todos os formatos e a desconstrução em camadas próprias"]}
      />
    </>
  );
}
