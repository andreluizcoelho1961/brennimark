import Image, { type StaticImageData } from "next/image";
import type { CSSProperties, ReactNode } from "react";
import vini from "./imagens/vini.webp";
import telaManual from "./imagens/telas/manual.webp";
import telaAssistente from "./imagens/telas/assistente.webp";
import telaRevisao from "./imagens/telas/revisao.webp";
import telaPrompt from "./imagens/telas/prompt.webp";
import telaMateriais from "./imagens/telas/materiais.webp";
import telaEnvio from "./imagens/telas/envio.webp";
import telaComplementos from "./imagens/telas/complementos.webp";
import telaViniComplemento from "./imagens/telas/vini-complemento.webp";

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
function Citacao({ rotulo, titulo, selo, tom }: { rotulo?: string; titulo: string; selo: string; tom: "ok" | "rascunho" }) {
  return (
    <a className="cita" aria-hidden="true" tabIndex={-1}>
      {rotulo ? <span className="mut">{rotulo}</span> : null}
      <span>{titulo}</span>
      <b className={tom}>{selo}</b>
    </a>
  );
}

export function TelaManual() {
  return (
    <TelaReal
      src={telaManual}
      foco={{ caixa: [150, 0, 1300, 773], n: 0.4 }}
      alt="O manual do Brennimark aberto na plataforma, na página 14, a paleta de cores primárias, com índice e busca no topo"
      destaques={[
        { caixa: [556, 10, 618, 44], n: 1, rotulo: "Índice" },
        { caixa: [192, 70, 1272, 682], n: 2.5, rotulo: "O PDF do estúdio, página por página" },
        { caixa: [154, 730, 472, 760], n: 4.5 },
      ]}
    />
  );
}

export function TelaConsulta() {
  return (
    <TelaReal
      src={telaAssistente}
      foco={{ caixa: [880, 180, 1412, 490], n: 0.4 }}
      alt="A janela do assistente sobre o manual: a pergunta sobre a área de proteção do logo e a resposta citando a página 10"
      destaques={[
        { caixa: [978, 202, 1206, 252], n: 1, rotulo: "A pergunta" },
        { caixa: [978, 288, 1402, 476], n: 2.8, rotulo: "A resposta, com a página do manual" },
        { caixa: [984, 332, 1188, 360], n: 4.6 },
      ]}
    />
  );
}

export function TelaAnalise() {
  return (
    <TelaReal
      src={telaRevisao}
      alt="A revisão de um post: o assistente marca a peça como desalinhada, com o logotipo grande demais e encostado na borda, citando a página 12"
      destaques={[
        { caixa: [1018, 76, 1187, 202], n: 1, rotulo: "A peça enviada" },
        { caixa: [824, 244, 928, 276], n: 2.6 },
        { caixa: [838, 352, 1398, 502], n: 3.8, rotulo: "O que está fora da regra, e onde a regra está" },
      ]}
      lupa={
        <div className="lupa lupa-revisao passo" style={passo(6)} aria-hidden="true">
          <span className="selo-vermelho">Desalinhada</span>
          <p><b>Violação objetiva de margem:</b> o logotipo está praticamente encostado nas bordas inferior e esquerda, descumprindo a margem mínima de 2x{" "}
            <Citacao titulo="O logotipo nas peças" rotulo="" selo="Rascunho" tom="rascunho" />.</p>
        </div>
      }
    />
  );
}

export function TelaPrompt() {
  return (
    <TelaReal
      src={telaPrompt}
      foco={{ caixa: [810, 120, 1412, 560], n: 0.4 }}
      alt="O assistente monta o prompt de uma foto para o post de lançamento, com as cores e a luz do manual"
      destaques={[
        { caixa: [824, 486, 1396, 548], n: 1, rotulo: "A sua ideia" },
        { caixa: [824, 138, 1382, 422], n: 2.8, rotulo: "O prompt, com as regras da marca" },
        { caixa: [824, 428, 942, 468], n: 5 },
      ]}
    />
  );
}

export function TelaMateriais() {
  return (
    <TelaReal
      src={telaMateriais}
      alt="Materiais da marca: as versões do logotipo e do símbolo do Brennimark, cada uma com o seu arquivo"
      destaques={[
        { caixa: [156, 130, 1314, 202], n: 1, rotulo: "Cada versão do logo, num lugar só" },
        { caixa: [156, 214, 1314, 604], n: 2.6 },
      ]}
    />
  );
}

export function TelaEntrega() {
  return (
    <TelaReal
      src={telaEnvio}
      foco={{ caixa: [170, 230, 1300, 570], n: 0.4 }}
      alt="Links de entrega: um link criado para uma gráfica, com prazo de sete dias, dois arquivos e o registro de downloads"
      destaques={[
        { caixa: [188, 243, 1280, 436], n: 1, rotulo: "O link, que aparece uma vez só" },
        { caixa: [188, 496, 1282, 554], n: 3, rotulo: "Prazo, arquivos e downloads registrados" },
      ]}
    />
  );
}

export function TelaComplementos() {
  return (
    <TelaReal
      src={telaComplementos}
      foco={{ caixa: [320, 270, 1140, 699], n: 0.4 }}
      alt="Complementos: uma regra nova sobre o logotipo sobre fotografia, já publicada, com os botões de editar, arquivar e ver o histórico"
      destaques={[
        { caixa: [330, 288, 642, 324], n: 1, rotulo: "O que o manual não cobria" },
        { caixa: [330, 350, 1124, 606], n: 2.4 },
        { caixa: [330, 614, 550, 656], n: 3.8, rotulo: "Publicada: vale para a equipe" },
      ]}
      depois={{
        n: 5,
        src: telaViniComplemento,
        alt: "O assistente responde se o logotipo pode ficar sobre uma foto e cita a regra nova, marcada como pronta, ao lado da página do manual",
        destaques: [
          { caixa: [984, 306, 1296, 340], n: 5.8, rotulo: "Cita a regra nova" },
          { caixa: [984, 366, 1212, 398], n: 7 },
        ],
      }}
      lupa={
        <div className="lupa lupa-vini passo" style={passo(7.6)} aria-hidden="true">
          <p>Sim, pode, desde que o logotipo continue legível sem esforço{" "}
            <Citacao rotulo="Complemento:" titulo="O logotipo sobre fotografia" selo="Pronto" tom="ok" />.</p>
          <p>O manual não cobre essa regra{" "}
            <Citacao titulo="O logotipo nas peças" selo="Rascunho" tom="rascunho" />, mas há um complemento específico para isso.</p>
        </div>
      }
    />
  );
}

export function FichaDoVini() {
  return (
<div className="vini-fig">
              <div className="stage">
                <video id="vini-video" poster={vini.src} autoPlay muted loop playsInline preload="none" data-webm="/site/vini.webm" data-mov="/site/vini.mov" aria-label="Vini Max, o assistente do Brennimark, gesticulando com um livro na mão"></video>
                <span className="stage-tag">ASSISTENTE DE MARCA</span>
              </div>
              <dl className="ficha">
                <div><dt>Nome</dt><dd>Vini Max</dd></div>
                <div><dt>Pode chamar de</dt><dd>Vini</dd></div>
                <div><dt>Função</dt><dd>Consultor de marca</dd></div>
                <div><dt>Responde com</dt><dd>A orientação e a fonte</dd></div>
                <div><dt>Onde vive</dt><dd>No canto de cada tela</dd></div>
                <div><dt>Não faz</dt><dd>Aprovar a peça por você</dd></div>
              </dl>
            </div>
  );
}
