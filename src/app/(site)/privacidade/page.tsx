import { ConteudoPrivacidade } from "@/components/site/paginas/Privacidade";
import { metadadosDaPagina, PaginaDoSite } from "@/components/site/PaginaDoSite";

export const metadata = metadadosDaPagina("privacidade");

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoPrivacidade />
    </PaginaDoSite>
  );
}
