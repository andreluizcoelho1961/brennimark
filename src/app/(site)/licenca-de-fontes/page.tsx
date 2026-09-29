import { ConteudoLicencaDeFontes } from "@/components/site/paginas/LicencaDeFontes";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("licenca-de-fontes");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoLicencaDeFontes />
    </PaginaDoSite>
  );
}
