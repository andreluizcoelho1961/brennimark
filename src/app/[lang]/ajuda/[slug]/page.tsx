import { notFound } from "next/navigation";
import { ArtigoDaAjuda } from "@/components/site/ajuda/ArtigoDaAjuda";
import { metadadosDoSite } from "@/components/site/metadados";
import { PaginaDoSite } from "@/components/site/PaginaDoSite";
import { artigoPorSlug, listarArtigos } from "@/lib/ajuda/artigos";
import { IDIOMA_PADRAO_DO_SITE, idiomaDoSiteValido } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";

/** Um artigo da Central de ajuda. Gerado no build; slug fora da lista é 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return listarArtigos().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const idioma = idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE;
  const artigo = artigoPorSlug(slug, idioma);
  const central = idioma === "en" ? "Help center" : "Central de ajuda";
  return metadadosDoSite({
    titulo: `${artigo?.titulo ?? (idioma === "en" ? "Help" : "Ajuda")} · ${central} · Brennimark`,
    descricao: artigo?.resumo ?? "",
    idioma,
    caminhoPt: `/ajuda/${slug}`,
  });
}

export default async function Pagina({ params }: { params: Promise<{ slug: string }> }) {
  const artigo = artigoPorSlug((await params).slug, await idiomaDoSiteAtual());
  if (!artigo) notFound();
  return (
    <PaginaDoSite>
      <ArtigoDaAjuda artigo={artigo} />
    </PaginaDoSite>
  );
}
