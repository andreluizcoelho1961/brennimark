import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LinksDasFerramentas } from "./LinksDasFerramentas";
import { EMPRESA } from "@/lib/site/empresa";
import { caminhoDoSite } from "@/lib/site/idiomas";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";
import equipeNaMesa from "./imagens/equipe-na-mesa.jpg";
import { IconeDoRecurso } from "./IconeDoRecurso";
import { JanelaDoFonts } from "./JanelaDoFonts";
import { Losango } from "./Losango";
import { PedirConviteDoFonts } from "./PedirConviteDoFonts";
import { FichaDoVini, TelaAnalise, TelaComplementos, TelaConsulta, TelaEntrega, TelaManual, TelaMateriais, TelaPrompt } from "./TelasDaHome";
import { Titulo } from "./Titulo";
import { TourDaPlataforma } from "./TourDaPlataforma";

/**
 * A home em rolagem vertical (22/10/2026), refeita no mesmo dia para vender
 * na primeira tela: a abertura já lista o que tem dentro, e logo abaixo o tour
 * mostra a tela de cada recurso. Depois: antes × depois, o Vini, para quem é,
 * os depoimentos, as ferramentas grátis, planos e chamada final.
 *
 * Os depoimentos são de marcação, com "Depoimento fictício" no lugar do nome
 * (decisão do André, 29/09 e de novo em 22/10): guardam o lugar até chegarem
 * os depoimentos dos pilotos.
 *
 * Substitui os 14 capítulos do trilho horizontal. O texto e os estudos de tela
 * são os mesmos de antes (autoria do André); mudou a ordem e o corte.
 */
/**
 * Os recursos que a abertura lista e o tour mostra, na mesma ordem. Os textos
 * moram em `site.home.recursos.<id>` (rótulo, curto, título, texto, link).
 */
const RECURSOS = [
  { id: "manual", destino: "/manual", tela: <TelaManual /> },
  { id: "consulta", destino: "/vini", tela: <TelaConsulta /> },
  { id: "analise", destino: "/vini", tela: <TelaAnalise /> },
  { id: "prompt", destino: "/vini", tela: <TelaPrompt /> },
  { id: "materiais", destino: "/materiais", tela: <TelaMateriais /> },
  { id: "entrega", destino: "/materiais#entrega", tela: <TelaEntrega /> },
  { id: "complementos", destino: "/manual#complementos", tela: <TelaComplementos /> },
] as const;

export async function SecoesDaHome() {
  const t = await getTranslations("site.home");
  const rodape = await getTranslations("site.rodape");
  const idioma = await idiomaDoSiteAtual();
  const rota = (caminho: string) => caminhoDoSite(idioma, caminho);
  const recursos = RECURSOS.map(({ id, destino, tela }) => ({
    id,
    rotulo: t(`recursos.${id}.rotulo`),
    curto: t(`recursos.${id}.curto`),
    titulo: t(`recursos.${id}.titulo`),
    texto: t(`recursos.${id}.texto`),
    href: rota(destino),
    link: t(`recursos.${id}.link`),
    tela,
  }));
  return (
    <>
        <section className="panel hero is-active" id="inicio" aria-label={t("inicio")}>
          <div className="hero-photo">
            <Image src={equipeNaMesa} alt="" fill sizes="(max-width: 767px) 100vw, 62vw" loading="eager" fetchPriority="high" />
          </div>
          <div className="hero-copy">
            <p className="eyebrow rise">{t("plataforma_de_gestao_de_marca")}</p>
            <Titulo como="h1" className="rise" partes={[t("uma_marca_passa_por_muitas"), " ", { em: t("a_ideia_tem_que_passar") }]} />
            <p className="hero-lede rise-2"><strong>{t("menos_tempo_procurando_mais_seguranca")}</strong>{" "}{t("o_manual_os_arquivos_e")}</p>
            <div className="actions rise-2">
              <button className="btn" type="button" data-open="dlg-demo">{t("agendar_uma_demonstracao")}{" "}<span className="arrow" aria-hidden="true">↗</span></button>
              <Link className="btn btn--ghost" href={rota("/#plataforma")}>{t("ver_a_plataforma_por_dentro")}{" "}<span className="arrow" aria-hidden="true">→</span></Link>
            </div>
          </div>
          <nav className="hero-bar rise-2" aria-label={t("o_que_tem_dentro_do")}>
            {recursos.map((r) => (
              <a key={r.id} href={`#recurso-${r.id}`}><IconeDoRecurso id={r.id} /><b>{r.rotulo}</b><span>{r.curto}</span></a>
            ))}
            {/* O Fonts na capa (23/10/2026): destaque em Brasa, com a etiqueta do beta. */}
            <Link className="hero-bar-fonts" href={rota("/fonts")}><em>{t("novo_beta")}</em><b>{t("brennimark_fonts")}</b><span>{t("o_app_que_liga_as")}</span></Link>
          </nav>
        </section>

        <section className="panel" id="plataforma" aria-label={t("a_plataforma_por_dentro")}>
          <div className="wrap">
            <div className="tour-head">
              <p className="eyebrow">{t("a_plataforma_por_dentro")}</p>
              <Titulo className="title rise" partes={[t("a_marca_inteira_no_mesmo"), " ", { em: t("veja_como_funciona") }]} />
            </div>
            <TourDaPlataforma abas={recursos} />
          </div>
        </section>

        <section className="panel" id="fonts" aria-label={t("brennimark_fonts")}>
          <Losango classe="l1" velocidade={-0.25} />
          <div className="wrap fonts-home">
            <div>
              <p className="eyebrow">{t("novo_brennimark_fonts")}</p>
              <Titulo className="title rise" partes={[t("as_fontes_de_cada_marca"), " ", { em: t("ligadas_no_seu_computador") }]} />
              <p className="intro">{t("o_app_que_ativa_as")}</p>
              <p className="fx-beta"><b>{t("beta_fechado_gratuito_por_convite")}</b>{" "}{t("so_os_50_primeiros_90")}</p>
              <div className="actions">
                <PedirConviteDoFonts rotulo={t("pedir_convite")} />
                <Link className="btn btn--ghost" href={rota("/fonts")}>{t("conhecer_o_fonts")}{" "}<span className="arrow" aria-hidden="true">→</span></Link>
              </div>
            </div>
            <JanelaDoFonts />
          </div>
        </section>

        <section className="panel" id="problema" aria-label={t("antes_e_depois")}>
          <div className="wrap">
            <p className="eyebrow">{t("o_problema")}</p>
            <Titulo className="title rise" partes={[t("o_prazo_esta_correndo_o")]} />
            <div className="cmp-home">
              <div className="cmp-col">
                <p className="cmp-k">{t("sem_o_brennimark")}</p>
                <ul>
                  <li>{t("o_manual_e_um_pdf")}</li>
                  <li>{t("logo_cores_e_fonte_espalhados")}</li>
                  <li>{t("qual_e_o_laranja_certo")}</li>
                  <li>{t("a_grafica_recebe_a_versao")}</li>
                  <li>{t("a_peca_volta_porque_a")}</li>
                </ul>
              </div>
              <div className="cmp-col cmp-col--com">
                <p className="cmp-k">{t("com_o_brennimark")}</p>
                <ul>
                  <li>{t("o_manual_fiel_com_indice")}</li>
                  <li>{t("o_kit_inteiro_num_clique")}</li>
                  <li>{t("um_assistente_de_ia_responde")}</li>
                  <li>{t("um_link_com_prazo_que")}</li>
                  <li>{t("uma_segunda_leitura_da_peca")}</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" id="vini" aria-label={t("conheca_o_vini_max")}>
          <Losango classe="l2" velocidade={0.35} />
          <div className="wrap vini">
            <FichaDoVini />
            <div>
              <p className="eyebrow">{t("o_assistente_de_ia_do")}</p>
              <Titulo className="title rise" partes={[t("este_e_o_vini_max"), " ", { em: t("pode_chamar_de_vini") }]} />
              <p className="intro">{t("o_assistente_que_aparece_no")}</p>
              <ul className="traits">
                <li><i>01</i><div><b>{t("responde_com_fundamento")}</b><span>{t("cita_o_manual_ou_o")}</span></div></li>
                <li><i>02</i><div><b>{t("encontra_o_material")}</b><span>{t("aponta_o_arquivo_certo_em")}</span></div></li>
                <li><i>03</i><div><b>{t("aponta_divergencias")}</b><span>{t("quando_duas_orientacoes_documentadas_nao")}</span></div></li>
                <li><i>04</i><div><b>{t("reconhece_o_limite")}</b><span>{t("sem_resposta_segura_ele_diz")}</span></div></li>
              </ul>
              <Link className="more" href={rota("/vini")}>{t("conheca_o_vini_max")}{" "}<span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </section>

        <section className="panel" id="publico" aria-label={t("para_quem")}>
          <Losango classe="l2" velocidade={0.35} />
          <div className="wrap">
            <p className="eyebrow">{t("para_quem")}</p>
            <Titulo className="title rise" partes={[t("para_quem_mantem_a_marca")]} />
            <div className="aud-grid">
              <div className="aud">
                <h3>{t("agencias_e_estudios")}</h3>
                <p>{t("organize_as_marcas_da_carteira")}</p>
                <Link className="text-link" href={rota("/agencias")}>{t("para_agencias_e_estudios")}{" "}<span aria-hidden="true">→</span></Link>
              </div>
              <div className="aud">
                <h3>{t("empresas_e_marketing")}</h3>
                <p>{t("mantenha_agencias_fornecedores_e_equipes")}</p>
                <Link className="text-link" href={rota("/empresas")}>{t("para_empresas")}{" "}<span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <p className="aud-note">{t("designers_independentes_tambem_assinam")}</p>
          </div>
        </section>

        <section className="panel" id="depoimentos" aria-label={t("o_que_dizem_as_agencias")}>
          <Losango classe="l3" velocidade={-0.28} />
          <div className="wrap">
            <p className="eyebrow">{t("quem_usa")}</p>
            <Titulo className="title rise" partes={[t("mais_tempo_para_a_criacao")]} />
            <div className="quotes">
              <figure className="quote">
                <blockquote>{t("a_pergunta_que_mais_chegava")}</blockquote>
                <figcaption><i>✦</i><div>{t("depoimento_ficticio")}<span>{t("texto_de_marcacao_do_layout")}</span></div></figcaption>
              </figure>
              <figure className="quote">
                <blockquote>{t("entregamos_a_marca_e_ela")}</blockquote>
                <figcaption><i>✦</i><div>{t("depoimento_ficticio")}<span>{t("texto_de_marcacao_do_layout")}</span></div></figcaption>
              </figure>
              <figure className="quote">
                <blockquote>{t("mandar_o_kit_para_a")}</blockquote>
                <figcaption><i>✦</i><div>{t("depoimento_ficticio")}<span>{t("texto_de_marcacao_do_layout")}</span></div></figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="panel" id="ferramentas" aria-label={t("ferramentas_gratuitas")}>
          <Losango classe="l1" velocidade={-0.3} />
          <div className="wrap">
            <p className="eyebrow">{t("ferramentas")}</p>
            <Titulo className="title rise" partes={[t("quatro_ferramentas"), " ", { em: t("tres_de_graca") }, "."]} />
            <p className="intro">{t("para_quem_desdobra_marcas_todo")}</p>
            <div className="ferr-grid">
              <article className="ferr ferr--destaque">
                <h3>Fonts</h3>
                <p className="ferr-what">{t("o_app_que_ativa_as_2")}</p>
                <dl className="ferr-tier">
                  <div><dt>{t("50_primeiros")}</dt><dd>{t("90_dias_de_graca_por")}</dd></div>
                  <div><dt className="sub">{t("assinante")}</dt><dd>{t("vem_incluso_na_assinatura_com")}</dd></div>
                </dl>
                <Link className="btn" href={rota("/fonts")}>{t("pedir_convite")}{" "}<span className="arrow" aria-hidden="true">→</span></Link>
              </article>
              <article className="ferr">
                <h3>Kit</h3>
                <p className="ferr-what">{t("um_logo_entra_saem_todos")}</p>
                <dl className="ferr-tier">
                  <div><dt>{t("gratis")}</dt><dd>{t("todos_os_tamanhos_a_partir")}</dd></div>
                  <div><dt className="sub">{t("assinante")}</dt><dd>{t("usa_o_logo_e_as")}</dd></div>
                </dl>
                <Link className="btn btn--ghost" href={rota("/ferramentas/kit")}>{t("usar_o_kit")}{" "}<span className="arrow" aria-hidden="true">→</span></Link>
              </article>
              <article className="ferr">
                <h3>{t("cores")}</h3>
                <p className="ferr-what">{t("que_cor_e_essa_conta")}</p>
                <dl className="ferr-tier">
                  <div><dt>{t("gratis")}</dt><dd>{t("mede_qualquer_cor_e_mostra")}</dd></div>
                  <div><dt className="sub">{t("assinante")}</dt><dd>{t("compara_com_a_paleta_aprovada")}</dd></div>
                </dl>
                <Link className="btn btn--ghost" href={rota("/ferramentas/cores")}>{t("usar_o_cores")}{" "}<span className="arrow" aria-hidden="true">→</span></Link>
              </article>
              <article className="ferr">
                <h3>Grids</h3>
                <p className="ferr-what">{t("o_grid_pronto_para_o")}</p>
                <dl className="ferr-tier">
                  <div><dt>{t("gratis")}</dt><dd>{t("13_formatos_com_os_quatro")}</dd></div>
                  <div><dt className="sub">{t("assinante")}</dt><dd>{t("todos_os_formatos_com_logo")}</dd></div>
                </dl>
                <Link className="btn btn--ghost" href={rota("/ferramentas/grids")}>{t("usar_o_grids")}{" "}<span className="arrow" aria-hidden="true">→</span></Link>
              </article>
            </div>
            <p className="plans-note">{t("as_versoes_de_assinante_moram")}</p>
          </div>
        </section>

        <section className="panel" id="planos" aria-label={t("planos")}>
          <Losango classe="l4" velocidade={0.35} />
          <div className="wrap">
            <div className="plans-head">
              <div>
                <p className="eyebrow">{t("planos_de_assinatura")}</p>
                <Titulo className="title rise" partes={[t("planos_pelo_numero_de_marcas")]} />
              </div>
            </div>
            <div className="plans">
              <article className="plan">
                <h3>{t("basico")}</h3><p className="plan-for">{t("para_quem_cuida_de_poucas")}</p>
                <div className="price">{t("a_definir")}<span>{t("valor_da_assinatura")}</span></div>
                <dl><div><dt>{t("marcas")}</dt><dd className="hi">{t("ate_5")}</dd></div><div><dt>{t("pessoas")}</dt><dd>{t("ilimitadas")}</dd></div><div><dt>{t("armazenamento")}</dt><dd>{t("a_definir_2")}</dd></div><div><dt>{t("uso_do_vini")}</dt><dd>{t("limite_do_plano")}</dd></div><div><dt>{t("implantacao_assistida")}</dt><dd>—</dd></div></dl>
                <Link className="btn" href="/assinar?plano=basico" prefetch={false} data-assinar="basico">{t("assinar")}</Link>
              </article>
              <article className="plan">
                <h3>{t("medio")}</h3><p className="plan-for">{t("para_estudios_com_carteira_em")}</p>
                <div className="price">{t("a_definir")}<span>{t("valor_da_assinatura")}</span></div>
                <dl><div><dt>{t("marcas")}</dt><dd className="hi">{t("dez_ou_quinze")}</dd></div><div><dt>{t("pessoas")}</dt><dd>{t("ilimitadas")}</dd></div><div><dt>{t("armazenamento")}</dt><dd>{t("a_definir_2")}</dd></div><div><dt>{t("uso_do_vini")}</dt><dd>{t("limite_do_plano")}</dd></div><div><dt>{t("implantacao_assistida")}</dt><dd>{t("a_definir_2")}</dd></div></dl>
                <Link className="btn" href="/assinar?plano=medio" prefetch={false} data-assinar="medio">{t("assinar")}</Link>
              </article>
              <article className="plan feat">
                <h3>{t("premium")}</h3><p className="plan-for">{t("para_agencias_com_muitas_marcas")}</p>
                <div className="price">{t("a_definir")}<span>{t("valor_da_assinatura")}</span></div>
                <dl><div><dt>{t("marcas")}</dt><dd className="hi">{t("cerca_de_30")}</dd></div><div><dt>{t("pessoas")}</dt><dd>{t("ilimitadas")}</dd></div><div><dt>{t("armazenamento")}</dt><dd>{t("a_definir_2")}</dd></div><div><dt>{t("uso_do_vini")}</dt><dd>{t("limite_do_plano")}</dd></div><div><dt>{t("implantacao_assistida")}</dt><dd>{t("incluida")}</dd></div></dl>
                <Link className="btn" href="/assinar?plano=premium" prefetch={false} data-assinar="premium">{t("assinar")}</Link>
              </article>
              <article className="plan">
                <h3>{t("corporativo")}</h3><p className="plan-for">{t("para_empresas_e_grupos_com")}</p>
                <div className="price">{t("sob_consulta")}<span>{t("proposta_sob_medida")}</span></div>
                <dl><div><dt>{t("marcas")}</dt><dd className="hi">{t("sob_consulta_2")}</dd></div><div><dt>{t("pessoas")}</dt><dd>{t("ilimitadas")}</dd></div><div><dt>{t("armazenamento")}</dt><dd>{t("sob_consulta_2")}</dd></div><div><dt>{t("uso_do_vini")}</dt><dd>{t("sob_consulta_2")}</dd></div><div><dt>{t("implantacao_assistida")}</dt><dd>{t("incluida")}</dd></div></dl>
                <button className="btn" type="button" data-open="dlg-demo">{t("falar_com_a_equipe")}</button>
              </article>
            </div>
            <p className="plans-note">{t("a_assinatura_e_mensal_no")}{" "}<button className="link" type="button" data-open="dlg-demo">{t("fale_com_a_equipe")}</button>{t("uso_do_vini_acima_do")}</p>
          </div>
        </section>

        <section className="panel closing" id="demonstracao" aria-label={t("demonstracao")}>
          <Losango classe="l1" velocidade={-0.28} />
          <div className="wrap">
            <p className="eyebrow">{t("demonstracao")}</p>
            <Titulo className="rise" partes={[t("voce_entregou_a_marca_a")]} />
            <p>{t("veja_como_o_brennimark_ajuda")}</p>
            <p className="forge">{t("uma_marca_e_forjada_com")}</p>
            <div className="actions">
              <button className="btn" type="button" data-open="dlg-demo">{t("agendar_uma_demonstracao")}{" "}<span className="arrow" aria-hidden="true">↗</span></button>
              <Link className="btn btn--ghost" href={rota("/#plataforma")}>{t("ver_a_plataforma")}{" "}<span className="arrow" aria-hidden="true">→</span></Link>
            </div>
            <footer className="site-foot">
              <Link className="lockup" href={rota("/")} aria-label={rodape("voltarInicio")}><svg viewBox="0 0 750 170" role="img" aria-label="Brennimark"><use href="#bm-logo" /></svg></Link>
              <nav className="foot-links" aria-label={rodape("institucional")}><Link href={rota("/manifesto")}>{rodape("manifesto")}</Link><Link href={rota("/ajuda#suporte")}>{rodape("suporte")}</Link><Link href={rota("/termos")}>{rodape("termos")}</Link><Link href={rota("/privacidade")}>{rodape("privacidade")}</Link><Link href={rota("/licenca-de-fontes")}>{rodape("licencaDeFontes")}</Link></nav>
              <LinksDasFerramentas />
              <span className="foot-empresa" data-empresa>
                {rodape.rich("empresa", {
                  cnpj: EMPRESA.cnpj,
                  mail: () => <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>,
                })}
              </span>
            </footer>
          </div>
        </section>
    </>
  );
}
