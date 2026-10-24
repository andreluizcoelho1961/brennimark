import { notFound } from "next/navigation";
import { CategoriaDaAjuda } from "@/components/site/ajuda/CategoriaDaAjuda";
import { metadadosDoSite } from "@/components/site/metadados";
import { PaginaDoSite } from "@/components/site/PaginaDoSite";
import { CATEGORIAS, artigosDaCategoria, categoriaPorSlug } from "@/lib/ajuda/artigos";
import { IDIOMA_PADRAO_DO_SITE, idiomaDoSiteValido } from "@/lib/site/idiomas";

/** Os artigos de uma categoria. Só existe para categoria com artigo. */
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIAS.filter((c) => artigosDaCategoria(c.slug).length > 0).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const idioma = idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE;
  const c = categoriaPorSlug(slug, idioma);
  const central = idioma === "en" ? "Help center" : "Central de ajuda";
  return metadadosDoSite({
    titulo: `${c?.titulo ?? (idioma === "en" ? "Help" : "Ajuda")} · ${central} · Brennimark`,
    descricao: c?.descricao ?? "",
    idioma,
    caminhoPt: `/ajuda/categoria/${slug}`,
  });
}

export default async function Pagina({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  if (!CATEGORIAS.some((c) => c.slug === slug) || artigosDaCategoria(slug).length === 0) notFound();
  return (
    <PaginaDoSite>
      <CategoriaDaAjuda slug={slug} />
    </PaginaDoSite>
  );
}
