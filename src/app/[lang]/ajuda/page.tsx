import { ConteudoAjuda } from "@/components/site/paginas/Ajuda";
import { metadadosDoIdioma, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const generateMetadata = metadadosDoIdioma("ajuda");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoAjuda />
    </PaginaDoSite>
  );
}
