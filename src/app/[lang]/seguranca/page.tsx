import { ConteudoSeguranca } from "@/components/site/paginas/Seguranca";
import { metadadosDoIdioma, PaginaDoSite } from "@/components/site/PaginaDoSite";

/** Esta página existe em português e em inglês: o título e a prévia de link seguem o idioma do endereço. */
export const generateMetadata = metadadosDoIdioma("seguranca");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoSeguranca />
    </PaginaDoSite>
  );
}
