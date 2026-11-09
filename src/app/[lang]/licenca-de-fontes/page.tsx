import { ConteudoLicencaDeFontes } from "@/components/site/paginas/LicencaDeFontes";
import { metadadosDoIdioma, PaginaDoSite } from "@/components/site/PaginaDoSite";

/** Esta página existe em português e em inglês: o título e a prévia de link seguem o idioma do endereço. */
export const generateMetadata = metadadosDoIdioma("licenca-de-fontes");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoLicencaDeFontes />
    </PaginaDoSite>
  );
}
