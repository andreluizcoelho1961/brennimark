import { ConteudoEmpresas } from "@/components/site/paginas/Empresas";
import { metadadosDoIdioma, PaginaDoSite } from "@/components/site/PaginaDoSite";

/** Esta página existe em português e em inglês: o título e a prévia de link seguem o idioma do endereço. */
export const generateMetadata = metadadosDoIdioma("empresas");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoEmpresas />
    </PaginaDoSite>
  );
}
