import { ConteudoMateriais } from "@/components/site/paginas/Materiais";
import { metadadosDoIdioma, PaginaDoSite } from "@/components/site/PaginaDoSite";

/** Esta página existe em português e em inglês: o título e a prévia de link seguem o idioma do endereço. */
export const generateMetadata = metadadosDoIdioma("materiais");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoMateriais />
    </PaginaDoSite>
  );
}
