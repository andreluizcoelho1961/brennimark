import { getTranslations } from "next-intl/server";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/**
 * Manifesto — `/manifesto` e `/en/manifesto`. Texto do protótipo de 29/09/2026,
 * sem edição (autoria do André); a versão em inglês é tradução fiel dele, em
 * `site.manifesto` nos catálogos, para ele revisar o tom.
 */
export async function ConteudoManifesto() {
  const t = await getTranslations("site.manifesto");
  const em = (trecho: React.ReactNode) => <em>{trecho}</em>;
  const marquee = (
    <span>{t("marqueeA")} <i>✦</i> {t("marqueeB")} <i>✦</i> </span>
  );
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap mani">
      <p className="crumb"><a href="#" data-open-menu="m-rec">{(await getTranslations("site.chrome"))("recursos")}</a> · {t("crumb")}</p>
      <Titulo como="h1" className="pg-h1" partes={[t("titulo")]} />
      <p className="mani-lead">{t.rich("lead", { em })}</p>
      <div className="mani-body">
      <p>{t("p1")}</p>
      <Titulo como="p" className="mani-pull" partes={[t("pull1")]} />
      <p>{t("p2")}</p>
      <p>{t("p3")}</p>
      <p>{t("p4")}</p>
      <p>{t("p5")}</p>
      <Titulo como="p" className="mani-pull" partes={[t("pull2")]} />
      </div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track">{marquee}{marquee}{marquee}{marquee}</div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={[t("cta")]} />
      <button className="btn" type="button" data-open="dlg-demo">{t("ctaBotao")} <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
