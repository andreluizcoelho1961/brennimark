import { ConteudoEmpresas } from "@/components/site/paginas/Empresas";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("empresas");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoEmpresas />
    </PaginaDoSite>
  );
}
