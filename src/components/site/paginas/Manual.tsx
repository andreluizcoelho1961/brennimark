import { BlocosDeComplementos } from "./Complementos";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import { getLocale, getTranslations } from "next-intl/server";
import { telas } from "../telas";
import { BotaoDemonstracao, CartaoRelacionado, CitacaoFicticia, FaixaDaMarca, LinkVerPlanos, Trilha } from "../comum";

/** O manual em PDF — `/manual`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export async function ConteudoManual() {
  const tel = telas(await getLocale());
  const t = await getTranslations("site.manual");
  const c = await getTranslations("site.comum");
  const paginas = await getTranslations("site.paginas");
  const rel = await getTranslations("site.relacionados");
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <Trilha menu="m-plat" grupo="plataforma" pagina={paginas("manual.titulo")} />
      <Titulo como="h1" className="pg-h1" partes={[t("o_manual_que_o_estudio")]} />
      <p className="pg-lead">{t("suba_o_pdf_e_a")}</p>
      <div className="pg-actions"><BotaoDemonstracao /><LinkVerPlanos /></div>
      </div>
      <Captura src={tel.manualIndice} alt={t("o_manual_aberto_na_plataforma")} />
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>{t("publicacao_simples")}</b><span>{t("envie_o_pdf_confira_o")}</span></div><div><i>02</i><b>{t("fiel_ao_original")}</b><span>{t("nenhuma_pagina_e_redesenhada_ou")}</span></div><div><i>03</i><b>{t("indice_e_busca")}</b><span>{t("encontre_a_regra_pelo_capitulo")}</span></div><div><i>04</i><b>{t("os_formatos_de_manual")}</b><span>{t("retrato_paisagem_e_16_9")}</span></div></div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("publicacao")}</p>
      <Titulo className="h2" partes={[t("do_pdf_a_equipe_sem")]} />
      <p className="body">{t("nada_de_reconstruir_o_manual")}</p>
      <ul className="ticks"><li>{t("sem_reconstruir_pagina_por_pagina")}</li><li>{t("o_vini_passa_a_consultar")}</li><li>{t("nova_versao_substitui_a_anterior")}</li></ul>
      </div>
      <div className="frame"><div className="kit" role="img" aria-label={t("publicacao_do_manual_em_quatro")}>
      <h4>{t("publicando_manual_da_marca_brennimark")}</h4>
      <div className="kit-row"><span className="ck">✓</span><b>{t("pdf_enviado")}</b><em>{t("42_paginas")}</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>{t("texto_das_paginas_lido")}</b><em>{t("concluido")}</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>{t("indice_conferido_por_voce")}</b><em>{t("8_capitulos")}</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>{t("publicado_para_a_equipe")}</b><em>{t("12_pessoas")}</em></div>
      <div className="prog"><i style={{ width: "100%" }}></i></div>
      <div className="kit-foot"><span>{t("pronto_o_tempo_de_leitura")}</span><span className="mk-btn">{t("abrir_o_manual")}</span></div></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">{t("fidelidade")}</p>
      <Titulo className="h2" partes={[t("o_que_o_estudio_diagramou")]} />
      <p className="body">{t("tipografia_grid_cor_e_respiro")}</p>

      </div>
      <div className="cmp"><figure><div className="mini"><div className="pdf" style={{ maxWidth: "none" }}><div className="pdf-left"><small>MANUAL</small><b>05</b><strong>{t("cores")}</strong><i></i><i></i><i></i></div><div className="pdf-right sw4"><i style={{ background: "#ff4103" }}></i><i style={{ background: "#001621" }}></i><i style={{ background: "#072631" }}></i><i style={{ background: "#f2f5f6" }}></i></div></div></div><figcaption>{t("o_pdf_que_o_estudio")}</figcaption></figure><span className="eq">=</span><figure><div className="mini"><div className="pdf" style={{ maxWidth: "none" }}><div className="pdf-left"><small>MANUAL</small><b>05</b><strong>{t("cores")}</strong><i></i><i></i><i></i></div><div className="pdf-right sw4"><i style={{ background: "#ff4103" }}></i><i style={{ background: "#001621" }}></i><i style={{ background: "#072631" }}></i><i style={{ background: "#f2f5f6" }}></i></div></div></div><figcaption>{t("o_mesmo_pdf_no_brennimark")}</figcaption></figure></div>
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("busca")}</p>
      <Titulo className="h2" partes={[t("uma_palavra_e_o_manual")]} />
      <p className="body">{t("a_busca_percorre_o_texto")}</p>
      <ul className="ticks"><li>{t("busca_no_texto_de_todas")}</li><li>{t("trecho_com_a_palavra_marcada")}</li><li>{t("clique_e_o_manual_abre")}</li></ul>
      </div>
      <Captura src={tel.manualBusca} alt={t("a_busca_no_manual_a")} />
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{c("comoFunciona")}</p><Titulo className="h2" partes={[t("tres_passos_e_o_manual")]} /></div>
      <div className="steps"><div className="stp"><b>{t("envie_o_pdf")}</b><p>{t("o_mesmo_arquivo_que_o")}</p><small>Studio</small></div><div className="stp"><b>{t("confira_e_publique")}</b><p>{t("veja_o_indice_ajuste_um")}</p><small>Studio</small></div><div className="stp"><b>{t("a_equipe_consulta")}</b><p>{t("no_book_com_indice_busca")}</p><small>{t("book")}</small></div></div>
      </div>
      </section>

      <CitacaoFicticia>{t("o_manual_ficou_igualzinho_ao")}</CitacaoFicticia>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{c("perguntas")}</p><Titulo className="h2" partes={[t("sobre_o_manual")]} /></div>
      <div><details open><summary>{t("preciso_refazer_o_manual_em")}</summary><p>{t("nao_voce_sobe_o_pdf")}</p></details><details><summary>{t("e_se_o_pdf_nao")}</summary><p>{t("o_brennimark_monta_um_indice")}</p></details><details><summary>{t("posso_publicar_uma_versao_nova")}</summary><p>{t("sim_a_nova_substitui_a")}</p></details><details><summary>{t("os_leitores_podem_baixar_o")}</summary><p>{t("sim_se_quem_gere_a")}</p></details></div>
      </div>
      </section>

      <BlocosDeComplementos />

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">{c("vejaTambem")}</p>
      <div className="related"><CartaoRelacionado href="/materiais" titulo={paginas("materiais.titulo")} resumo={rel("materiais.resumo")} /><CartaoRelacionado href="/vini" titulo={paginas("vini.titulo")} resumo={rel("vini.resumo")} /><CartaoRelacionado href="/manual#complementos" titulo={rel("complementos.titulo")} resumo={rel("complementos.resumo")} /></div>
      </div>
      </section>

      <FaixaDaMarca />
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={[t("leve_o_seu_manual_para")]} />
      <BotaoDemonstracao />
      </div>
      </section>
    </>
  );
}
