import { notFound } from "next/navigation";
import { CategoriaDaAjuda } from "@/components/site/ajuda/CategoriaDaAjuda";
import { metadadosDoSite } from "@/components/site/metadados";
import { PaginaDoSite } from "@/components/site/PaginaDoSite";
import { CATEGORIAS, artigosDaCategoria } from "@/lib/ajuda/artigos";

/** Os artigos de uma categoria. Só existe para categoria com artigo. */
export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIAS.filter((c) => artigosDaCategoria(c.slug).length > 0).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const c = CATEGORIAS.find((x) => x.slug === slug);
  return metadadosDoSite({ titulo: `${c?.titulo ?? "Ajuda"} · Central de ajuda · Brennimark`, descricao: c?.descricao ?? "" });
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
