import { ConteudoStudio } from "@/components/site/paginas/Studio";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("studio");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoStudio />
    </PaginaDoSite>
  );
}
