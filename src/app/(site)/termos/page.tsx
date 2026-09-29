import { ConteudoTermos } from "@/components/site/paginas/Termos";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("termos");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoTermos />
    </PaginaDoSite>
  );
}
