import { ConteudoAjuda } from "@/components/site/paginas/Ajuda";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("ajuda");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoAjuda />
    </PaginaDoSite>
  );
}
