import Image from "next/image";
import vini from "../imagens/vini.webp";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import telaRevisao from "../imagens/telas/revisao.webp";
import telaPrompt from "../imagens/telas/prompt.webp";
import fotoDoPrompt from "../imagens/telas/prompt-resultado.webp";
import { getTranslations } from "next-intl/server";
import { BotaoDemonstracao, CartaoRelacionado, CitacaoFicticia, FaixaDaMarca, LinkVerPlanos, Trilha } from "../comum";

/** Vini Max — `/vini`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export async function ConteudoVini() {
  const t = await getTranslations("site.vini");
  const c = await getTranslations("site.comum");
  const paginas = await getTranslations("site.paginas");
  const rel = await getTranslations("site.relacionados");
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <Trilha menu="m-plat" grupo="plataforma" pagina={paginas("vini.titulo")} />
      <Titulo como="h1" className="pg-h1" partes={[t("o_vini_max_ajuda_voce")]} />
      <p className="pg-lead">{t("ele_responde_com_fundamento_encontra")}</p>
      <div className="pg-actions"><BotaoDemonstracao /><LinkVerPlanos /></div>
      </div>
      <div className="vini-hero"><Image src={vini} alt={t("vini_max_o_assistente_do")} sizes="340px" /><div className="vh-tags"><span>{t("consultar")}</span><span>{t("analisar")}</span><span>{t("preparar")}</span></div></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>{t("responde_com_fundamento")}</b><span>{t("a_orientacao_com_a_fonte")}</span></div><div><i>02</i><b>{t("encontra_o_material")}</b><span>{t("aponta_o_arquivo_certo_em")}</span></div><div><i>03</i><b>{t("aponta_divergencias")}</b><span>{t("quando_duas_orientacoes_documentadas_nao")}</span></div><div><i>04</i><b>{t("reconhece_o_limite")}</b><span>{t("sem_resposta_segura_diz_e")}</span></div></div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("consultar")}</p>
      <Titulo className="h2" partes={[t("pergunte_como_perguntaria_a_um")]} />
      <p className="body">{t("a_orientacao_com_a_pagina")}</p>
      <ul className="ticks"><li>{t("a_orientacao_nao_so_veja")}</li><li>{t("a_citacao_abre_o_manual")}</li><li>{t("rascunho_sempre_identificado")}</li></ul>
      </div>
      <div className="chat">
      <div className="chat-win">
      <div className="chat-head"><Image src={vini} alt="" sizes="340px" /><div><b>Vini Max</b><br /><span>{t("manual_do_brennimark")}</span></div></div>
      <div className="turn">
      <p className="q">{t("qual_e_a_area_de")}</p>
      <p className="a">{t("e_x_nos_quatro_lados")}</p>
      <span className="src">{t("fonte_manual_do_brennimark_area")}</span>
      </div>
      <div className="turn">
      <p className="q">{t("posso_colocar_o_logo_em")}</p>
      <p className="a">{t("sim_desde_que_a_foto")}</p>
      <span className="src">{t("fonte_complemento_o_logotipo_sobre")}</span>
      </div>
      </div>
      </div>
      </div>

      <div className="feat-row stack">
      <div>
      <p className="eyebrow">{t("analisar")}</p>
      <Titulo className="h2" partes={[t("solte_a_peca_ele_faz")]} />
      <p className="body">{t("ele_compara_as_cores_com")}</p>
      <ul className="ticks"><li>{t("achados_com_a_orientacao_e")}</li><li>{t("marcacao_sobre_a_peca")}</li><li>{t("sugestao_de_correcao_para_voce")}</li></ul>
      </div>
      <Captura src={telaRevisao} alt={t("a_revisao_de_uma_peca")} />
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("preparar")}</p>
      <Titulo className="h2" partes={[t("a_sua_ideia_com_a")]} />
      <p className="body">{t("voce_descreve_o_que_quer")}</p>
      <ul className="ticks"><li>{t("a_ideia_e_sua_a")}</li><li>{t("rascunho_fica_fora_do_prompt")}</li><li>{t("a_fonte_de_cada_linha")}</li></ul>
      </div>
      <div className="prompt-par">
      <Captura src={telaPrompt} alt={t("o_assistente_monta_o_prompt")} />
      <figure className="resultado resultado--pagina">
        <Image src={fotoDoPrompt} alt={t("fotografia_gerada_por_ia_a")} sizes="(max-width: 767px) 60vw, 22vw" />
        <figcaption><b>{t("a_imagem_gerada_com_este")}</b>{t("fora_do_brennimark_voce_revisa")}</figcaption>
      </figure>
      </div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">{t("onde_ele_vive")}</p>
      <Titulo className="h2" partes={[t("no_canto_de_cada_tela")]} />
      <p className="body">{t("chama_quando_precisar_e_ele")}</p>

      </div>
      <div className="states3"><div className="s3"><div className="s3-art s3-a"><Image src={vini} alt="" sizes="340px" /></div><b>{t("recolhido")}</b><span>{t("so_ele_no_canto_nao")}</span></div><div className="s3"><div className="s3-art s3-b"><i></i><i></i><i></i></div><b>{t("conversa")}</b><span>{t("uma_janela_para_perguntar_e")}</span></div><div className="s3"><div className="s3-art s3-c"><i></i><i></i></div><b>{t("analise")}</b><span>{t("a_peca_e_os_achados")}</span></div></div>
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("privacidade")}</p>
      <Titulo className="h2" partes={[t("ninguem_le_a_sua_conversa")]} />
      <p className="body">{t("a_conversa_com_o_vini")}</p>

      </div>
      <div className="font-card"><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg><span><b>{t("suas_conversas_sao_suas")}</b>{" "}{t("ninguem_le_a_conversa_de")}</span></p><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 1.5h5.5l3 3v10H4Z" /><path d="M9.5 1.5v3h3" /></svg><span><b>{t("cada_pessoa_apaga_as_suas")}</b>{" "}{t("quando_quiser_fica_so_o")}</span></p><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z" /></svg><span><b>{t("conteudo_so_com_o_seu")}</b>{" "}{t("enviar_esta_conversa_ao_suporte")}</span></p></div>
      </div>
      </div>
      </section>

      <CitacaoFicticia>{t("quando_o_cliente_pergunta_eu")}</CitacaoFicticia>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{c("perguntas")}</p><Titulo className="h2" partes={[t("sobre_o_vini")]} /></div>
      <div><details open><summary>{t("o_vini_inventa_regra_quando")}</summary><p>{t("nao_quando_o_manual_nao")}</p></details><details><summary>{t("ele_aprova_pecas")}</summary><p>{t("nao_ele_aponta_o_que")}</p></details><details><summary>{t("quanto_posso_usar")}</summary><p>{t("cada_plano_tem_um_limite")}</p></details><details><summary>{t("a_peca_que_eu_envio")}</summary><p>{t("com_a_marca_so_quem")}</p></details></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">{c("vejaTambem")}</p>
      <div className="related"><CartaoRelacionado href="/manual" titulo={paginas("manual.titulo")} resumo={rel("manual.resumo")} /><CartaoRelacionado href="/manual#complementos" titulo={rel("complementos.titulo")} resumo={rel("complementos.resumo")} /><CartaoRelacionado href="/seguranca" titulo={paginas("seguranca.titulo")} resumo={rel("seguranca.resumo")} /></div>
      </div>
      </section>

      <FaixaDaMarca />
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={[t("traga_o_vini_para_perto")]} />
      <BotaoDemonstracao />
      </div>
      </section>
    </>
  );
}
