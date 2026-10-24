import { ConteudoAgencias } from "@/components/site/paginas/Agencias";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("agencias");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoAgencias />
    </PaginaDoSite>
  );
}
