import { getTranslations } from "next-intl/server";
import { EMPRESA } from "@/lib/site/empresa";
import { JanelaDoFonts } from "../JanelaDoFonts";
import { Losango } from "../Losango";
import { PedirConviteDoFonts } from "../PedirConviteDoFonts";
import { Titulo } from "../Titulo";
import { CartaoRelacionado, Trilha } from "../comum";

/**
 * Brennimark Fonts — `/fonts` e `/en/fonts`. Página do beta (16/10/2026).
 *
 * Regra desta página: só afirma o que o aplicativo faz HOJE. O que está no
 * roteiro aparece como "em desenvolvimento", em bloco separado. A comparação
 * usa só o que se sabe do concorrente pelo site dele (análise de 14/10/2026,
 * o aplicativo dele não foi testado) e diz isso na própria tabela.
 *
 * O pedido de acesso (17/10/2026) é o cadastro gratuito do site, em modo
 * convite (`PedirConviteDoFonts`): cai na lista, marcado como pedido do Fonts.
 * O instalador é enviado por link privado a cada testador, à mão. O aviso de
 * lançamento continua sendo um e-mail pré-preenchido para `EMPRESA.email`.
 *
 * Os textos moram em `site.fonts` nos catálogos (português e inglês); as listas
 * (recursos, roteiro, comparação, perguntas) são numeradas (`r1t`, `dev1`, `c1i`, `q1`).
 */
const QTD = { recursos: 12, desenvolvimento: 6, comparacao: 12, perguntas: 8 } as const;
/** Em que coluna da comparação a vantagem está, por linha: o Fonts, o concorrente ou nenhum dos dois. */
const VANTAGEM: Record<number, "fonts" | "outro" | undefined> = { 1: "outro", 2: "outro", 5: "fonts", 8: "outro", 9: "outro", 10: "outro", 11: "fonts", 12: "outro" };
const faixa = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

export async function ConteudoFonts() {
  const t = await getTranslations("site.fonts");
  const c = await getTranslations("site.comum");
  const paginas = await getTranslations("site.paginas");
  const rel = await getTranslations("site.relacionados");
  const avisar = `mailto:${EMPRESA.email}?subject=${encodeURIComponent(t("avisarAssunto"))}`;
  return (
    <>
      <section className="pg-sec pg-sec--topo"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero pg-hero--compacto">
      <div>
      <Trilha menu="m-plat" grupo="plataforma" pagina={paginas("fonts.titulo")} />
      <Titulo como="h1" className="pg-h1" partes={[t("titulo")]} />
      <p className="pg-lead">{t("lead")}</p>
      <p className="fx-beta">{t.rich("beta", { b: (trecho) => <b>{trecho}</b> })}</p>
      <div className="pg-actions"><PedirConviteDoFonts rotulo={t("pedirAcesso")} /><a className="btn btn--ghost" href={avisar}>{t("avisarLancamento")} <span className="arrow" aria-hidden="true">→</span></a></div>
      </div>
      <JanelaDoFonts />
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points">
        {[1, 2, 3, 4].map((n) => (<div key={n}><i>{String(n).padStart(2, "0")}</i><b>{t(`p${n}t`)}</b><span>{t(`p${n}`)}</span></div>))}
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{t("hojeEyebrow")}</p><Titulo className="h2" partes={[t("hojeTitulo")]} /></div>
      <ul className="fx-grid">
        {faixa(QTD.recursos).map((n) => (<li key={n}><b>{t(`r${n}t`)}</b><span>{t(`r${n}d`)}</span></li>))}
      </ul>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("devEyebrow")}</p>
      <Titulo className="h2" partes={[t("devTitulo")]} />
      <p className="body">{t("devCorpo")}</p>
      </div>
      <ul className="fx-next">
        {faixa(QTD.desenvolvimento).map((n) => (<li key={n}>{t(`dev${n}`)}</li>))}
      </ul>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{t("compEyebrow")}</p><Titulo className="h2" partes={[t("compTitulo")]} /></div>
      <div className="fx-tab" role="table" aria-label={t("compAria")}>
        <div className="fx-tr fx-th" role="row"><span role="columnheader">&nbsp;</span><span role="columnheader">{t("compColuna")}</span><span role="columnheader">FontBase</span></div>
        {faixa(QTD.comparacao).map((n) => (
          <div className="fx-tr" role="row" key={n}>
            <span className="fx-item" role="rowheader">{t(`c${n}i`)}</span>
            <span role="cell" data-melhor={VANTAGEM[n] === "fonts" ? "" : undefined}>{t(`c${n}f`)}</span>
            <span role="cell" data-melhor={VANTAGEM[n] === "outro" ? "" : undefined}>{t(`c${n}o`)}</span>
          </div>
        ))}
      </div>
      <p className="fx-fonte">{t("compNota")}</p>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{t("instEyebrow")}</p><Titulo className="h2" partes={[t("instTitulo")]} /></div>
      <div className="steps">
        {[1, 2, 3].map((n) => (<div className="stp" key={n}><b>{t(`s${n}t`)}</b><p>{t(`s${n}`)}</p><small>{t(`s${n}s`)}</small></div>))}
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{c("perguntas")}</p><Titulo className="h2" partes={[t("faqTitulo")]} /></div>
      <div>{faixa(QTD.perguntas).map((n) => (<details key={n} open={n === 1}><summary>{t(`q${n}`)}</summary><p>{t(`a${n}`)}</p></details>))}</div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">{c("vejaTambem")}</p>
      <div className="related">
        <CartaoRelacionado href="/materiais" titulo={paginas("materiais.titulo")} resumo={rel("materiais.resumo")} />
        <CartaoRelacionado href="/licenca-de-fontes" grupo="institucional" titulo={paginas("licenca-de-fontes.titulo")} resumo={rel("licencaDeFontes.resumo")} />
        <CartaoRelacionado href="/agencias" grupo="paraQuem" titulo={paginas("agencias.titulo")} resumo={rel("agencias.resumo")} />
      </div>
      </div>
      </section>
    </>
  );
}
