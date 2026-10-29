import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import { getLocale, getTranslations } from "next-intl/server";
import { telas } from "../telas";
import { BotaoDemonstracao, CartaoRelacionado, FaixaDaMarca, LinkVerPlanos, Trilha } from "../comum";

/** Segurança e privacidade — `/seguranca`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export async function ConteudoSeguranca() {
  const tel = telas(await getLocale());
  const t = await getTranslations("site.seguranca");
  const c = await getTranslations("site.comum");
  const paginas = await getTranslations("site.paginas");
  const rel = await getTranslations("site.relacionados");
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <Trilha menu="m-plat" grupo="plataforma" pagina={paginas("seguranca.titulo")} />
      <Titulo como="h1" className="pg-h1" partes={[t("a_marca_do_seu_cliente")]} />
      <p className="pg-lead">{t("campanha_antes_do_ar_fonte")}</p>
      <div className="pg-actions"><BotaoDemonstracao /><LinkVerPlanos /></div>
      </div>
      <div className="shield"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">{t("como_protegemos")}</p><Titulo className="h2" partes={[t("seis_principios_de_protecao_desde")]} /></div>
      <div className="sgrid"><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 14c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4" /></svg><b>{t("acesso_por_marca")}</b><p>{t("a_fronteira_e_a_marca")}</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></svg><b>{t("conversas_privadas")}</b><p>{t("ninguem_le_a_conversa_de")}</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg><b>{t("fonte_nunca_publica")}</b><p>{t("a_fonte_da_marca_e")}</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="5" cy="10" r="3" /><path d="M7.2 7.8 13 2M11 4l2 2" /></svg><b>{t("chaves_cifradas")}</b><p>{t("as_chaves_de_ia_ficam")}</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></svg><b>{t("registro_de_tudo")}</b><p>{t("publicacoes_convites_e_downloads_ficam")}</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 5l6-3 6 3v6l-6 3-6-3Z" /><path d="M2 5l6 3 6-3M8 8v6" /></svg><b>{t("seus_dados_saem_com_voce")}</b><p>{t("ao_encerrar_a_assinatura_a")}</p></div></div>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">{t("autorizacao")}</p>
      <Titulo className="h2" partes={[t("a_interface_mostra_o_banco")]} />
      <p className="body">{t("o_que_aparece_na_tela")}</p>
      <ul className="ticks"><li>{t("regras_de_acesso_em_cada")}</li><li>{t("testes_que_provam_que_a")}</li><li>{t("revisao_a_cada_mudanca")}</li></ul>
      </div>
      <Captura src={tel.pessoas} alt={t("pessoas_e_acesso_cada_pessoa")} />
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">{t("privacidade")}</p>
      <Titulo className="h2" partes={[t("estatistica_sem_nome")]} />
      <p className="body">{t("para_melhorar_o_produto_usamos")}</p>

      </div>
      <div className="font-card"><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg><span><b>{t("suas_conversas_sao_suas")}</b>{" "}{t("ninguem_le_a_conversa_de_2")}</span></p><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 1.5h5.5l3 3v10H4Z" /><path d="M9.5 1.5v3h3" /></svg><span><b>{t("cada_pessoa_apaga_as_suas")}</b>{" "}{t("quando_quiser_fica_so_o")}</span></p><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z" /></svg><span><b>{t("conteudo_so_com_o_seu")}</b>{" "}{t("enviar_esta_conversa_ao_suporte")}</span></p></div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">{c("perguntas")}</p><Titulo className="h2" partes={[t("sobre_seguranca")]} /></div>
      <div><details open><summary>{t("onde_ficam_os_arquivos")}</summary><p>{t("em_armazenamento_privado_separado_por")}</p></details><details><summary>{t("a_equipe_do_brennimark_acessa")}</summary><p>{t("para_suporte_acessa_registros_e")}</p></details><details><summary>{t("posso_apagar_minhas_conversas")}</summary><p>{t("sim_de_verdade_fica_so")}</p></details><details><summary>{t("e_se_eu_cancelar")}</summary><p>{t("a_conta_fica_congelada_por")}</p></details></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">{c("vejaTambem")}</p>
      <div className="related"><CartaoRelacionado href="/materiais#entrega" titulo={rel("entrega.titulo")} resumo={rel("entrega.resumo")} /><CartaoRelacionado href="/vini" titulo={paginas("vini.titulo")} resumo={rel("vini.resumo")} /><CartaoRelacionado href="/empresas" grupo="paraQuem" titulo={paginas("empresas.titulo")} resumo={rel("empresas.resumo")} /></div>
      </div>
      </section>

      <FaixaDaMarca />
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={[t("converse_com_a_gente_sobre")]} />
      <BotaoDemonstracao />
      </div>
      </section>
    </>
  );
}
