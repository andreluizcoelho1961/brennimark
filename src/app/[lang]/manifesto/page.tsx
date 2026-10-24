import type { Metadata } from "next";
import { ConteudoManifesto } from "@/components/site/paginas/Manifesto";
import { metadadosDaPaginaNoIdioma, PaginaDoSite } from "@/components/site/PaginaDoSite";
import { idiomaDoSiteValido, IDIOMA_PADRAO_DO_SITE } from "@/lib/site/idiomas";

/** O Manifesto existe em português e em inglês: o título e a prévia de link seguem o idioma do endereço. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return metadadosDaPaginaNoIdioma("manifesto", idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE);
}

export default function Pagina() {
  return (
    <PaginaDoSite>
      <ConteudoManifesto />
    </PaginaDoSite>
  );
}
