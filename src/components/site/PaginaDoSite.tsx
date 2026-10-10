import type { Metadata } from "next";
import Link from "next/link";
import { LinksDasFerramentas } from "./LinksDasFerramentas";
import { EMPRESA, ENDERECO_COMPLETO } from "@/lib/site/empresa";
import { paginaDoSite } from "@/lib/site/paginas";
import { metadadosDoSite } from "./metadados";
import { MolduraDoSite } from "./MolduraDoSite";

/**
 * A moldura de toda página interna do site: o documento que rola, o conteúdo
 * da página e o rodapé comum (os 16 rodapés do protótipo eram idênticos).
 */
export function metadadosDaPagina(slug: string): Metadata {
  const { titulo, resumo } = paginaDoSite(slug);
  return metadadosDoSite({ titulo: `${titulo} · Brennimark`, descricao: resumo });
}

export function PaginaDoSite({ children }: { children: React.ReactNode }) {
  return (
    <MolduraDoSite pagina>
      <article className="page on">
        {children}
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
      <LinksDasFerramentas />
      <span className="foot-empresa" data-empresa>
        © Brennimark · {EMPRESA.nome}, {EMPRESA.natureza} · CNPJ {EMPRESA.cnpj} · {ENDERECO_COMPLETO} · {EMPRESA.email}
      </span>
    </footer>
  );
}
