import { ConteudoManual } from "@/components/site/paginas/Manual";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("manual");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoManual />
    </PaginaDoSite>
  );
}
