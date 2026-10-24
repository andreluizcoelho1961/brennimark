import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { metadadosDoSite } from "@/components/site/metadados";
import { MolduraDoSite } from "@/components/site/MolduraDoSite";
import { SecoesDaHome } from "@/components/site/SecoesDaHome";
import { IDIOMA_PADRAO_DO_SITE, idiomaDoSiteValido } from "@/lib/site/idiomas";

/**
 * A home do site. Quem já entrou nem chega aqui: o `proxy` leva ao produto.
 *
 * Gerada no deploy (sem ler sessão nem banco): é o mesmo HTML para todos, e o
 * servidor não trabalha a cada visita.
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const idioma = idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE;
  const t = await getTranslations({ locale: idioma, namespace: "site.paginas" });
  return metadadosDoSite({ titulo: t("home.titulo"), descricao: t("home.resumo"), idioma, caminhoPt: "/" });
}

export default function HomeDoSite() {
  return (
    <MolduraDoSite home>
      <main className="home-flow">
        <SecoesDaHome />
      </main>
    </MolduraDoSite>
  );
}
