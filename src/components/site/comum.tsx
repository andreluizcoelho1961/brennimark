import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { caminhoDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";

/**
 * Os blocos que toda página do site repete, num lugar só: a tradução deles
 * mora em `site.comum`, e uma página nova não copia o HTML de outra.
 */

/** A faixa "Forjada com cuidado ✦ Viva em cada trabalho" que corre entre as seções. */
export async function FaixaDaMarca() {
  const t = await getTranslations("site.comum");
  const trecho = <span>{t("marqueeA")} <i>✦</i> {t("marqueeB")} <i>✦</i> </span>;
  return <div className="marquee" aria-hidden="true"><div className="mq-track">{trecho}{trecho}{trecho}{trecho}</div></div>;
}

/** O botão que abre o diálogo de demonstração. */
export async function BotaoDemonstracao({ className = "btn" }: { className?: string }) {
  const t = await getTranslations("site.chrome");
  return <button className={className} type="button" data-open="dlg-demo">{t("agendarUma")} <span className="arrow" aria-hidden="true">↗</span></button>;
}

/** "Ver os planos →": leva à seção de planos da home no idioma da página. */
export async function LinkVerPlanos() {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.comum");
  return <Link className="btn btn--ghost" href={caminhoDoSite(idioma, "/#planos")} data-go="planos">{t("verPlanos")} <span className="arrow" aria-hidden="true">→</span></Link>;
}

/** A trilha no alto da página: "Para quem · Agências e estúdios". `menu` é o id do menu que o grupo abre. */
export async function Trilha({ menu, grupo, pagina }: { menu: "m-para" | "m-rec" | "m-plat"; grupo: "paraQuem" | "recursos" | "plataforma"; pagina: string }) {
  const t = await getTranslations("site.comum");
  return <p className="crumb"><a href="#" data-open-menu={menu}>{t(grupo)}</a> · {pagina}</p>;
}

/**
 * Um cartão de "páginas relacionadas". `href` é o endereço em português
 * (`/manual#complementos`); o idioma da página decide o endereço de verdade.
 */
export async function CartaoRelacionado({ href, titulo, resumo, grupo = "plataforma" }: { href: string; titulo: ReactNode; resumo: ReactNode; grupo?: "plataforma" | "paraQuem" }) {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.comum");
  return (
    <Link className="rel" href={caminhoDoSite(idioma, href)}>
      <small>{t(grupo)}</small><b>{titulo}</b><span>{resumo}</span><em>→</em>
    </Link>
  );
}

/** A citação grande, com a nota de que o depoimento ainda é fictício. */
export async function CitacaoFicticia({ children }: { children: ReactNode }) {
  const t = await getTranslations("site.comum");
  return (
    <section className="pg-sec">
      <figure className="pg-wrap big-quote">
        <blockquote>{children}</blockquote>
        <figcaption><b>{t("depoimentoFicticio")}</b> · {t("depoimentoNota")}</figcaption>
      </figure>
    </section>
  );
}
