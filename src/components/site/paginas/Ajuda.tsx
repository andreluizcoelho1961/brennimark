import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { BuscaDaAjuda } from "../ajuda/BuscaDaAjuda";
import { FaixaDaMarca } from "../comum";
import { categoriasDoIdioma, artigosDaCategoria, listarArtigos } from "@/lib/ajuda/artigos";
import { caminhoDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";

/**
 * Central de ajuda — `/ajuda` e `/en/help`. Os cartões e a busca são reais desde
 * 17/10/2026; o resto do texto é do protótipo de 29/09/2026 (autoria do André).
 * Os textos moram em `site.ajuda` nos catálogos; os artigos, em `src/content/ajuda`
 * (e `en/`). As listas são numeradas (`faq1q`/`faq1a`, `p1t`/`p1d`, `s1q`/`s1a`, `n1d`/`n1t`/`n1c`).
 */
const faixa = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

export async function ConteudoAjuda() {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.ajuda");
  const rota = (caminho: string) => caminhoDoSite(idioma, caminho);
  const indice = listarArtigos(idioma).map(({ slug, titulo, resumo, texto }) => ({ slug, titulo, resumo, texto, href: rota(`/ajuda/${slug}`) }));
  const FAQ_DESTINOS = ["/ajuda/primeiros-passos", "/ajuda/pessoas-e-acesso", "/ajuda/links-de-entrega", "/ajuda/assinatura"];
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px" }}>
      <p className="crumb"><a href="#" data-open-menu="m-rec">{t("crumbRecursos")}</a> · {t("central")}</p>
      <Titulo como="h1" className="pg-h1" partes={[t("titulo")]} />
      <BuscaDaAjuda indice={indice} hrefDoSuporte={rota("/ajuda#suporte")} />
      <div className="related" style={{ marginTop: "48px" }}>
      {categoriasDoIdioma(idioma).map((c) => {
        const artigos = artigosDaCategoria(c.slug, idioma);
        if (artigos.length === 0) {
          return (
            <div key={c.slug} className="rel rel-em-breve" aria-disabled="true"><small>{t("emBreve")}</small><b>{c.titulo}</b><span>{c.descricao}</span></div>
          );
        }
        const href = artigos.length === 1 ? rota(`/ajuda/${artigos[0].slug}`) : rota(`/ajuda/categoria/${c.slug}`);
        return (
          <Link key={c.slug} className="rel" href={href}><small>{t("artigosContagem", { n: artigos.length })}</small><b>{c.titulo}</b><span>{c.descricao}</span><em>→</em></Link>
        );
      })}
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{t("maisLidos")}</p><Titulo className="h2" partes={[t("faqTitulo")]} /></div>
      <div>{faixa(4).map((n) => (
        <details key={n} open={n === 1}><summary>{t(`faq${n}q`)}</summary><p>{t.rich(`faq${n}a`, { b: (c) => <b>{c}</b>, l: (c) => <Link href={rota(FAQ_DESTINOS[n - 1])}>{c}</Link> })}</p></details>
      ))}</div>
      </div>
      </section>

      <section className="pg-sec" id="suporte"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ maxWidth: "900px" }}>
      <p className="eyebrow">{t("suporte")}</p>
      <Titulo className="h2" partes={[t("suporteTitulo")]} />
      <p className="body">{t("suporteCorpo")}</p>
      </div>
      </section>
      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points">{faixa(4).map((n) => (
        <div key={n}><i>{String(n).padStart(2, "0")}</i><b>{t(`p${n}t`)}</b><span className={n === 2 ? "mono" : undefined}>{t(`p${n}d`)}</span></div>
      ))}</div>
      </section>
      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{t("antes")}</p><Titulo className="h2" partes={[t("antesTitulo")]} /></div>
      <div>{faixa(3).map((n) => (
        <details key={n} open={n === 1}><summary>{t(`s${n}q`)}</summary><p>{t(`s${n}a`)}</p></details>
      ))}</div>
      </div>
      </section>

      <section className="pg-sec" id="novidades">
      <div className="pg-wrap" style={{ maxWidth: "900px" }}>
      <p className="eyebrow">{t("novidades")}</p>
      <Titulo className="h2" partes={[t("novidadesTitulo")]} />
      <p className="body">{t("novidadesCorpo")}</p>
      <div className="changelog">
      {faixa(6).map((n) => (
        <div key={n} className="log-e"><time>{t(`n${n}d`)}</time><div><span className={`st-chip ${n === 4 ? "rev" : "ok"}`}>{n === 4 ? t("melhoria") : t("novo")}</span><b>{t(`n${n}t`)}</b><p>{t(`n${n}c`)}</p></div></div>
      ))}
      </div>
      </div>
      </section>

      <FaixaDaMarca />
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={[t("naoAchou")]} />
      <Link className="btn" href="#suporte">{t("falarSuporte")} <span className="arrow" aria-hidden="true">→</span></Link>
      </div>
      </section>
    </>
  );
}
