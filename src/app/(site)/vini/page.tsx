import { ConteudoVini } from "@/components/site/paginas/Vini";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("vini");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoVini />
    </PaginaDoSite>
  );
}
