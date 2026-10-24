import { ConteudoVini } from "@/components/site/paginas/Vini";
import { metadadosDoIdioma, PaginaDoSite } from "@/components/site/PaginaDoSite";

/** Esta página existe em português e em inglês: o título e a prévia de link seguem o idioma do endereço. */
export const generateMetadata = metadadosDoIdioma("vini");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoVini />
    </PaginaDoSite>
  );
}
