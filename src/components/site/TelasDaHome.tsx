import Image from "next/image";
import type { CSSProperties } from "react";
import maosComPranchas from "./imagens/maos-com-pranchas.webp";
import vini from "./imagens/vini.webp";

/**
 * As telas de produto que a home mostra no tour (22/10/2026). São os mesmos
 * estudos de interface que já existiam na home e nas páginas internas, reunidos
 * aqui para a home mostrar a plataforma inteira numa seção só.
 *
 * Estudos de tela, com dados de demonstração conferidos com o manual do
 * Brennimark. A direção é trocá-los aos poucos por mockups ambientados.
 *
 * O roteiro da demonstração (22/10/2026): `passo(n)` diz em que momento cada
 * elemento entra quando a tela toca no tour (n × 0,8 s). As classes dizem
 * como: `passo` surge, `digita` se escreve da esquerda para a direita,
 * `pensando` são os três pontos que somem quando a resposta chega, `clique` é
 * o toque num botão. Sem movimento ligado, tudo aparece pronto (ver site.css).
 */
const passo = (n: number) => ({ "--p": n }) as CSSProperties;

function Pensando({ n }: { n: number }) {
  return <span className="pensando" style={passo(n)} aria-hidden="true"><i /><i /><i /></span>;
}
export function TelaManual() {
  return (
<div className="frame">
                <div className="app" role="img" aria-label="Estudo da tela do manual: o PDF no centro, o segmento Manual, Materiais e Complementos no alto, a coluna de ícones à esquerda e a janela do Vini citando uma página">
                  <div className="app-rail">
                    <svg className="sym" viewBox="0 0 178 162" aria-hidden="true"><use href="#bm-simbolo" /></svg>
                    <span className="rail-brand">B</span>
                    <span className="rail-i on"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" /></svg></span>
                    <span className="rail-i"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 14c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4" /><path d="M11 3.5a2.2 2.2 0 1 1 0 4.4M12.5 10.2c1.2.5 2 1.8 2.3 3.8" /></svg></span>
                    <span className="rail-i"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 4h10M3 8h10M3 12h7" /></svg></span>
                    <span className="rail-i"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" /></svg></span>
                  </div>
                  <div className="app-main">
                    <div className="app-bar">
                      <div className="seg"><span className="on">Manual</span><span>Materiais</span><span>Complementos</span></div>
                      <div className="bar-acts"><span>Índice ▾</span><span>Buscar</span><span>Zoom ▾</span><span>•••</span></div>
                    </div>
                    <div className="app-stage">
                      <div className="pdf">
                        <div className="pdf-left"><small>BRENNIMARK · MANUAL DA MARCA</small><b>01</b><strong>Área de proteção</strong><i></i><i></i><i></i></div>
                        <div className="pdf-right"><div className="clear"><svg className="sym" viewBox="0 0 178 162" aria-hidden="true"><use href="#bm-simbolo" /></svg></div></div>
                      </div>
                      <div className="chap-tab passo" style={passo(1)}><span>ÁREA DE PROTEÇÃO</span></div>
                      <div className="vini-dock passo" style={passo(2)}>
                      <Image className="vini-peek" src={vini} alt="" sizes="54px" />
                      <div className="vini-win">
                        <div className="vini-top">VINI · BRENNIMARK</div>
                        <p className="vini-q passo digita" style={passo(3)}>Qual é a área de proteção?</p>
                        <Pensando n={4.5} />
                        <p className="vini-a passo" style={passo(5.5)}>É <b>x</b>, a altura do B do letreiro, nos quatro lados. <span className="cite clique" style={passo(6.5)}>Manual, p. 9</span></p>
                      </div>
                      </div>
                    </div>
                    <div className="app-folio"><span>9 / 33</span><span>Área de proteção</span><span>ajustado à largura</span></div>
                  </div>
                </div>
              </div>
  );
}

export function TelaConsulta() {
  return (
<div className="chat">
              <div className="chat-win">
                <div className="chat-head"><Image src={vini} alt="" sizes="34px" /><div className="passo" style={passo(0.9)}><b>Vini Max</b><br /><span>Manual do Brennimark</span></div></div>
                <div className="turn">
                  <p className="q passo digita" style={passo(1)}>Qual é a área de proteção do símbolo?</p>
                  <Pensando n={2.5} />
                  <p className="a passo" style={passo(3.5)}>É x nos quatro lados. No símbolo sozinho, x equivale a um terço da altura dele. Nenhum texto ou imagem entra nesse espaço.</p>
                  <span className="src passo" style={passo(4.2)}>Fonte: Manual do Brennimark · Área de proteção do símbolo · p. 10</span>
                </div>
                <div className="turn">
                  <p className="q passo digita" style={passo(5.5)}>Posso aplicar o símbolo sobre uma foto?</p>
                  <Pensando n={7} />
                  <p className="a passo" style={passo(8)}>O manual não trata do símbolo sobre fotografia. Existe um complemento sobre isso, ainda em rascunho, então ele não vale como regra. Vale confirmar com quem gere a marca.</p>
                  <span className="src passo" style={passo(8.7)}>Procurado em: Marca, p. 4–12 · Linguagem fotográfica, p. 24–26 · Complementos</span>
                </div>
              </div>
            </div>
  );
}

export function TelaAnalise() {
  return (
<div className="frame">
                <div className="app" role="img" aria-label="Estudo da tela de análise: uma peça de exemplo à esquerda com um ponto marcado, e à direita a lista de verificações com um erro de cor e dois itens de verificação manual">
                  <div className="app-rail">
                    <svg className="sym" viewBox="0 0 178 162" aria-hidden="true"><use href="#bm-simbolo" /></svg>
                    <span className="rail-brand">B</span>
                    <span className="rail-i on"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" /></svg></span>
                    <span className="rail-i"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 14c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4" /></svg></span>
                    <span className="rail-i"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 4h10M3 8h10M3 12h7" /></svg></span>
                  </div>
                  <div className="app-main">
                    <div className="app-bar">
                      <div className="seg"><span className="on">Manual</span><span>Materiais</span><span>Complementos</span></div>
                      <div className="bar-acts"><span>Índice ▾</span><span>Buscar</span></div>
                    </div>
                    <div className="an-stage">
                      <div className="an-ghost" aria-hidden="true"><i></i><i></i><i></i></div>
                      <div className="an-win">
                        <div className="an-head"><Image src={vini} alt="" sizes="34px" /><span>VINI · ANÁLISE DE PEÇA</span><em>post_lancamento.png</em></div>
                        <div className="an-body">
                          <div className="post passo" style={passo(1)} aria-hidden="true">
                            <small>BRENNIMARK</small>
                            <b>Uma marca é forjada uma vez.</b>
                            <span className="post-bar"></span>
                            <svg className="post-sym" viewBox="0 0 178 162"><use href="#bm-simbolo" /></svg>
                            <span className="pin passo" style={passo(3)}>1</span>
                          </div>
                          <ol className="checks">
                            <li className="fail passo" style={passo(2.5)}><span className="n">1</span><div className="passo" style={passo(1.8)}><b>Cor fora da paleta</b><p>A faixa usa <code><i className="sw" style={{ background: "#ff7a2f" }}></i>#FF7A2F</code>. A cor mais próxima da paleta é Brasa <code><i className="sw" style={{ background: "#ff4103" }}></i>#FF4103</code>.</p><cite>Paleta de cores primárias · p. 13</cite></div><span className="v">Revisar</span></li>
                            <li className="ok passo" style={passo(3.5)}><span className="n">✓</span><div className="passo" style={passo(2.7)}><b>Fundo Noite Polar</b><p><code>#001621</code>, dentro da paleta.</p></div><span className="v">Passa</span></li>
                            <li className="man passo" style={passo(4.3)}><span className="n">–</span><div className="passo" style={passo(3.6)}><b>Área de proteção do símbolo</b><p>Verificação manual: depende do tamanho real da peça.</p><cite>Área de proteção do símbolo · p. 10</cite></div><span className="v">Manual</span></li>
                            <li className="man passo" style={passo(5)}><span className="n">–</span><div className="passo" style={passo(4.5)}><b>Tipografia</b><p>Verificação manual nesta versão.</p></div><span className="v">Manual</span></li>
                          </ol>
                        </div>
                        <div className="an-foot"><span className="an-stamp passo" style={passo(6)}>REVISÃO NECESSÁRIA · 1 ACHADO</span><span className="an-btn clique" style={passo(7)}>Gerar o prompt de correção</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
  );
}

export function TelaPrompt() {
  return (
<div className="dna-pair">
              <div className="dna-prompt">
                <div className="dna-top"><span>PROMPT · SUA IDEIA + MANUAL DO BRENNIMARK</span><button type="button" className="copy" data-copy="#prompt-dna">Copiar</button></div>
    <p className="ask passo digita" style={passo(1)}><b>O seu pedido</b>“Uma foto para o post de lançamento: alguém revisando o manual impresso numa mesa de estúdio.”</p>
    <pre id="prompt-dna" className="prompt passo revela" style={passo(3)}>{"Fotografia para o Brennimark, formato 4:5.\n"}<span className="k">{"Cena"}</span>{"  mesa de estúdio; mãos revisando as\n      pranchas impressas de um manual de marca.\n      Gente trabalhando, sem posar.     "}<span className="ref">{"p. 24"}</span>{"\n"}<span className="k">{"Quadro"}</span>{" de cima ou na altura da mesa, perto\n      do trabalho, espaço livre p/ título. "}<span className="ref">{"p. 25"}</span>{"\n"}<span className="k">{"Luz"}</span>{"   natural, lateral, de janela. Sombras\n      frias; calor só nas luzes.        "}<span className="ref">{"p. 24"}</span>{"\n"}<span className="k">{"Cor"}</span>{"   sombras em Noite Polar "}<span className="hex"><i style={{ background: "#001621" }}></i>{"#001621"}</span>{";\n      um único ponto de Brasa "}<span className="hex"><i style={{ background: "#ff4103" }}></i>{"#FF4103"}</span>{".  "}<span className="ref">{"p. 13"}</span>{"\n"}<span className="k">{"Evitar"}</span>{" filtro de cor, duotone, sombras\n      quentes, logo de marca real.      "}<span className="ref">{"p. 26"}</span></pre>
                <p className="draft passo" style={passo(6)}><b>Fora do prompt · rascunho</b> Grão de filme leve, proposto para Linguagem fotográfica. Ainda não aprovado, por isso não entra no prompt da marca. <u>Explorar numa versão à parte, marcada como exploração</u></p>
                <p className="dna-src">A ideia é sua; as orientações vêm do manual (edição de demonstração) · Cores, p. 13 · Linguagem fotográfica, p. 24–26</p>
              </div>
              <span className="dna-arrow" aria-hidden="true">→</span>
              <figure className="dna-img passo" style={passo(7)}>
                <div className="dna-slot">‹imagem gerada<br />com este prompt›</div>
                <figcaption>Imagem gerada com este prompt, fora do Brennimark. Você revisa e decide o que usar.</figcaption>
              </figure>
            </div>
  );
}

export function TelaMateriais() {
  return (
<div className="frame">
      <div className="mk" role="img" aria-label="Tela de Materiais da marca: seis grupos de arquivos e o botão Baixar kit da marca">
      <div className="mk-bar"><div className="seg"><span>Manual</span><span className="on">Materiais</span><span>Complementos</span></div><span className="mk-btn a-direita clique" style={passo(5.5)}>Baixar kit da marca ↓</span></div>
      <div className="mk-body tiles">
      <div className="tile passo" style={passo(1.1)}><div className="tile-art dark logo"><svg viewBox="0 0 750 170"><use href="#bm-logo" /></svg></div><p>Logotipo <span>6 versões</span></p></div>
      <div className="tile passo" style={passo(1.7)}><div className="tile-art"><svg className="sym" viewBox="0 0 178 162"><use href="#bm-simbolo" /></svg></div><p>Símbolo <span>4 versões</span></p></div>
      <div className="tile passo" style={passo(2.3)}><div className="tile-art"><div className="swatches"><i style={{ background: "#ff4103" }}></i><i style={{ background: "#001621" }}></i><i style={{ background: "#072631" }}></i><i style={{ background: "#f2f5f6" }}></i></div></div><p>Cores <span>4 cores</span></p></div>
      <div className="tile passo" style={passo(2.9)}><div className="tile-art"><span className="aa">Aa</span></div><p>Tipografia <span>2 famílias</span></p></div>
      <div className="tile passo" style={passo(3.5)}><div className="tile-art"><div className="icons"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" /></svg><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></svg><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 4h10M3 8h10M3 12h7" /></svg></div></div><p>Ícones <span>48 ícones</span></p></div>
      <div className="tile passo" style={passo(4.1)}><div className="tile-art"><Image src={maosComPranchas} alt="" sizes="(max-width: 767px) 50vw, 25vw" /></div><p>Fotografia <span>3 pastas</span></p></div>
      </div>
      </div>
      </div>
  );
}

export function TelaEntrega() {
  return (
<div className="frame"><div className="mk" role="img" aria-label="Formulário de link de entrega: destinatário, materiais e validade"><div className="mk-bar"><b>Novo link de entrega</b></div><div className="mk-body form">
      <label>Para<span className="inp"><span className="passo digita" style={passo(1)}>grafica@exemplo.com.br</span></span></label>
      <label>Materiais<span className="inp chips"><em className="passo" style={passo(2.5)}>Logotipo</em><em className="passo" style={passo(3)}>Cores</em><em className="passo" style={passo(3.5)}>Regras de uso</em></span></label>
      <label>Válido por<span className="inp"><span className="passo digita" style={passo(4.5)}>7 dias · expira em 04/10/2026</span></span></label>
      
      <div className="form-foot"><span className="mono passo" style={{ ...passo(7), fontSize: "9.5px", color: "var(--app-muted)" }}>brennimark.com/e/7Qk2… · link copiado</span><span className="mk-btn clique" style={passo(6.3)}>Criar e copiar o link</span></div></div></div></div>
  );
}

export function TelaComplementos() {
  return (
<div className="frame"><div className="mk" role="img" aria-label="Relatório de perguntas sem resposta no manual, com o número de vezes e o atalho para escrever complemento"><div className="mk-bar"><b>As perguntas que o seu manual não responde</b><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>últimos 30 dias</span></div><div className="mk-body gaps">
      <div className="passo" style={passo(5.4)}><b>Posso usar o símbolo sobre foto?</b><span>perguntado 14 vezes</span><em className="clique" style={passo(5)}>Escrever complemento</em></div>
      <div className="passo" style={passo(6.3)}><b>Qual o tamanho mínimo do logo em digital?</b><span>perguntado 9 vezes</span><em>Escrever complemento</em></div>
      <div className="passo" style={passo(7.2)}><b>Existe versão monocromática para bordado?</b><span>perguntado 6 vezes</span><em>Escrever complemento</em></div>
      <div className="passo" style={passo(8.1)}><b>Quais emojis combinam com o tom de voz?</b><span>perguntado 4 vezes</span><em>Escrever complemento</em></div></div></div></div>
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
