import { notFound } from "next/navigation";
import { ArtigoDaAjuda } from "@/components/site/ajuda/ArtigoDaAjuda";
import { metadadosDoSite } from "@/components/site/metadados";
import { PaginaDoSite } from "@/components/site/PaginaDoSite";
import { artigoPorSlug, listarArtigos } from "@/lib/ajuda/artigos";

/** Um artigo da Central de ajuda. Gerado no build; slug fora da lista é 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return listarArtigos().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const artigo = artigoPorSlug((await params).slug);
  return metadadosDoSite({ titulo: `${artigo?.titulo ?? "Ajuda"} · Central de ajuda · Brennimark`, descricao: artigo?.resumo ?? "" });
}

export default async function Pagina({ params }: { params: Promise<{ slug: string }> }) {
  const artigo = artigoPorSlug((await params).slug);
  if (!artigo) notFound();
  return (
    <PaginaDoSite>
      <ArtigoDaAjuda artigo={artigo} />
    </PaginaDoSite>
  );
}
