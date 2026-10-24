import { getTranslations } from "next-intl/server";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import telaRegistros from "../imagens/telas/registros.webp";
import { BotaoDemonstracao, CartaoRelacionado, CitacaoFicticia, FaixaDaMarca, LinkVerPlanos, Trilha } from "../comum";

/** Empresas — `/empresas` e `/en/companies`. Texto do protótipo de 29/09/2026 (autoria do André); o inglês está em `site.empresas`. */
export async function ConteudoEmpresas() {
  const t = await getTranslations("site.empresas");
  const paginas = await getTranslations("site.paginas");
  const rel = await getTranslations("site.relacionados");
  const comum = await getTranslations("site.comum");
  const dores = [1, 2, 3, 4, 5] as const;
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <Trilha menu="m-para" grupo="paraQuem" pagina={paginas("empresas.titulo")} />
      <Titulo como="h1" className="pg-h1" partes={[t("titulo")]} />
      <p className="pg-lead">{t("lead")}</p>
      <div className="pg-actions"><BotaoDemonstracao /><LinkVerPlanos /></div>
      </div>
      <Captura src={telaRegistros} alt={t("imagemAlt")} />
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{comum("antesDepois")}</p><Titulo className="h2" partes={[t("fimTitulo")]} /></div>
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
        <CartaoRelacionado href="/materiais#entrega" titulo={rel("entrega.titulo")} resumo={rel("entrega.resumo")} />
        <CartaoRelacionado href="/seguranca" titulo={paginas("seguranca.titulo")} resumo={rel("seguranca.resumo")} />
        <CartaoRelacionado href="/materiais" titulo={paginas("materiais.titulo")} resumo={rel("materiais.resumo")} />
        <CartaoRelacionado href="/vini" titulo={paginas("vini.titulo")} resumo={rel("vini.resumo")} />
        <CartaoRelacionado href="/manual" titulo={paginas("manual.titulo")} resumo={rel("manual.resumo")} />
        <CartaoRelacionado href="/manual#complementos" titulo={rel("complementos.titulo")} resumo={rel("complementos.resumo")} />
      </div>
      </div>
      </section>

      <CitacaoFicticia>{t("citacao")}</CitacaoFicticia>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{comum("perguntas")}</p><Titulo className="h2" partes={[t("faqTitulo")]} /></div>
      <div>
        <details open><summary>{t("q1")}</summary><p>{t("a1")}</p></details>
        <details><summary>{t("q2")}</summary><p>{t("a2")}</p></details>
        <details><summary>{t("q3")}</summary><p>{t("a3")}</p></details>
      </div>
      </div>
      </section>

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
