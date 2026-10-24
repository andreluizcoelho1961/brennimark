import { getTranslations } from "next-intl/server";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Trilha } from "../comum";

/** Licença de fontes — `/licenca-de-fontes` e `/en/font-license`. Texto do protótipo de 29/09/2026 (autoria do André); o inglês está em `site.licencaDeFontes`. */
export async function ConteudoLicencaDeFontes() {
  const t = await getTranslations("site.licencaDeFontes");
  const paginas = await getTranslations("site.paginas");
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px", maxWidth: "900px" }}>
      <Trilha menu="m-rec" grupo="recursos" pagina={paginas("licenca-de-fontes.titulo")} />
      <Titulo como="h1" className="pg-h1" partes={[t("titulo")]} />
      <p className="pg-lead">{t("lead")}</p>
      </div>
      </section>
      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{t("resumoEyebrow")}</p><Titulo className="h2" partes={[t("resumoTitulo")]} /></div>
      <div><details open><summary>{t("q1")}</summary><p>{t("a1")}</p></details><details><summary>{t("q2")}</summary><p>{t("a2")}</p></details><details><summary>{t("q3")}</summary><p>{t("a3")}</p></details><details><summary>{t("q4")}</summary><p>{t("a4")}</p></details></div>
      </div>
      </section>
    </>
  );
}
