import { ConteudoEntrega } from "@/components/site/paginas/Entrega";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("entrega");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoEntrega />
    </PaginaDoSite>
  );
}
