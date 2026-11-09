import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { categoriaPorSlug, artigosDaCategoria } from "@/lib/ajuda/artigos";
import { caminhoDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Os artigos de uma categoria — `/ajuda/categoria/<slug>`. */
export async function CategoriaDaAjuda({ slug }: { slug: string }) {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.ajuda");
  const rota = (caminho: string) => caminhoDoSite(idioma, caminho);
  const categoria = categoriaPorSlug(slug, idioma)!;
  const artigos = artigosDaCategoria(slug, idioma);
  return (
    <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px" }}>
        <p className="crumb"><Link href={rota("/ajuda")}>{t("central")}</Link> · {categoria.titulo}</p>
        <Titulo como="h1" className="pg-h1" partes={[categoria.titulo]} />
        <p className="pg-lead">{categoria.descricao}</p>
        <div className="related" style={{ marginTop: "48px" }}>
          {artigos.map((a) => (
            <Link key={a.slug} className="rel" href={rota(`/ajuda/${a.slug}`)}><b>{a.titulo}</b><span>{a.resumo}</span><em>→</em></Link>
          ))}
        </div>
      </div>
    </section>
  );
}
