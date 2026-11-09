import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { categoriaPorSlug, type Artigo } from "@/lib/ajuda/artigos";
import { renderizarArtigo } from "@/lib/ajuda/markdown";
import { caminhoDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/**
 * Um artigo da Central de ajuda — `/ajuda/<slug>`. O texto é o mesmo do painel
 * "Como usar" dentro das ferramentas: aqui ele aparece inteiro, com os
 * trechos de cada versão (site e marca) identificados.
 */
export async function ArtigoDaAjuda({ artigo }: { artigo: Artigo }) {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.ajuda");
  const rota = (caminho: string) => caminhoDoSite(idioma, caminho);
  const categoria = categoriaPorSlug(artigo.categoria, idioma)!;
  const html = renderizarArtigo(artigo.corpo, "tudo", idioma);
  const ferramenta = artigo.ferramenta ? rota(`/ferramentas/${artigo.ferramenta}`) : null;
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
        <div className="pg-wrap" style={{ paddingTop: "72px" }}>
          <p className="crumb"><Link href={rota("/ajuda")}>{t("central")}</Link> · {categoria.titulo}</p>
          <Titulo como="h1" className="pg-h1" partes={[artigo.titulo]} />
          <p className="pg-lead">{artigo.resumo}</p>
          {ferramenta && <p><Link className="text-link" href={ferramenta}>{t("abrirFerramenta")} <span aria-hidden="true">→</span></Link></p>}
          <div className="ajuda-artigo" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </section>
      <section className="pg-sec">
        <div className="pg-wrap cta-band">
          <Titulo partes={[t("naoAchou")]} />
          <Link className="btn" href={rota("/ajuda#suporte")}>{t("falarSuporte")} <span className="arrow" aria-hidden="true">→</span></Link>
        </div>
      </section>
    </>
  );
}
