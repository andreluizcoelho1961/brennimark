import { ConteudoFonts } from "@/components/site/paginas/Fonts";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("fonts");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoFonts />
    </PaginaDoSite>
  );
}
