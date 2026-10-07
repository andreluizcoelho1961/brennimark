import Image from "next/image";
import Link from "next/link";
import equipeNaMesa from "./imagens/equipe-na-mesa.jpg";
import maosComPranchas from "./imagens/maos-com-pranchas.webp";
import vini from "./imagens/vini.webp";
import { Losango } from "./Losango";
import { NumSoLugar } from "./NumSoLugar";
import { Titulo } from "./Titulo";

/**
 * Os 14 capítulos da home, na ordem do trilho. O segundo, "Num só lugar",
 * entrou em 03/10/2026, vindo da prévia do Codex (ver `NumSoLugar.tsx`).
 *
 * O texto é o do protótipo de 29/09/2026, convertido sem edição — autoria do
 * André. O que mudou é só a forma: imagens como arquivos otimizados, títulos
 * já em palavras, links para as páginas internas com endereço próprio.
 *
 * Os depoimentos são layout e levam a marcação "Depoimento fictício" no lugar
 * do nome (decisão do André, 29/09): o site pode ir ao ar para teste, e
 * ninguém deve tomar o texto por depoimento verdadeiro. Os planos e o e-mail
 * comercial seguem "a definir", como no protótipo.
 */
export function CapitulosDaHome() {
  return (
    <>
        <section className="panel hero is-active" id="inicio" aria-label="Início">
          <div className="hero-photo">
            <Image src={equipeNaMesa} alt="" fill sizes="(max-width: 767px) 100vw, 62vw" loading="eager" fetchPriority="high" />
          </div>
          <div className="hero-copy">
            <p className="eyebrow rise">Plataforma de gestão de marca</p>
            <Titulo como="h1" className="rise" partes={["Uma marca passa por muitas mãos. ", { em: "A ideia tem que passar por todas." }]} />
            <p className="hero-lede rise-2"><strong>Menos tempo procurando, mais segurança para decidir e mais atenção para criar.</strong> O manual, os materiais e as orientações da marca num só lugar, com o Vini para ajudar durante o trabalho.</p>
            <div className="actions rise-2">
              <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
              <Link className="btn btn--ghost" href="/#plataforma" data-go="plataforma">Ver a plataforma <span className="arrow" aria-hidden="true">→</span></Link>
            </div>
            <p className="hero-jump rise-2">Ir direto para <Link href="/#vini" data-go="vini">o Vini</Link> · <Link href="/#publico" data-go="publico">para quem é</Link> · <Link href="/#planos" data-go="planos">planos</Link></p>
          </div>
        </section>

        <NumSoLugar />

        <section className="panel" id="problema" aria-label="O problema">
          <div className="wrap pain">
            <Image className="pain-photo" src={maosComPranchas} alt="Mãos passando pranchas de um manual de marca sobre a mesa" sizes="(max-width: 767px) 100vw, 50vw" />
            <div>
              <p className="eyebrow">O problema</p>
              <Titulo className="title rise" partes={["O prazo está correndo. O manual está num PDF. Os materiais, em várias pastas."]} />
              <div className="pain-roles" aria-label="Quem desdobra a marca">
                <span>Criação</span><span>Atendimento</span><span>Marketing</span><span>Produção</span><span>Gráfica</span>
              </div>
              <p className="intro">Cada pessoa leva a identidade adiante. E cada uma precisa, de novo, achar o logo em negativo, confirmar o laranja certo e descobrir que fonte usar, enquanto a resposta demora e a entrega se aproxima.</p>
              <p><Link className="text-link" href="/#fluxo" data-go="fluxo">Veja como a plataforma ajuda <span aria-hidden="true">→</span></Link></p>
            </div>
          </div>
        </section>

        <section className="panel" id="fluxo" aria-label="O dia a dia">
          <div className="wrap">
            <div className="flow-head">
              <div>
                <p className="eyebrow">Do manual à próxima peça</p>
                <Titulo className="title rise" partes={["A ideia segue com a equipe."]} />
              </div>
            </div>
            <div className="flow">
              <article className="step">
                <p className="step-n"><b>01</b><span>Consultar</span></p>
                <h3>A regra, com a página de onde veio.</h3>
                <p>Pergunte ao Vini. Ele responde com a página do manual e diz quando não há diretriz documentada.</p>
                <div className="art" aria-hidden="true"><div className="art-page"><small>MANUAL DA MARCA · 01</small><i></i><i></i><i></i><span className="art-cite">MANUAL · P. 9</span></div></div>
              </article>
              <article className="step">
                <p className="step-n"><b>02</b><span>Criar</span></p>
                <h3>A sua ideia, com a marca junto.</h3>
                <p>Revise a peça com as orientações da marca antes de enviar, e transforme a sua ideia num prompt alinhado a ela.</p>
                <div className="art" aria-hidden="true"><div className="art-board"><small>ESTUDO DE APLICAÇÃO</small><b>Uma marca.<br />Muitas mãos.</b><small>PALETA · RESPIRO · CONTRASTE</small></div></div>
              </article>
              <article className="step">
                <p className="step-n"><b>03</b><span>Compartilhar</span></p>
                <h3>O kit inteiro, com a regra junto.</h3>
                <p>Logo, ícones e a fonte da marca num pacote, com a regra de uso de cada arquivo. Convide a equipe e os fornecedores sem pagar por pessoa.</p>
                <Link className="more" href="/materiais">Conheça Materiais da marca <span aria-hidden="true">→</span></Link>
                <div className="art" aria-hidden="true"><div className="art-kit"><small>MATERIAIS DA MARCA</small><div className="kit-row"><span>LOGO</span><span>ÍCONES</span></div><div className="kit-row"><span>FONTE</span><span>CORES</span></div><small>REGRA DE USO · INCLUÍDA</small></div></div>
              </article>
            </div>
            <p className="flow-foot">Um fluxo de trabalho, não mais uma pasta.</p>
          </div>
        </section>

        <section className="panel" id="plataforma" aria-label="A plataforma">
          <Losango classe="l1" velocidade={-0.28} />
          <div className="wrap platform">
            <div>
              <p className="eyebrow">A plataforma</p>
              <Titulo className="title rise" partes={["A marca inteira, no mesmo lugar."]} />
              <p className="intro">Consulte diretrizes e encontre materiais sem depender de arquivos dispersos ou da memória de quem participou da criação.</p>
              <p className="fidelity">O manual aparece exatamente como o estúdio diagramou. Nada é remontado.</p>
              <Link className="more" href="/manual">Conheça o manual em PDF <span aria-hidden="true">→</span></Link>
            </div>
            <div>
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
                      <div className="chap-tab"><span>ÁREA DE PROTEÇÃO</span></div>
                      <div className="vini-dock">
                      <Image className="vini-peek" src={vini} alt="" sizes="54px" />
                      <div className="vini-win">
                        <div className="vini-top">VINI · BRENNIMARK</div>
                        <p className="vini-q">Qual é a área de proteção?</p>
                        <p className="vini-a">É <b>x</b>, a altura do B do letreiro, nos quatro lados. <span className="cite">Manual, p. 9</span></p>
                      </div>
                      </div>
                    </div>
                    <div className="app-folio"><span>9 / 33</span><span>Área de proteção</span><span>ajustado à largura</span></div>
                  </div>
                </div>
              </div>
              <p className="caption">Estudo de interface com o manual do Brennimark, versão 0.2. Páginas e valores conferem com o manual.</p>
            </div>
          </div>
        </section>

        <section className="panel" id="vini" aria-label="Conheça o Vini Max">
          <Losango classe="l2" velocidade={0.35} />
          <div className="wrap vini">
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
            <div>
              <p className="eyebrow">Conheça o assistente</p>
              <Titulo className="title rise" partes={["Este é o Vini Max. ", { em: "Pode chamar de Vini." }]} />
              <p className="intro">Um colega que entende de marca e está sempre por perto. Ele consulta o manual, os complementos aprovados e os materiais para ajudar você durante o trabalho. A decisão continua sendo sua.</p>
              <ul className="traits">
                <li><i>01</i><div><b>Responde com fundamento.</b><span>Cita o manual ou o complemento, com a página.</span></div></li>
                <li><i>02</i><div><b>Encontra o material.</b><span>Aponta o arquivo certo em Materiais da marca.</span></div></li>
                <li><i>03</i><div><b>Aponta divergências.</b><span>Quando duas orientações documentadas não batem, mostra as duas.</span></div></li>
                <li><i>04</i><div><b>Reconhece o limite.</b><span>Sem resposta segura, ele diz e sugere com quem confirmar.</span></div></li>
              </ul>
              <div className="lives" aria-label="Os três estados da janela do Vini">
                <p>Mora no canto de cada tela da marca. Chama quando precisar, e ele sai da frente quando você volta ao trabalho.</p>
                <div className="st st-1"><span className="st-box"></span>recolhido</div>
                <div className="st st-2"><span className="st-box"></span>conversa</div>
                <div className="st st-3"><span className="st-box"></span>análise</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" id="assistente" aria-label="O Vini responde sobre a marca">
          <div className="wrap ai">
            <div>
              <p className="eyebrow">Vini · Consultar</p>
              <Titulo className="title rise" partes={["O manual passa a responder."]} />
              <p className="intro">Pergunte como perguntaria a um colega que conhece a marca. O Vini responde com a orientação e a página, e um clique na citação leva o manual até lá.</p>
              <ul className="ai-list">
                <li>O valor exato, nunca &quot;veja a página&quot;</li>
                <li>A citação abre o manual na página certa</li>
                <li>Rascunho aparece identificado, nunca como regra</li>
              </ul>
              <p className="honest">Quando o manual não trata do assunto, o Vini diz isso em vez de deduzir.</p>
              <Link className="more" href="/vini">Conheça o Vini Max <span aria-hidden="true">→</span></Link>
            </div>
            <div className="chat">
              <div className="chat-win">
                <div className="chat-head"><Image src={vini} alt="" sizes="34px" /><div><b>Vini Max</b><br /><span>Manual do Brennimark</span></div></div>
                <div className="turn">
                  <p className="q">Qual é a área de proteção do símbolo?</p>
                  <p className="a">É x nos quatro lados. No símbolo sozinho, x equivale a um terço da altura dele. Nenhum texto ou imagem entra nesse espaço.</p>
                  <span className="src">Fonte: Manual do Brennimark · Área de proteção do símbolo · p. 10</span>
                </div>
                <div className="turn">
                  <p className="q">Posso aplicar o símbolo sobre uma foto?</p>
                  <p className="a">O manual não trata do símbolo sobre fotografia. Existe um complemento sobre isso, ainda em rascunho, então ele não vale como regra. Vale confirmar com quem gere a marca.</p>
                  <span className="src">Procurado em: Marca, p. 4–12 · Linguagem fotográfica, p. 24–26 · Complementos</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" id="analise" aria-label="O Vini analisa uma peça">
          <div className="wrap platform">
            <div>
              <p className="eyebrow">Vini · Analisar</p>
              <Titulo className="title rise" partes={["Uma segunda leitura antes de enviar."]} />
              <p className="intro">Solte a imagem na janela do Vini. Ele compara a peça com as orientações documentadas, marca o que encontrou e mostra a página de cada uma. O que depende de medida real ou de julgamento fica para a sua revisão.</p>
              <ul className="ai-list">
                <li>Cores comparadas com a paleta, com a marcação na peça</li>
                <li>Cada achado com a regra e a página</li>
                <li>O que ele não mede sozinho vem como verificação manual</li>
              </ul>
              <p className="honest">O Vini aponta. Quem aprova a peça continua sendo a equipe.</p>
              <Link className="more" href="/vini">Conheça o Vini Max <span aria-hidden="true">→</span></Link>
            </div>
            <div>
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
                          <div className="post" aria-hidden="true">
                            <small>BRENNIMARK</small>
                            <b>Uma marca é forjada uma vez.</b>
                            <span className="post-bar"></span>
                            <svg className="post-sym" viewBox="0 0 178 162"><use href="#bm-simbolo" /></svg>
                            <span className="pin">1</span>
                          </div>
                          <ol className="checks">
                            <li className="fail"><span className="n">1</span><div><b>Cor fora da paleta</b><p>A faixa usa <code><i className="sw" style={{ background: "#ff7a2f" }}></i>#FF7A2F</code>. A cor mais próxima da paleta é Brasa <code><i className="sw" style={{ background: "#ff4103" }}></i>#FF4103</code>.</p><cite>Paleta de cores primárias · p. 13</cite></div><span className="v">Revisar</span></li>
                            <li className="ok"><span className="n">✓</span><div><b>Fundo Noite Polar</b><p><code>#001621</code>, dentro da paleta.</p></div><span className="v">Passa</span></li>
                            <li className="man"><span className="n">–</span><div><b>Área de proteção do símbolo</b><p>Verificação manual: depende do tamanho real da peça.</p><cite>Área de proteção do símbolo · p. 10</cite></div><span className="v">Manual</span></li>
                            <li className="man"><span className="n">–</span><div><b>Tipografia</b><p>Verificação manual nesta versão.</p></div><span className="v">Manual</span></li>
                          </ol>
                        </div>
                        <div className="an-foot"><span className="an-stamp">REVISÃO NECESSÁRIA · 1 ACHADO</span><span className="an-btn">Gerar o prompt de correção</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <p className="caption">Peça de exemplo, feita para esta demonstração com a marca do próprio Brennimark. As páginas citadas são do manual, versão 0.2.</p>
            </div>
          </div>
        </section>

        <section className="panel" id="dna" aria-label="O Vini prepara um prompt com o DNA da marca">
          <div className="wrap dna">
            <div>
              <p className="eyebrow">Vini · Preparar</p>
              <Titulo className="title rise" partes={["A sua ideia, com a marca no prompt."]} />
              <p className="intro">Você traz a ideia. O Vini acrescenta o que a marca documenta, com a fonte de cada linha: cores, luz, enquadramento e o que evitar. Você revisa, ajusta e usa na ferramenta de imagem da equipe.</p>
              <p className="honest">Só orientação aprovada entra no prompt. O que ainda é rascunho fica à parte, identificado, e nunca se mistura ao resultado apresentado como aderente à marca.</p>
              <Link className="more" href="/complementos">Conheça Complementos e lacunas <span aria-hidden="true">→</span></Link>
            </div>
            <div className="dna-pair">
              <div className="dna-prompt">
                <div className="dna-top"><span>PROMPT · SUA IDEIA + MANUAL DO BRENNIMARK</span><button type="button" className="copy" data-copy="#prompt-dna">Copiar</button></div>
    <p className="ask"><b>O seu pedido</b>“Uma foto para o post de lançamento: alguém revisando o manual impresso numa mesa de estúdio.”</p>
    <pre id="prompt-dna" className="prompt">{"Fotografia para o Brennimark, formato 4:5.\n"}<span className="k">{"Cena"}</span>{"  mesa de estúdio; mãos revisando as\n      pranchas impressas de um manual de marca.\n      Gente trabalhando, sem posar.     "}<span className="ref">{"p. 24"}</span>{"\n"}<span className="k">{"Quadro"}</span>{" de cima ou na altura da mesa, perto\n      do trabalho, espaço livre p/ título. "}<span className="ref">{"p. 25"}</span>{"\n"}<span className="k">{"Luz"}</span>{"   natural, lateral, de janela. Sombras\n      frias; calor só nas luzes.        "}<span className="ref">{"p. 24"}</span>{"\n"}<span className="k">{"Cor"}</span>{"   sombras em Noite Polar "}<span className="hex"><i style={{ background: "#001621" }}></i>{"#001621"}</span>{";\n      um único ponto de Brasa "}<span className="hex"><i style={{ background: "#ff4103" }}></i>{"#FF4103"}</span>{".  "}<span className="ref">{"p. 13"}</span>{"\n"}<span className="k">{"Evitar"}</span>{" filtro de cor, duotone, sombras\n      quentes, logo de marca real.      "}<span className="ref">{"p. 26"}</span></pre>
                <p className="draft"><b>Fora do prompt · rascunho</b> Grão de filme leve, proposto para Linguagem fotográfica. Ainda não aprovado, por isso não entra no prompt da marca. <u>Explorar numa versão à parte, marcada como exploração</u></p>
                <p className="dna-src">A ideia é sua; as orientações vêm do manual (edição de demonstração) · Cores, p. 13 · Linguagem fotográfica, p. 24–26</p>
              </div>
              <span className="dna-arrow" aria-hidden="true">→</span>
              <figure className="dna-img">
                <div className="dna-slot">‹imagem gerada<br />com este prompt›</div>
                <figcaption>Imagem gerada com este prompt, fora do Brennimark. Você revisa e decide o que usar.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="panel" id="viva" aria-label="A marca atualizada para todos">
          <div className="wrap viva">
            <div>
              <p className="eyebrow">Marca viva</p>
              <Titulo className="title rise" partes={["Aprovou uma orientação nova? Ela já vale para todos."]} />
              <p className="intro">A marca evolui: surge uma dúvida, a agência escreve uma orientação, alguém aprova. A partir daí, todas as pessoas autorizadas consultam a versão atual, e o Vini passa a citá-la.</p>
              <p className="honest">Ter acesso à orientação atualizada não significa que todas as peças já foram ajustadas. O Brennimark mostra o que vale agora; revisar o que já foi feito continua com a equipe.</p>
              <Link className="more" href="/complementos">Conheça Complementos e lacunas <span aria-hidden="true">→</span></Link>
            </div>
            <div className="flowst viva-flow"><div><span className="st-chip dr">Em revisão</span><p><b>Símbolo sobre fotografia</b>A agência escreve a orientação que o manual não trazia.</p></div><em>→</em><div><span className="st-chip rev">Aprovada</span><p><b>20/09</b>Quem gere a marca confere e aprova.</p></div><em>→</em><div><span className="st-chip ok">Disponível</span><p><b>Para 12 pessoas</b>Book, Materiais e Vini passam a mostrar a versão atual.</p></div></div>
          </div>
        </section>

        <section className="panel" id="publico" aria-label="Para quem">
          <Losango classe="l2" velocidade={0.35} />
          <div className="wrap">
            <p className="eyebrow">Para quem</p>
            <Titulo className="title rise" partes={["Para quem mantém a marca em movimento."]} />
            <div className="aud-grid">
              <div className="aud">
                <h3>Agências e estúdios</h3>
                <p>Organize as marcas da carteira, receba freelancers e colaboradores novos e oriente fornecedores com a referência atualizada. Vale para a marca que o estúdio criou e para a que chegou pronta.</p>
                <Link className="text-link" href="/agencias">Para agências e estúdios <span aria-hidden="true">→</span></Link>
              </div>
              <div className="aud">
                <h3>Empresas e marketing</h3>
                <p>Mantenha agências, fornecedores e equipes com a mesma referência: materiais atualizados, orientação acessível e menos dúvidas repetidas.</p>
                <Link className="text-link" href="/empresas">Para empresas <span aria-hidden="true">→</span></Link>
              </div>
            </div>
            <p className="aud-note">Designers independentes também assinam.</p>
          </div>
        </section>

        <section className="panel" id="depoimentos" aria-label="O que dizem as agências">
          <Losango classe="l3" velocidade={-0.28} />
          <div className="wrap">
            <p className="eyebrow">Quem usa</p>
            <Titulo className="title rise" partes={["Mais tempo para a criação, menos tempo procurando."]} />
            <div className="quotes">
              <figure className="quote">
                <blockquote>A pergunta que mais chegava no nosso WhatsApp era &quot;qual é o laranja certo?&quot;. Hoje a equipe encontra a resposta com a página, e a gente volta a falar de ideia.</blockquote>
                <figcaption><i>✦</i><div>Depoimento fictício<span>Texto de marcação do layout</span></div></figcaption>
              </figure>
              <figure className="quote">
                <blockquote>Entregamos a marca e ela continua trabalhando. O manual deixou de ser um arquivo que ninguém abre.</blockquote>
                <figcaption><i>✦</i><div>Depoimento fictício<span>Texto de marcação do layout</span></div></figcaption>
              </figure>
              <figure className="quote">
                <blockquote>Mandar o kit para a gráfica com link que expira mudou nosso fim de tarde. E ela sempre recebe a versão atual.</blockquote>
                <figcaption><i>✦</i><div>Depoimento fictício<span>Texto de marcação do layout</span></div></figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="panel" id="planos" aria-label="Planos">
          <Losango classe="l4" velocidade={0.35} />
          <div className="wrap">
            <div className="plans-head">
              <div>
                <p className="eyebrow">Planos de assinatura</p>
                <Titulo className="title rise" partes={["Planos pelo número de marcas. Pessoas, ilimitadas."]} />
              </div>
            </div>
            <div className="plans">
              <article className="plan">
                <h3>Básico</h3><p className="plan-for">Para quem cuida de poucas marcas.</p>
                <div className="price">A definir<span>valor da assinatura</span></div>
                <dl><div><dt>Marcas</dt><dd className="hi">até 5</dd></div><div><dt>Pessoas</dt><dd>ilimitadas</dd></div><div><dt>Armazenamento</dt><dd>a definir</dd></div><div><dt>Uso do Vini</dt><dd>limite do plano</dd></div><div><dt>Implantação assistida</dt><dd>—</dd></div></dl>
                <a className="btn" href="/assinar?plano=basico" data-assinar="basico">Assinar</a>
              </article>
              <article className="plan">
                <h3>Médio</h3><p className="plan-for">Para estúdios com carteira em crescimento.</p>
                <div className="price">A definir<span>valor da assinatura</span></div>
                <dl><div><dt>Marcas</dt><dd className="hi">10 ou 15</dd></div><div><dt>Pessoas</dt><dd>ilimitadas</dd></div><div><dt>Armazenamento</dt><dd>a definir</dd></div><div><dt>Uso do Vini</dt><dd>limite do plano</dd></div><div><dt>Implantação assistida</dt><dd>a definir</dd></div></dl>
                <a className="btn" href="/assinar?plano=medio" data-assinar="medio">Assinar</a>
              </article>
              <article className="plan feat">
                <h3>Premium</h3><p className="plan-for">Para agências com muitas marcas.</p>
                <div className="price">A definir<span>valor da assinatura</span></div>
                <dl><div><dt>Marcas</dt><dd className="hi">cerca de 30</dd></div><div><dt>Pessoas</dt><dd>ilimitadas</dd></div><div><dt>Armazenamento</dt><dd>a definir</dd></div><div><dt>Uso do Vini</dt><dd>limite do plano</dd></div><div><dt>Implantação assistida</dt><dd>incluída</dd></div></dl>
                <a className="btn" href="/assinar?plano=premium" data-assinar="premium">Assinar</a>
              </article>
              <article className="plan">
                <h3>Corporativo</h3><p className="plan-for">Para empresas e grupos com necessidades próprias.</p>
                <div className="price">Sob consulta<span>proposta sob medida</span></div>
                <dl><div><dt>Marcas</dt><dd className="hi">sob consulta</dd></div><div><dt>Pessoas</dt><dd>ilimitadas</dd></div><div><dt>Armazenamento</dt><dd>sob consulta</dd></div><div><dt>Uso do Vini</dt><dd>sob consulta</dd></div><div><dt>Implantação assistida</dt><dd>incluída</dd></div></dl>
                <button className="btn" type="button" data-open="dlg-demo">Falar com a equipe</button>
              </article>
            </div>
            <p className="plans-note">A assinatura é mensal, no cartão, e a conta abre assim que o pagamento é confirmado. Os valores aparecem na página de assinatura. Prefere conversar antes? <button className="link" type="button" data-open="dlg-demo">Fale com a equipe</button>. Uso do Vini acima do limite poderá ser contratado à parte.</p>
          </div>
        </section>

        <section className="panel closing" id="demonstracao" aria-label="Demonstração">
          <Losango classe="l1" velocidade={-0.28} />
          <div className="wrap">
            <p className="eyebrow">Demonstração</p>
            <Titulo className="rise" partes={["Você entregou a marca. A sua ideia ainda tem muito trabalho pela frente."]} />
            <p>Veja como o Brennimark ajuda sua equipe a levar essa ideia adiante, com consistência, em cada mão.</p>
            <p className="forge">Uma marca é forjada com cuidado. E segue viva em cada trabalho.</p>
            <div className="actions">
              <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
              <Link className="btn btn--ghost" href="/#plataforma" data-go="plataforma">Ver a plataforma <span className="arrow" aria-hidden="true">→</span></Link>
            </div>
            <footer className="site-foot">
              <Link className="lockup" href="/" data-go="inicio" aria-label="Brennimark, voltar ao início"><svg viewBox="0 0 750 170" role="img" aria-label="Brennimark"><use href="#bm-logo" /></svg></Link>
              <nav className="foot-links" aria-label="Institucional"><Link href="/manifesto">Manifesto</Link><Link href="/suporte">Suporte</Link><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link><Link href="/licenca-de-fontes">Licença de fontes</Link></nav>
              <span>Protótipo visual. Textos provisórios.</span>
            </footer>
          </div>
        </section>
    </>
  );
}
