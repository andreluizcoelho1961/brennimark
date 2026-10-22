import Image from "next/image";
import Link from "next/link";
import { LinksDasFerramentas } from "./LinksDasFerramentas";
import { EMPRESA, ENDERECO_COMPLETO } from "@/lib/site/empresa";
import equipeNaMesa from "./imagens/equipe-na-mesa.jpg";
import maosComPranchas from "./imagens/maos-com-pranchas.webp";
import vini from "./imagens/vini.webp";
import { Losango } from "./Losango";
import { Titulo } from "./Titulo";

/**
 * A home em rolagem vertical (22/10/2026): oito seções, na ordem de quem
 * decide em segundos — promessa, dor, o produto, as funcionalidades, o Vini,
 * para quem é, as ferramentas grátis, planos e chamada final.
 *
 * Substitui os 14 capítulos do trilho horizontal. O texto e os estudos de tela
 * são os mesmos de antes (autoria do André); mudou a ordem e o corte. Os
 * depoimentos fictícios saíram: numa home que quer vender, texto de marcação
 * derruba a credibilidade. Voltam quando houver cliente real para citar.
 */
export function SecoesDaHome() {
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
              <Link className="btn btn--ghost" href="/#plataforma">Ver a plataforma <span className="arrow" aria-hidden="true">→</span></Link>
            </div>
            <p className="hero-jump rise-2">Ir direto para <Link href="/#vini">o Vini</Link> · <Link href="/#publico">para quem é</Link> · <Link href="/#planos">planos</Link></p>
          </div>
        </section>


        <section className="panel" id="problema" aria-label="O problema">
          <div className="wrap pain">
            <Image className="pain-photo" src={maosComPranchas} alt="Mãos passando pranchas de um manual de marca sobre a mesa" sizes="(max-width: 767px) 100vw, 50vw" />
            <div>
              <p className="eyebrow">O problema</p>
              <Titulo className="title rise" partes={["O manual está num PDF. Os materiais, em várias pastas. O prazo, correndo."]} />
              <p className="intro">Cada pessoa leva a identidade adiante. E cada uma precisa, de novo, achar o logo em negativo, confirmar o laranja certo e descobrir que fonte usar, enquanto a resposta demora e a entrega se aproxima.</p>
              <p className="intro"><strong>O Brennimark põe o manual, os materiais e as regras num só lugar.</strong></p>
            </div>
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

        <section className="panel" id="funcionalidades" aria-label="O que a plataforma faz">
          <div className="wrap">
            <p className="eyebrow">O que ela faz</p>
            <Titulo className="title rise" partes={["Seis coisas que a equipe deixa de fazer à mão."]} />
            <div className="feat-grid">
              <article className="feat-card"><i>01</i><h3>Manual fiel, do jeito que o estúdio diagramou.</h3><p>O PDF aparece inteiro, com índice e busca. Nada é remontado.</p><Link className="more" href="/manual">O manual em PDF <span aria-hidden="true">→</span></Link></article>
              <article className="feat-card"><i>02</i><h3>Pergunte. O Vini responde com a página.</h3><p>Cita o manual, mostra a página e diz quando não há diretriz documentada.</p><Link className="more" href="/vini">Consultar com o Vini <span aria-hidden="true">→</span></Link></article>
              <article className="feat-card"><i>03</i><h3>Uma segunda leitura antes de enviar.</h3><p>Solte a peça na janela do Vini: ele compara com a paleta e as regras, e mostra a página de cada achado.</p><Link className="more" href="/vini">Analisar uma peça <span aria-hidden="true">→</span></Link></article>
              <article className="feat-card"><i>04</i><h3>A sua ideia, com a marca no prompt.</h3><p>O Vini acrescenta cores, luz e o que evitar, com a fonte de cada linha. Só orientação aprovada entra.</p><Link className="more" href="/manual#complementos">Complementos e lacunas <span aria-hidden="true">→</span></Link></article>
              <article className="feat-card"><i>05</i><h3>O kit inteiro, com a regra de cada arquivo.</h3><p>Logo, ícones, cores e a fonte da marca num pacote. Convide equipe e fornecedores sem pagar por pessoa.</p><Link className="more" href="/materiais">Materiais da marca <span aria-hidden="true">→</span></Link></article>
              <article className="feat-card"><i>06</i><h3>Entrega por link com prazo.</h3><p>A gráfica recebe a versão atual, e o acesso expira. Uma orientação nova aprovada já vale para todos.</p><Link className="more" href="/materiais#entrega">Entrega e acesso <span aria-hidden="true">→</span></Link></article>
            </div>
          </div>
        </section>

        <section className="panel" id="vini" aria-label="Conheça o Vini Max">
          <Losango classe="l2" velocidade={0.35} />
          <div className="wrap ai">
            <div>
              <p className="eyebrow">Conheça o assistente</p>
              <Titulo className="title rise" partes={["Este é o Vini Max. ", { em: "Pode chamar de Vini." }]} />
              <p className="intro">Um colega que entende de marca e está sempre por perto. Ele consulta o manual, os complementos aprovados e os materiais para ajudar você durante o trabalho. A decisão continua sendo sua.</p>
              <ul className="ai-list">
                <li>Responde com a orientação e a página</li>
                <li>Aponta o arquivo certo em Materiais da marca</li>
                <li>Mostra as duas versões quando as orientações não batem</li>
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

        <section className="panel" id="ferramentas" aria-label="Ferramentas gratuitas">
          <div className="wrap">
            <p className="eyebrow">Experimente sem assinar</p>
            <Titulo className="title rise" partes={["Três ferramentas gratuitas, direto no navegador."]} />
            <div className="feat-grid feat-grid--3">
              <Link className="feat-card feat-card--link" href="/ferramentas/kit"><h3>Kit</h3><p>Suba o logo e receba todos os tamanhos e formatos.</p><span className="more">Abrir o Kit <span aria-hidden="true">→</span></span></Link>
              <Link className="feat-card feat-card--link" href="/ferramentas/cores"><h3>Cores</h3><p>Que cor é essa? Códigos, contraste e o nome em português.</p><span className="more">Abrir o Cores <span aria-hidden="true">→</span></span></Link>
              <Link className="feat-card feat-card--link" href="/ferramentas/grids"><h3>Grids</h3><p>O grid do formato pronto para levar ao InDesign.</p><span className="more">Abrir o Grids <span aria-hidden="true">→</span></span></Link>
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
              <Link className="btn btn--ghost" href="/#plataforma">Ver a plataforma <span className="arrow" aria-hidden="true">→</span></Link>
            </div>
            <footer className="site-foot">
              <Link className="lockup" href="/" aria-label="Brennimark, voltar ao início"><svg viewBox="0 0 750 170" role="img" aria-label="Brennimark"><use href="#bm-logo" /></svg></Link>
              <nav className="foot-links" aria-label="Institucional"><Link href="/manifesto">Manifesto</Link><Link href="/ajuda#suporte">Suporte</Link><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link><Link href="/licenca-de-fontes">Licença de fontes</Link></nav>
              <LinksDasFerramentas />
              <span className="foot-empresa" data-empresa>{EMPRESA.nome}, {EMPRESA.natureza} · CNPJ {EMPRESA.cnpj} · {ENDERECO_COMPLETO} · {EMPRESA.email}</span>
            </footer>
          </div>
        </section>
    </>
  );
}
