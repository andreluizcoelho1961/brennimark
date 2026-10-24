import { getTranslations } from "next-intl/server";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Studio: o que era a página `/studio`, agora um bloco de outra página (22/10/2026). Texto do protótipo de 29/09/2026 (autoria do André); o inglês está em `site.studio`. */
export async function BlocosDoStudio() {
  const t = await getTranslations("site.studio");
  const comum = await getTranslations("site.comum");
  return (
    <>
      <section className="pg-sec" id="studio"><Losango classe="l2" velocidade={0.2} />
      <div className="pg-wrap sec-head">
      <p className="eyebrow">Studio</p>
      <Titulo className="h2" partes={[t("titulo")]} />
      <p className="body" style={{ maxWidth: "640px" }}>{t("corpo")}</p>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("portasEyebrow")}</p>
      <Titulo className="h2" partes={[t("portasTitulo")]} />
      <p className="body">{t("portasCorpo")}</p>

      </div>
      <div className="two-apps"><div><small>STUDIO</small><b>{t("studioQuem")}</b><p>{t("studioTexto")}</p></div><div><small>BOOK</small><b>{t("bookQuem")}</b><p>{t("bookTexto")}</p></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">{t("statusEyebrow")}</p>
      <Titulo className="h2" partes={[t("statusTitulo")]} />
      <p className="body">{t("statusCorpo")}</p>
      <ul className="ticks"><li>{t("t1")}</li><li>{t("t2")}</li><li>{t("t3")}</li></ul>
      </div>
      <div className="flowst"><div><span className="st-chip dr">{t("rascunho")}</span><p>{t("rascunhoTexto")}</p></div><em>→</em><div><span className="st-chip rev">{t("revisao")}</span><p>{t("revisaoTexto")}</p></div><em>→</em><div><span className="st-chip ok">{t("publicado")}</span><p>{t("publicadoTexto")}</p></div></div>
      </div>
      </div>
      </section>


      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{comum("perguntas")}</p><Titulo className="h2" partes={[t("faqTitulo")]} /></div>
      <div><details open><summary>{t("q1")}</summary><p>{t("a1")}</p></details><details><summary>{t("q2")}</summary><p>{t("a2")}</p></details><details><summary>{t("q3")}</summary><p>{t("a3")}</p></details></div>
      </div>
      </section>

    </>
  );
}
