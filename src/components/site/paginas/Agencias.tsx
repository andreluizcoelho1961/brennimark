import Image from "next/image";
import { getTranslations } from "next-intl/server";
import maosComPranchas from "../imagens/maos-com-pranchas.webp";
import { BlocosDoStudio } from "./Studio";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { BotaoDemonstracao, CartaoRelacionado, CitacaoFicticia, FaixaDaMarca, LinkVerPlanos, Trilha } from "../comum";

/**
 * Agências e estúdios — `/agencias` e `/en/agencies`. Texto do protótipo de
 * 29/09/2026 (autoria do André); a versão em inglês está em `site.agencias`.
 */
export async function ConteudoAgencias() {
  const t = await getTranslations("site.agencias");
  const paginas = await getTranslations("site.paginas");
  const rel = await getTranslations("site.relacionados");
  const pontos = [1, 2, 3, 4] as const;
  const dores = [1, 2, 3, 4, 5] as const;
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <Trilha menu="m-para" grupo="paraQuem" pagina={paginas("agencias.titulo")} />
      <Titulo como="h1" className="pg-h1" partes={[t("titulo")]} />
      <p className="pg-lead">{t("lead")}</p>
      <div className="pg-actions"><BotaoDemonstracao /><LinkVerPlanos /></div>
      </div>
      <div className="ph-hero"><Image src={maosComPranchas} alt={t("imagemAlt")} sizes="(max-width: 767px) 100vw, 50vw" /></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points">
        {pontos.map((n) => (
          <div key={n}><i>{String(n).padStart(2, "0")}</i><b>{t(`p${n}t`)}</b><span>{t(`p${n}`)}</span></div>
        ))}
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{(await getTranslations("site.comum"))("antesDepois")}</p><Titulo className="h2" partes={[t("fimTitulo")]} /></div>
      <div className="pains">
        {dores.map((n) => (
          <div key={n}><s>{t(`d${n}a`)}</s><b>{t(`d${n}b`)}</b></div>
        ))}
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{t("ganhaEyebrow")}</p><Titulo className="h2" partes={[t("ganhaTitulo")]} /></div>
      <div className="related">
        <CartaoRelacionado href="/manual" titulo={paginas("manual.titulo")} resumo={rel("manual.resumo")} />
        <CartaoRelacionado href="/materiais" titulo={paginas("materiais.titulo")} resumo={rel("materiais.resumo")} />
        <CartaoRelacionado href="/vini" titulo={paginas("vini.titulo")} resumo={rel("vini.resumo")} />
        <CartaoRelacionado href="/materiais#entrega" titulo={rel("entrega.titulo")} resumo={rel("entrega.resumo")} />
        <CartaoRelacionado href="/manual#complementos" titulo={rel("complementos.titulo")} resumo={rel("complementos.resumo")} />
        <CartaoRelacionado href="/agencias#studio" titulo={rel("studio.titulo")} resumo={rel("studio.resumo")} />
      </div>
      </div>
      </section>

      <CitacaoFicticia>{t("citacao")}</CitacaoFicticia>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{(await getTranslations("site.comum"))("perguntas")}</p><Titulo className="h2" partes={[t("faqTitulo")]} /></div>
      <div>
        <details open><summary>{t("q1")}</summary><p>{t("a1")}</p></details>
        <details><summary>{t("q2")}</summary><p>{t("a2")}</p></details>
        <details><summary>{t("q3")}</summary><p>{t("a3")}</p></details>
      </div>
      </div>
      </section>

      <BlocosDoStudio />

      <FaixaDaMarca />
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={[t("cta")]} />
      <BotaoDemonstracao />
      </div>
      </section>
    </>
  );
}
