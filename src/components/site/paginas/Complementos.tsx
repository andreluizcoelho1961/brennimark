import Image from "next/image";
import vini from "../imagens/vini.webp";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import telaComplementoEditor from "../imagens/telas/complemento-editor.webp";
import { getTranslations } from "next-intl/server";

/** Complementos e lacunas: o que era a página `/complementos`, agora um bloco de outra página (22/10/2026). Texto do protótipo de 29/09/2026 (autoria do André). */
export async function BlocosDeComplementos() {
  const t = await getTranslations("site.complementos");
  const c = await getTranslations("site.comum");
  return (
    <>
      <section className="pg-sec" id="complementos"><Losango classe="l2" velocidade={0.2} />
      <div className="pg-wrap sec-head">
      <p className="eyebrow">{t("complementos_e_lacunas")}</p>
      <Titulo className="h2" partes={[t("o_que_o_manual_nao")]} />
      <p className="body" style={{ maxWidth: "640px" }}>{t("todo_manual_tem_lacunas_o")}</p>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("complementos")}</p>
      <Titulo className="h2" partes={[t("texto_simples_publicado_ao_lado")]} />
      <p className="body">{t("a_agencia_escreve_o_complemento")}</p>
      <ul className="ticks"><li>{t("editor_com_previa")}</li><li>{t("rascunho_revisao_e_publicado")}</li><li>{t("historico_de_cada_versao")}</li></ul>
      </div>
      <Captura src={telaComplementoEditor} alt={t("o_editor_de_complemento_o")} />
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">{t("o_vini_cita")}</p>
      <Titulo className="h2" partes={[t("a_lacuna_fechada_vira_resposta")]} />
      <p className="body">{t("depois_de_aprovado_o_complemento")}</p>

      </div>
      <div className="chat"><div className="chat-win"><div className="chat-head"><Image src={vini} alt="" sizes="34px" /><div><b>Vini Max</b><br /><span>{t("manual_do_brennimark")}</span></div></div><div className="turn was"><p className="tag-when">{t("antes_da_aprovacao")}</p><p className="q">{t("posso_usar_o_simbolo_sobre")}</p><p className="a">{t("o_manual_nao_trata_disso")}</p></div><div className="turn"><p className="tag-when">{t("depois_da_aprovacao_em_20")}</p><p className="q">{t("posso_usar_o_simbolo_sobre")}</p><p className="a">{t("sim_em_areas_escuras_e")}</p><span className="src">{t("fonte_complemento_simbolo_sobre_fotografia")}</span></div></div></div>
      </div>
      </div>
      </section>


      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{c("perguntas")}</p><Titulo className="h2" partes={[t("sobre_complementos")]} /></div>
      <div><details open><summary>{t("o_complemento_muda_o_pdf")}</summary><p>{t("nao_o_pdf_continua_como")}</p></details><details><summary>{t("quem_pode_escrever")}</summary><p>{t("quem_gere_a_marca_a")}</p></details><details><summary>{t("o_relatorio_mostra_quem_perguntou")}</summary><p>{t("nao_so_o_assunto_e")}</p></details></div>
      </div>
      </section>

    </>
  );
}
