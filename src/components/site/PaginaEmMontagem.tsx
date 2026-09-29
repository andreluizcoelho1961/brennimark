import type { Metadata } from "next";
import Link from "next/link";
import { paginaDoSite } from "@/lib/site/paginas";
import { Losango } from "./Losango";
import { MolduraDoSite } from "./MolduraDoSite";
import { Titulo } from "./Titulo";

/**
 * Página interna ainda não remontada — fatia 1 do site (29/09/2026).
 *
 * O endereço já é o definitivo, e o menu já leva até ele; o conteúdo do
 * protótipo entra na fatia 2. Até lá, a página diz o que é e devolve ao início.
 */
export function metadadosEmMontagem(slug: string): Metadata {
  return { title: `${paginaDoSite(slug).titulo} · Brennimark` };
}

export function PaginaEmMontagem({ slug }: { slug: string }) {
  const pagina = paginaDoSite(slug);
  return (
    <MolduraDoSite pagina>
      <article className="page on">
        <section className="pg-sec">
          <Losango classe="l1" velocidade={-0.22} />
          <div className="pg-wrap wip" style={{ paddingTop: "72px" }}>
            <p className="crumb">Em montagem</p>
            <Titulo como="h1" className="pg-h1" partes={[`${pagina.titulo}.`]} />
            <p className="pg-lead">Esta página está sendo remontada a partir do protótipo e entra na próxima etapa do site.</p>
            <div className="pg-actions">
              <Link className="btn btn--ghost" href="/">
                Voltar ao início
              </Link>
            </div>
          </div>
        </section>
        <RodapeDaPagina />
      </article>
    </MolduraDoSite>
  );
}

/** Os links do rodapé das páginas, como no protótipo. */
const RODAPE = [
  { slug: "manifesto", rotulo: "Manifesto" },
  { slug: "ajuda", rotulo: "Central de ajuda" },
  { slug: "suporte", rotulo: "Suporte" },
  { slug: "seguranca", rotulo: "Segurança" },
  { slug: "termos", rotulo: "Termos" },
  { slug: "privacidade", rotulo: "Privacidade" },
];

function RodapeDaPagina() {
  return (
    <footer className="site-foot pg-foot">
      <Link className="lockup" href="/" aria-label="Brennimark, voltar ao início">
        <svg viewBox="0 0 750 170" role="img" aria-label="Brennimark">
          <use href="#bm-logo" />
        </svg>
      </Link>
      <nav className="foot-links" aria-label="Institucional">
        {RODAPE.map(({ slug, rotulo }) => (
          <Link key={slug} href={`/${slug}`}>
            {rotulo}
          </Link>
        ))}
      </nav>
      <span>© Brennimark</span>
    </footer>
  );
}
