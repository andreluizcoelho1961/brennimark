import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import telaPessoas from "../imagens/telas/pessoas.webp";
import telaReceber from "../imagens/telas/receber.webp";
import telaRegistros from "../imagens/telas/registros.webp";
import { getTranslations } from "next-intl/server";

/** Entrega e acesso: o que era a página `/entrega`, agora um bloco de outra página (22/10/2026). Texto do protótipo de 29/09/2026 (autoria do André). */
export async function BlocosDeEntrega() {
  const t = await getTranslations("site.entrega");
  const c = await getTranslations("site.comum");
  return (
    <>
      <section className="pg-sec" id="entrega"><Losango classe="l2" velocidade={0.2} />
      <div className="pg-wrap sec-head">
      <p className="eyebrow">{t("entrega_e_acesso")}</p>
      <Titulo className="h2" partes={[t("cada_fornecedor_com_a_versao")]} />
      <p className="body" style={{ maxWidth: "640px" }}>{t("envie_materiais_a_quem_nao")}</p>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("link_de_entrega")}</p>
      <Titulo className="h2" partes={[t("para_quem_nao_tem_conta")]} />
      <p className="body">{t("escolha_os_materiais_e_o")}</p>
      <ul className="ticks"><li>{t("prazo_de_validade")}</li><li>{t("sem_criar_conta_para_o")}</li><li>{t("a_fonte_fica_de_fora")}</li></ul>
      </div>
      <Captura src={telaReceber} alt={t("a_pagina_que_a_grafica")} />
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">{t("registros")}</p>
      <Titulo className="h2" partes={[t("qual_versao_cada_um_recebeu")]} />
      <p className="body">{t("envios_e_downloads_ficam_no")}</p>
      <ul className="ticks"><li>{t("downloads_e_envios_num_so")}</li><li>{t("filtro_por_marca_pessoa_e")}</li><li>{t("exportavel")}</li></ul>
      </div>
      <Captura src={telaRegistros} alt={t("os_registros_quem_baixou_qual")} />
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("acesso_por_marca")}</p>
      <Titulo className="h2" partes={[t("cada_pessoa_ve_so_a")]} />
      <p className="body">{t("uma_agencia_com_vinte_marcas")}</p>
      <ul className="ticks"><li>{t("quem_gere_publica_e_aprova")}</li><li>{t("quem_consulta_le_baixa_e")}</li><li>{t("mude_o_papel_quando_quiser")}</li></ul>
      </div>
      <Captura src={telaPessoas} alt={t("pessoas_e_acesso_cada_pessoa")} />
      </div>
      </div>
      </section>


      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{c("perguntas")}</p><Titulo className="h2" partes={[t("sobre_entrega_e_acesso")]} /></div>
      <div><details open><summary>{t("o_fornecedor_precisa_criar_conta")}</summary><p>{t("nao_se_voce_usar_o")}</p></details><details><summary>{t("posso_cancelar_um_link_antes")}</summary><p>{t("sim_a_qualquer_momento_ele")}</p></details><details><summary>{t("quantas_pessoas_posso_convidar")}</summary><p>{t("ilimitadas_em_todos_os_planos")}</p></details><details><summary>{t("quem_ve_os_registros")}</summary><p>{t("quem_gere_a_marca")}</p></details></div>
      </div>
      </section>

    </>
  );
}
