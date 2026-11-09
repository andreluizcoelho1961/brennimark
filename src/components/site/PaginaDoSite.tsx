import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinksDasFerramentas } from "./LinksDasFerramentas";
import { EMPRESA } from "@/lib/site/empresa";
import { paginaDoSite } from "@/lib/site/paginas";
import { IDIOMA_PADRAO_DO_SITE, caminhoDoSite, idiomaDoSiteValido, type IdiomaDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";
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

/**
 * Os metadados de uma página que tem mais de um idioma: título e descrição do
 * catálogo, `og:locale` do idioma e os endereços equivalentes (`hreflang`), que
 * valem quando o site sair de trás do `noindex`.
 */
/**
 * `generateMetadata` pronto para a página de pasta `slug`: o título e a prévia
 * de link seguem o idioma do endereço. É o que toda página traduzida exporta.
 */
export function metadadosDoIdioma(slug: string) {
  return async ({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> => {
    const { lang } = await params;
    return metadadosDaPaginaNoIdioma(slug, idiomaDoSiteValido(lang) ? lang : IDIOMA_PADRAO_DO_SITE);
  };
}

export async function metadadosDaPaginaNoIdioma(slug: string, idioma: IdiomaDoSite): Promise<Metadata> {
  const t = await getTranslations({ locale: idioma, namespace: "site.paginas" });
  return metadadosDoSite({
    titulo: `${t(`${slug}.titulo`)} · Brennimark`,
    descricao: t(`${slug}.resumo`),
    idioma,
    caminhoPt: `/${slug}`,
  });
}

export async function PaginaDoSite({ children }: { children: React.ReactNode }) {
  return (
    <MolduraDoSite pagina>
      <article className="page on">
        {children}
        <RodapeDaPagina />
      </article>
    </MolduraDoSite>
  );
}

/** Os links do rodapé das páginas, como no protótipo. `chave` é a do catálogo (`site.rodape`). */
const RODAPE: { href: string; chave: "manifesto" | "ajuda" | "suporte" | "seguranca" | "termos" | "privacidade" }[] = [
  { href: "/manifesto", chave: "manifesto" },
  { href: "/ajuda", chave: "ajuda" },
  { href: "/ajuda#suporte", chave: "suporte" },
  { href: "/seguranca", chave: "seguranca" },
  { href: "/termos", chave: "termos" },
  { href: "/privacidade", chave: "privacidade" },
];

async function RodapeDaPagina() {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.rodape");
  return (
    <footer className="site-foot pg-foot">
      <Link className="lockup" href={caminhoDoSite(idioma, "/")} aria-label={t("voltarInicio")}>
        <svg viewBox="0 0 750 170" role="img" aria-label="Brennimark">
          <use href="#bm-logo" />
        </svg>
      </Link>
      <nav className="foot-links" aria-label={t("institucional")}>
        {RODAPE.map(({ href, chave }) => (
          <Link key={chave} href={caminhoDoSite(idioma, href)}>
            {t(chave)}
          </Link>
        ))}
      </nav>
      <LinksDasFerramentas />
      <span className="foot-empresa" data-empresa>
        {t.rich("empresa", {
          cnpj: EMPRESA.cnpj,
          mail: () => <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>,
        })}
      </span>
    </footer>
  );
}
