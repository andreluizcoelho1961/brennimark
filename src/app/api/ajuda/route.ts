import { NextResponse } from "next/server";
import { artigoPorSlug, listarArtigos } from "@/lib/ajuda/artigos";
import { renderizarArtigo } from "@/lib/ajuda/markdown";

/**
 * A ajuda da moldura (17/10/2026): o painel Ajuda lê os artigos por aqui.
 *
 * `GET /api/ajuda` devolve a lista; `GET /api/ajuda?slug=pessoas-e-acesso`
 * devolve o artigo já em HTML, na visão de quem está DENTRO de uma marca
 * (`audiencia: "marca"`). Fica atrás do login como o resto de `/api`: quem
 * está na moldura já tem sessão, e a Central pública é o site.
 *
 * O texto é conteúdo do repositório, igual para todos — nada aqui lê banco nem
 * depende de quem pergunta.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) {
    return NextResponse.json({
      artigos: listarArtigos().map(({ slug: s, titulo, resumo, categoria }) => ({ slug: s, titulo, resumo, categoria })),
    });
  }
  const artigo = artigoPorSlug(slug);
  if (!artigo) return NextResponse.json({ message: "Artigo não encontrado." }, { status: 404 });
  return NextResponse.json({ slug: artigo.slug, titulo: artigo.titulo, html: renderizarArtigo(artigo.corpo, "marca") });
}
