import Image, { type StaticImageData } from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { telas } from "./telas";
import type { CSSProperties, ReactNode } from "react";
import vini from "./imagens/vini.webp";
import fotoDoPrompt from "./imagens/telas/prompt-resultado.webp";

/**
 * As telas do tour da home (22/10/2026): capturas REAIS da plataforma, feitas
 * na marca Brennimark (manual v0.3) em produção. Pedido do André: no lugar dos
 * estudos desenhados em código, o produto de verdade.
 *
 * O que muda com a captura: dados pessoais saem na imagem (o e-mail de quem
 * criou o link vira "Equipe Brennimark", e o endereço real do link de entrega
 * vira um exemplo — um link ativo no site seria um link aberto).
 *
 * O roteiro da demonstração continua: `passo(n)` diz quando cada destaque
 * acende (n × 0,8 s, ver TourDaPlataforma). O destaque é uma moldura em Brasa
 * sobre a região da tela, posicionada em pixels da própria captura — se a
 * captura for refeita, as caixas vêm junto. Sem movimento, tudo aparece pronto.
 */
const passo = (n: number) => ({ "--p": n }) as CSSProperties;

/**
 * As caixas são escritas em pixels CSS do quadro de 1440 × 900; a captura tem o
 * dobro (2880 × 1800, tirada com densidade 2 para ficar nítida). `c()` faz a conversão.
 */
const c = (x0: number, y0: number, x1: number, y1: number): Caixa => [x0 * 2, y0 * 2, x1 * 2, y1 * 2];

/** Uma região da captura, em pixels da imagem: [x0, y0, x1, y1]. */
type Caixa = readonly [number, number, number, number];
type Destaque = { caixa: Caixa; n: number; rotulo?: string };

/**
 * A câmera: a tela começa inteira e, no passo `n`, aproxima a região `caixa`,
 * que vai para o centro do quadro sem deixar borda vazia. Os destaques ficam
 * dentro da câmera e aproximam junto; o rótulo divide o tamanho pela
 * aproximação (`--z`), para continuar com o mesmo corpo.
 */
type Foco = { caixa: Caixa; n: number };

function camera(foco: Foco | undefined, w: number, h: number): CSSProperties | undefined {
  if (!foco) return undefined;
  const [x0, y0, x1, y1] = foco.caixa;
  const z = Math.min(2.2, w / (x1 - x0), h / (y1 - y0));
  const limitar = (t: number) => Math.min(0, Math.max((1 - z) * 100, t));
  const tx = limitar(50 - (z * ((x0 + x1) / 2) / w) * 100);
  const ty = limitar(50 - (z * ((y0 + y1) / 2) / h) * 100);
  return { ...passo(foco.n), "--z": z, "--alvo": `translate(${tx}%, ${ty}%) scale(${z})` } as CSSProperties;
}

type Quadro = { src: StaticImageData; alt: string; destaques: Destaque[]; foco?: Foco };

function Camada({ src, alt, destaques, foco }: Quadro) {
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;
  return (
    <div className={foco ? "tela-camera" : "tela-quieta"} style={camera(foco, src.width, src.height)}>
      <Image src={src} alt={alt} sizes="(max-width: 1023px) 100vw, 60vw" />
      {destaques.map(({ caixa: [x0, y0, x1, y1], n, rotulo }) => (
        <span
          key={`${x0}-${y0}`}
          className="destaque passo"
          aria-hidden="true"
          // O rótulo vai por baixo quando a caixa encosta no topo, e alinha
          // pela direita quando ela está na metade direita da tela.
          data-abaixo={y0 / src.height < 0.08 ? "" : undefined}
          data-direita={x0 / src.width > 0.5 ? "" : undefined}
          style={{ ...passo(n), left: pct(x0, src.width), top: pct(y0, src.height), width: pct(x1 - x0, src.width), height: pct(y1 - y0, src.height) }}
        >
          {rotulo ? <em>{rotulo}</em> : null}
        </span>
      ))}
    </div>
  );
}

/**
 * Uma tela real, com destaques e câmera. `depois` é uma segunda captura que
 * entra por cima, em fade, no passo `n` — a mesma tela noutro momento (a regra
 * publicada e, em seguida, o assistente citando a regra). `lupa` é um detalhe
 * REDESENHADO, fiel ao da plataforma (mesmos textos, cores e tamanhos de
 * letra), ampliado para ler no tamanho em que o site mostra a tela.
 */
function TelaReal({ src, alt, destaques, foco, depois, lupa }: Quadro & { depois?: Quadro & { n: number }; lupa?: ReactNode }) {
  return (
    <div className="frame tela-real">
      <div className="tela-real-img" style={{ aspectRatio: `${src.width} / ${src.height}` }}>
        <Camada src={src} alt={alt} destaques={destaques} foco={foco} />
        {depois ? (
          <div className="troca" style={passo(depois.n)}>
            <Camada src={depois.src} alt={depois.alt} destaques={depois.destaques} foco={depois.foco} />
          </div>
        ) : null}
        {lupa}
      </div>
    </div>
  );
}

/** O trecho de uma resposta do assistente, como a plataforma o desenha. */
function Citacao({ rotulo, titulo, pagina, selo, tom }: { rotulo?: string; titulo: string; pagina?: string; selo: string; tom: "ok" | "rascunho" }) {
  return (
    // Um `span`, e não um `a`: é só o desenho da citação (na plataforma é um
    // link), e um `<a>` sem destino quebra o teste que confere os links do tour.
    <span className="cita" aria-hidden="true">
      {rotulo ? <span className="mut">{rotulo}</span> : null}
      <span>{titulo}</span>
      {pagina ? <span className="mut">{pagina}</span> : null}
      <b className={tom}>{selo}</b>
    </span>
  );
}

export async function TelaManual() {
  const idioma = await getLocale();
  const tel = telas(idioma);
  const en = idioma === "en";
  const t = await getTranslations("site.homeTelas");
  return (
    <TelaReal
      src={tel.manual}
      alt={t("o_manual_do_brennimark_aberto")}
      destaques={[
        { caixa: en ? c(596, 8, 738, 48) : c(556, 8, 632, 48), n: 1, rotulo: t("indice_e_busca") },
        { caixa: c(572, 136, 1262, 656), n: 2.5, rotulo: t("o_manual_como_o_estudio") },
        { caixa: c(158, 848, 480, 884), n: 4.5, rotulo: t("pagina_14_de_42") },
      ]}
    />
  );
}

export async function TelaConsulta() {
  const idioma = await getLocale();
  const tel = telas(idioma);
  const en = idioma === "en";
  const t = await getTranslations("site.homeTelas");
  return (
    <TelaReal
      src={tel.assistente}
      alt={t("a_janela_do_assistente_sobre")}
      foco={{ caixa: c(975, 185, 1435, 825), n: 0.4 }}
      destaques={[
        { caixa: en ? c(996, 286, 1400, 316) : c(996, 286, 1216, 316), n: 1, rotulo: t("a_pergunta") },
        { caixa: c(996, 350, 1412, 618), n: 2.8, rotulo: t("a_resposta_com_a_pagina") },
        { caixa: en ? c(1204, 424, 1370, 456) : c(1164, 428, 1360, 460), n: 4.6 },
      ]}
    />
  );
}

export async function TelaAnalise() {
  const idioma = await getLocale();
  const tel = telas(idioma);
  const en = idioma === "en";
  const t = await getTranslations("site.homeTelas");
  return (
    <TelaReal
      src={tel.revisao}
      alt={t("a_revisao_de_um_post")}
      destaques={[
        { caixa: en ? c(1018, 158, 1230, 262) : c(1018, 158, 1230, 276), n: 1, rotulo: t("a_peca_enviada") },
        { caixa: en ? c(836, 282, 950, 316) : c(836, 314, 944, 348), n: 2.6 },
        { caixa: en ? c(836, 340, 1410, 726) : c(836, 420, 1410, 576), n: 3.8, rotulo: t("cada_achado_com_a_regra") },
      ]}
      lupa={en ? undefined : (
        <div className="lupa lupa-revisao passo" style={passo(6)} aria-hidden="true">
          <span className="selo-vermelho">{t("desalinhada")}</span>
          <p>{t("lupa_revisao")}{" "}
            <Citacao titulo={t("o_logotipo_nas_pecas")} pagina={t("pagina_abreviada", { n: 12 })} selo={t("pronto")} tom="ok" />.</p>
        </div>
      )}
    />
  );
}

export async function TelaPrompt() {
  const idioma = await getLocale();
  const tel = telas(idioma);
  const t = await getTranslations("site.homeTelas");
  return (
    <TelaReal
      src={tel.prompt}
      alt={t("o_assistente_monta_o_prompt")}
      destaques={[
        { caixa: c(836, 160, 1412, 436), n: 1.2, rotulo: t("o_prompt_com_as_regras") },
        { caixa: c(836, 492, 1066, 650), n: 3.4, rotulo: t("as_paginas_de_onde_veio") },
        { caixa: c(836, 668, 1412, 738), n: 5.2, rotulo: t("a_sua_ideia") },
      ]}
      // O resultado (23/10/2026): a foto gerada com ESTE prompt, no Higgsfield, e
      // não uma imagem qualquer. O prompt da captura é o que o Vini gerou.
      lupa={
        <figure className="resultado passo" style={passo(7.4)}>
          <Image src={fotoDoPrompt} alt={t("fotografia_gerada_por_ia_a")} sizes="(max-width: 767px) 60vw, 26vw" />
          <figcaption><b>{t("a_imagem_gerada_com_este")}</b>{t("fora_do_brennimark_voce_revisa")}</figcaption>
        </figure>
      }
    />
  );
}

export async function TelaMateriais() {
  const idioma = await getLocale();
  const tel = telas(idioma);
  const en = idioma === "en";
  const t = await getTranslations("site.homeTelas");
  return (
    <TelaReal
      src={tel.materiais}
      alt={t("materiais_da_marca_as_versoes")}
      destaques={[
        { caixa: c(164, 134, 262, 610), n: 1, rotulo: t("a_miniatura_de_cada_arquivo") },
        { caixa: en ? c(598, 6, 868, 50) : c(560, 6, 858, 50), n: 2.8, rotulo: t("busca_e_filtro_por_tipo") },
      ]}
    />
  );
}

export async function TelaEntrega() {
  const idioma = await getLocale();
  const tel = telas(idioma);
  const en = idioma === "en";
  const t = await getTranslations("site.homeTelas");
  return (
    <TelaReal
      src={tel.linksCriado}
      alt={t("links_de_entrega_um_link")}
      foco={{ caixa: en ? c(190, 215, 1310, 600) : c(190, 230, 1310, 620), n: 0.4 }}
      destaques={[
        { caixa: en ? c(200, 226, 1296, 418) : c(200, 245, 1296, 442), n: 1, rotulo: t("o_link_aparece_uma_vez") },
        { caixa: en ? c(200, 452, 1296, 590) : c(200, 500, 1296, 606), n: 3.2, rotulo: t("prazo_arquivos_e_downloads_registrados") },
      ]}
      depois={{
        n: 5,
        src: tel.receber,
        alt: t("alt_entrega_receber"),
        foco: { caixa: c(268, 470, 1172, 895), n: 5.7 },
        destaques: [
          { caixa: c(268, 186, 1172, 352), n: 6.2, rotulo: t("quem_baixa_se_identifica_e") },
          { caixa: c(268, 580, 1172, 892), n: 7.6, rotulo: t("a_regra_do_manual_vem") },
        ],
      }}
    />
  );
}

export async function TelaComplementos() {
  const idioma = await getLocale();
  const tel = telas(idioma);
  const en = idioma === "en";
  const t = await getTranslations("site.homeTelas");
  return (
    <TelaReal
      src={tel.complementos}
      foco={{ caixa: c(330, 270, 1160, 700), n: 0.4 }}
      alt={t("complementos_uma_regra_nova_sobre")}
      destaques={[
        { caixa: c(348, 300, 1148, 332), n: 1, rotulo: t("o_que_o_manual_nao") },
        { caixa: c(348, 360, 1148, 616), n: 2.4 },
        { caixa: c(348, 626, 572, 666), n: 3.8, rotulo: t("publicada_vale_para_a_equipe") },
      ]}
      depois={{
        n: 5,
        src: tel.viniComplemento,
        alt: t("alt_vini_complemento"),
        destaques: [
          { caixa: en ? c(996, 350, 1412, 600) : c(996, 350, 1412, 450), n: 5.8, rotulo: t("cita_a_regra_nova") },
        ],
      }}
      // A lupa é a resposta redesenhada, igual à da captura; a da captura em inglês é outra resposta, então ali ela não entra.
      lupa={en ? undefined : (
        <div className="lupa lupa-vini passo" style={passo(7.6)} aria-hidden="true">
          <p>{t("lupa_vini_sim")}{" "}
            <Citacao rotulo={t("complemento")} titulo={t("o_logotipo_sobre_fotografia")} selo={t("pronto")} tom="ok" />.</p>
          <p>{t("lupa_vini_nao_cobre")}{" "}
            <Citacao titulo={t("o_logotipo_nas_pecas")} pagina={t("pagina_abreviada", { n: 12 })} selo={t("pronto")} tom="ok" />{t("mas_ha_um_complemento_especifico")}</p>
        </div>
      )}
    />
  );
}

export async function FichaDoVini() {
  const t = await getTranslations("site.homeTelas");
  return (
<div className="vini-fig">
              <div className="stage">
                <video id="vini-video" poster={vini.src} autoPlay muted loop playsInline preload="none" data-webm="/site/vini.webm" data-mov="/site/vini.mov" aria-label={t("vini_max_o_assistente_do")}></video>
                <span className="stage-tag">ASSISTENTE DE MARCA</span>
              </div>
              <dl className="ficha">
                <div><dt>{t("nome")}</dt><dd>Vini Max</dd></div>
                <div><dt>{t("pode_chamar_de")}</dt><dd>Vini</dd></div>
                <div><dt>{t("funcao")}</dt><dd>{t("consultor_de_marca")}</dd></div>
                <div><dt>{t("responde_com")}</dt><dd>{t("a_orientacao_e_a_fonte")}</dd></div>
                <div><dt>{t("onde_vive")}</dt><dd>{t("no_canto_de_cada_tela")}</dd></div>
                <div><dt>{t("nao_faz")}</dt><dd>{t("aprovar_a_peca_por_voce")}</dd></div>
              </dl>
            </div>
  );
}
