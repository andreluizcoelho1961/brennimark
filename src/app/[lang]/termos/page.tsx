import { ConteudoTermos } from "@/components/site/paginas/Termos";
import { metadadosDoIdioma, PaginaDoSite } from "@/components/site/PaginaDoSite";

/** Esta página existe em português e em inglês: o título e a prévia de link seguem o idioma do endereço. */
export const generateMetadata = metadadosDoIdioma("termos");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoTermos />
    </PaginaDoSite>
  );
}
