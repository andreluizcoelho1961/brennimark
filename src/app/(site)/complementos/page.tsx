import { ConteudoComplementos } from "@/components/site/paginas/Complementos";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("complementos");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoComplementos />
    </PaginaDoSite>
  );
}
