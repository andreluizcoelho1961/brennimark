import { ConteudoMateriais } from "@/components/site/paginas/Materiais";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("materiais");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoMateriais />
    </PaginaDoSite>
  );
}
