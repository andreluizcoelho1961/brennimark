import { ConteudoManifesto } from "@/components/site/paginas/Manifesto";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("manifesto");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoManifesto />
    </PaginaDoSite>
  );
}
