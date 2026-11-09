import Link from "next/link";
import { BlocosDeEntrega } from "./Entrega";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import { getLocale, getTranslations } from "next-intl/server";
import { telas } from "../telas";
import { caminhoDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";
import { BotaoDemonstracao, CartaoRelacionado, CitacaoFicticia, FaixaDaMarca, LinkVerPlanos, Trilha } from "../comum";

/** Materiais da marca — `/materiais`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export async function ConteudoMateriais() {
  const tel = telas(await getLocale());
  const idioma = await idiomaDoSiteAtual();
  const rota = (caminhoPt: string) => caminhoDoSite(idioma, caminhoPt);
  const t = await getTranslations("site.materiais");
  const c = await getTranslations("site.comum");
  const paginas = await getTranslations("site.paginas");
  const rel = await getTranslations("site.relacionados");
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <Trilha menu="m-plat" grupo="plataforma" pagina={paginas("materiais.titulo")} />
      <Titulo como="h1" className="pg-h1" partes={[t("tudo_que_a_marca_precisa")]} />
      <p className="pg-lead">{t("logo_simbolo_cores_fonte_icones")}</p>
      <div className="pg-actions">
      <BotaoDemonstracao />
      <LinkVerPlanos />
      </div>
      </div>
      <Captura src={tel.materiais} alt={t("materiais_da_marca_a_lista")} />
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points">
      <div><i>01</i><b>{t("o_kit_num_clique")}</b><span>{t("tudo_o_que_a_marca")}</span></div>
      <div><i>02</i><b>{t("a_regra_vai_junto")}</b><span>{t("cada_arquivo_leva_a_regra")}</span></div>
      <div><i>03</i><b>{t("a_fonte_tambem")}</b><span>{t("para_quem_e_da_marca")}</span></div>
      <div><i>04</i><b>{t("nada_de_versao_velha")}</b><span>{t("o_que_saiu_de_uso")}</span></div>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("o_kit")}</p>
      <Titulo className="h2" partes={[t("o_kit_inteiro_montado_na")]} />
      <p className="body">{t("escolha_o_que_precisa_ou")}</p>
      <ul className="ticks"><li>{t("logo_em_svg_png_e")}</li><li>{t("paleta_em_ase_com_hex")}</li><li>{t("fonte_icones_e_fotografia")}</li><li>{t("as_regras_de_uso_em")}</li></ul>
      </div>
      <div className="frame">
      <div className="kit" role="img" aria-label={t("painel_de_montagem_do_kit")}>
      <h4>{t("kit_da_marca_brennimark")}</h4>
      <div className="kit-row"><span className="ck">✓</span><b>{t("logotipo")}</b><em>SVG · PNG · PDF</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>{t("simbolo")}</b><em>SVG · PNG</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>{t("cores")}</b><em>ASE · PDF</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>{t("tipografia")}</b><em>OTF</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>{t("icones")}</b><em>SVG</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>{t("regras_de_uso")}</b><em>PDF</em></div>
      <div className="prog"><i></i></div>
      <div className="kit-foot"><span>{t("montando_o_pacote_no_seu")}</span><span className="mk-btn">{t("baixar_zip")}</span></div>
      </div>
      </div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">{t("a_regra_junto")}</p>
      <Titulo className="h2" partes={[t("quem_baixa_o_logo_leva")]} />
      <p className="body">{t("cada_item_tem_as_suas")}</p>
      <ul className="ticks"><li>{t("versoes_para_fundo_claro_e")}</li><li>{t("o_que_pode_e_o")}</li><li>{t("a_citacao_abre_o_manual")}</li></ul>
      </div>
      <Captura src={tel.itemLogotipo} alt={t("a_pagina_de_um_item")} />
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("a_fonte")}</p>
      <Titulo className="h2" partes={[t("a_fonte_da_marca_vem")]} />
      <p className="body">{t("sem_a_fonte_o_primeiro")}</p>
      <ul className="ticks"><li>{t("so_para_membros_daquela_marca")}</li><li>{t("nunca_em_endereco_publico")}</li><li>{t("licenca_aceita_e_registrada_no")}</li></ul>
      </div>
      <div className="font-card">
      <div className="spec">Aa</div>
      <p className="alpha">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</p>
      <div className="weights"><span style={{ fontWeight: "400" }}>Inter Regular</span><span style={{ fontWeight: "500" }}>Inter Medium</span><span style={{ fontWeight: "600" }}>Inter Semibold</span></div>
      <p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg><span><b>{t("download_para_membros_desta_marca")}</b>{" "}{t("licenca_aceita_por_carolina_menezes")}</span></p>
      </div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">{t("fotografia")}</p>
      <Titulo className="h2" partes={[t("o_acervo_de_fotos_organizado")]} />
      <p className="body">{t("albuns_por_assunto_com_miniaturas")}</p>
      <ul className="ticks"><li>{t("albuns_criados_pela_agencia")}</li><li>{t("ampliacao_antes_de_baixar")}</li><li>{t("varias_fotos_num_pacote")}</li></ul>
      </div>
      <Captura src={tel.bancoDeImagens} alt={t("banco_de_imagens_da_marca")} />
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("versoes")}</p>
      <Titulo className="h2" partes={[t("o_logo_antigo_nao_se")]} />
      <p className="body">{t("quando_um_arquivo_sai_de")}</p>
      </div>
      <div className="frame">
      <div className="mk"><div className="mk-body">
      <div className="vs">
      <div className="tile"><span className="tag cur">{t("atual")}</span><div className="tile-art dark logo"><svg viewBox="0 0 750 170"><use href="#bm-logo" /></svg></div><p>{t("logotipo_2026")}{" "}<span>SVG · PNG</span></p></div>
      <div className="tile old"><span className="tag dis">{t("descontinuado")}</span><div className="tile-art dark logo" style={{ color: "#f2f5f6" }}><svg viewBox="0 0 750 170"><use href="#bm-logo" /></svg></div><p>{t("logotipo_2019")}{" "}<span>{t("desde_03_2026")}</span></p></div>
      </div>
      <p className="vs-note">{t("o_descontinuado_continua_disponivel_para")}</p>
      </div></div>
      </div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{c("comoFunciona")}</p><Titulo className="h2" partes={[t("a_agencia_organiza_uma_vez")]} /></div>
      <div className="steps">
      <div className="stp"><b>{t("a_agencia_sobe_os_arquivos")}</b><p>{t("no_studio_cada_arquivo_entra")}</p><small>Studio</small></div>
      <div className="stp"><b>{t("liga_cada_um_a_regra")}</b><p>{t("a_regra_de_uso_e")}</p><small>Studio</small></div>
      <div className="stp"><b>{t("a_equipe_baixa_o_que")}</b><p>{t("um_arquivo_um_grupo_ou")}</p><small>{t("book")}</small></div>
      </div>
      </div>
      </section>

      <CitacaoFicticia>{t("antes_cada_fornecedor_novo_era")}</CitacaoFicticia>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{c("perguntas")}</p><Titulo className="h2" partes={[t("sobre_os_materiais")]} /></div>
      <div>
      <details open><summary>{t("quem_pode_baixar_os_arquivos")}</summary><p>{t("as_pessoas_convidadas_para_aquela")}</p></details>
      <details><summary>{t("e_quem_nao_tem_conta")}</summary><p>{t("voce_envia_um_link_de")}{" "}<Link className="more" style={{ margin: "0", fontSize: "inherit" }} href={rota("/materiais#entrega")}>{t("entrega_e_acesso")}</Link></p></details>
      <details><summary>{t("a_fonte_da_marca_fica")}</summary><p>{t("nao_ela_e_servida_so")}</p></details>
      <details><summary>{t("quais_formatos_posso_subir")}</summary><p>{t("os_de_uso_comum_em")}</p></details>
      <details><summary>{t("o_que_acontece_com_o")}</summary><p>{t("fica_marcado_como_descontinuado_com")}</p></details>
      </div>
      </div>
      </section>

      <BlocosDeEntrega />

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">{c("vejaTambem")}</p>
      <div className="related">
      <CartaoRelacionado href="/vini" titulo={paginas("vini.titulo")} resumo={rel("vini.resumo")} />
      <CartaoRelacionado href="/manual" titulo={paginas("manual.titulo")} resumo={rel("manual.resumo")} />
      </div>
      </div>
      </section>

      <FaixaDaMarca />
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={[t("entregue_a_marca_pronta_para")]} />
      <BotaoDemonstracao />
      </div>
      </section>
    </>
  );
}
