import { ConteudoNovidades } from "@/components/site/paginas/Novidades";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("novidades");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoNovidades />
    </PaginaDoSite>
  );
}
