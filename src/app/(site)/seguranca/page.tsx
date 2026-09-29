import { ConteudoSeguranca } from "@/components/site/paginas/Seguranca";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("seguranca");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoSeguranca />
    </PaginaDoSite>
  );
}
