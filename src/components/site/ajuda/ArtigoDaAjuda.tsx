import Link from "next/link";
import { CATEGORIAS, type Artigo } from "@/lib/ajuda/artigos";
import { renderizarArtigo } from "@/lib/ajuda/markdown";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/**
 * Um artigo da Central de ajuda — `/ajuda/<slug>`. O texto é o mesmo do painel
 * "Como usar" dentro das ferramentas: aqui ele aparece inteiro, com os
 * trechos de cada versão (site e marca) identificados.
 */
export function ArtigoDaAjuda({ artigo }: { artigo: Artigo }) {
  const categoria = CATEGORIAS.find((c) => c.slug === artigo.categoria)!;
  const html = renderizarArtigo(artigo.corpo, "tudo");
  const ferramenta = artigo.ferramenta ? `/ferramentas/${artigo.ferramenta}` : null;
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
        <div className="pg-wrap" style={{ paddingTop: "72px" }}>
          <p className="crumb"><Link href="/ajuda">Central de ajuda</Link> · {categoria.titulo}</p>
          <Titulo como="h1" className="pg-h1" partes={[artigo.titulo]} />
          <p className="pg-lead">{artigo.resumo}</p>
          {ferramenta && <p><Link className="text-link" href={ferramenta}>Abrir a ferramenta gratuita <span aria-hidden="true">→</span></Link></p>}
          <div className="ajuda-artigo" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </section>
      <section className="pg-sec">
        <div className="pg-wrap cta-band">
          <Titulo partes={["Não achou? Fale com o suporte."]} />
          <Link className="btn" href="/suporte">Falar com o suporte <span className="arrow" aria-hidden="true">→</span></Link>
        </div>
      </section>
    </>
  );
}
