import { ConteudoSuporte } from "@/components/site/paginas/Suporte";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("suporte");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoSuporte />
    </PaginaDoSite>
  );
}
