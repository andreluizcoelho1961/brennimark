import Image from "next/image";
import Link from "next/link";
import { LinksDasFerramentas } from "./LinksDasFerramentas";
import { EMPRESA } from "@/lib/site/empresa";
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
/** Os recursos que a abertura lista e o tour mostra, na mesma ordem. */
const RECURSOS = [
  { id: "manual", rotulo: "Manual da marca", curto: "O PDF do estúdio, com índice e busca", titulo: "O manual, exatamente como o estúdio diagramou.", texto: "Você sobe o PDF do manual e a equipe toda consulta a mesma versão no navegador, com índice, busca e zoom. Nada é remontado.", href: "/manual", link: "O manual em PDF", tela: <TelaManual /> },
  { id: "consulta", rotulo: "Assistente de IA", curto: "Tira dúvidas citando a página do manual", titulo: "Pergunte, e o manual responde.", texto: "Um assistente de inteligência artificial lê o manual da marca e responde às dúvidas da equipe com a orientação e a página de onde ela veio. Quando o manual não trata do assunto, ele diz isso em vez de inventar.", href: "/vini", link: "Conheça o assistente", tela: <TelaConsulta /> },
  { id: "analise", rotulo: "Revisão de peças", curto: "Confere a peça com as regras da marca", titulo: "Uma segunda leitura antes de enviar.", texto: "Envie a imagem de uma peça. O assistente compara com as cores e as regras do manual, marca o que encontrou e mostra a página de cada ponto. Quem aprova continua sendo a equipe.", href: "/vini", link: "Como a revisão funciona", tela: <TelaAnalise /> },
  { id: "prompt", rotulo: "Prompts para IA de imagem", curto: "Sua ideia, com as regras da marca", titulo: "A sua ideia, já com as regras da marca.", texto: "Vai criar uma imagem com IA? Descreva a ideia, e o assistente monta o pedido (o prompt) com as cores, a luz e o que evitar segundo o manual, citando a página de cada linha.", href: "/vini", link: "Prompts alinhados à marca", tela: <TelaPrompt /> },
  { id: "materiais", rotulo: "Logo, cores e fontes", curto: "Todos os arquivos da marca, num clique", titulo: "Todos os arquivos da marca, com a regra de cada um.", texto: "Logotipo, cores, fonte, ícones e fotografia num só lugar. A equipe baixa o kit inteiro num clique, e cada arquivo vem com a regra de uso.", href: "/materiais", link: "Materiais da marca", tela: <TelaMateriais /> },
  { id: "entrega", rotulo: "Envio a fornecedores", curto: "Link com prazo, sem criar conta", titulo: "A gráfica recebe sempre a versão certa.", texto: "Mande os arquivos a gráficas e fornecedores por um link que expira, sem que eles precisem criar conta. Cada envio fica registrado.", href: "/materiais#entrega", link: "Envio e acesso", tela: <TelaEntrega /> },
  { id: "complementos", rotulo: "Regras novas", curto: "O que o manual não diz, escrito e aprovado", titulo: "O que o manual não diz, a agência escreve.", texto: "Toda dúvida sem resposta no manual vira um aviso. A agência escreve a orientação que faltava, alguém aprova, e ela passa a valer para a equipe e para o assistente, sem refazer o PDF.", href: "/manual#complementos", link: "Regras além do manual", tela: <TelaComplementos /> },
];

export function SecoesDaHome() {
  return (
    <>
        <section className="panel hero is-active" id="inicio" aria-label="Início">
          <div className="hero-photo">
            <Image src={equipeNaMesa} alt="" fill sizes="(max-width: 767px) 100vw, 62vw" loading="eager" fetchPriority="high" />
          </div>
          <div className="hero-copy">
            <p className="eyebrow rise">Plataforma de gestão de marca · para agências e marcas</p>
            <Titulo como="h1" className="rise" partes={["Uma marca passa por muitas mãos. ", { em: "A ideia tem que passar por todas." }]} />
            <p className="hero-lede rise-2"><strong>Menos tempo procurando, mais segurança para decidir e mais atenção para criar.</strong> O manual, os arquivos e as orientações da marca num só lugar, com um assistente de IA que responde às dúvidas da equipe citando o manual.</p>
            <div className="actions rise-2">
              <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
              <Link className="btn btn--ghost" href="/#plataforma">Ver a plataforma por dentro <span className="arrow" aria-hidden="true">→</span></Link>
            </div>
          </div>
          <nav className="hero-bar rise-2" aria-label="O que tem dentro do Brennimark">
            {RECURSOS.map((r) => (
              <a key={r.id} href={`#recurso-${r.id}`}><IconeDoRecurso id={r.id} /><b>{r.rotulo}</b><span>{r.curto}</span></a>
            ))}
            {/* O Fonts na capa (23/10/2026): destaque em Brasa, com a etiqueta do beta. */}
            <Link className="hero-bar-fonts" href="/fonts"><em>Novo · beta</em><b>Brennimark Fonts</b><span>O app que liga as fontes de cada marca no seu computador</span></Link>
          </nav>
        </section>

        <section className="panel" id="plataforma" aria-label="A plataforma por dentro">
          <div className="wrap">
            <div className="tour-head">
              <p className="eyebrow">A plataforma por dentro</p>
              <Titulo className="title rise" partes={["A marca inteira, no mesmo lugar. ", { em: "Veja como funciona." }]} />
            </div>
            <TourDaPlataforma abas={RECURSOS} />
          </div>
        </section>

        <section className="panel" id="fonts" aria-label="Brennimark Fonts">
          <Losango classe="l1" velocidade={-0.25} />
          <div className="wrap fonts-home">
            <div>
              <p className="eyebrow">Novo · Brennimark Fonts</p>
              <Titulo className="title rise" partes={["As fontes de cada marca, ", { em: "ligadas no seu computador." }]} />
              <p className="intro">O app que ativa as fontes do kit da marca quando o trabalho começa e desativa quando acaba, sem fonte faltando e sem biblioteca bagunçada. Funciona sem internet, avisa conflito de nomes e vem incluso na assinatura.</p>
              <p className="fx-beta"><b>Beta fechado, gratuito, por convite</b> · só os 50 primeiros · 90 dias · macOS e Windows</p>
              <div className="actions">
                <PedirConviteDoFonts rotulo="Pedir convite" />
                <Link className="btn btn--ghost" href="/fonts">Conhecer o Fonts <span className="arrow" aria-hidden="true">→</span></Link>
              </div>
            </div>
            <JanelaDoFonts />
          </div>
        </section>

        <section className="panel" id="problema" aria-label="Antes e depois">
          <div className="wrap">
            <p className="eyebrow">O problema</p>
            <Titulo className="title rise" partes={["O prazo está correndo. O manual está num PDF. Os materiais, em várias pastas."]} />
            <div className="cmp-home">
              <div className="cmp-col">
                <p className="cmp-k">Sem o Brennimark</p>
                <ul>
                  <li>O manual é um PDF que ninguém abre</li>
                  <li>Logo, cores e fonte espalhados em pastas e e-mails</li>
                  <li>&quot;Qual é o laranja certo?&quot; no WhatsApp, toda semana</li>
                  <li>A gráfica recebe a versão antiga</li>
                  <li>A peça volta porque a cor estava errada</li>
                </ul>
              </div>
              <div className="cmp-col cmp-col--com">
                <p className="cmp-k">Com o Brennimark</p>
                <ul>
                  <li>O manual fiel, com índice e busca, para a equipe toda</li>
                  <li>O kit inteiro num clique, com a regra de cada arquivo</li>
                  <li>Um assistente de IA responde com a página do manual</li>
                  <li>Um link com prazo que entrega sempre a versão atual</li>
                  <li>Uma segunda leitura da peça antes de enviar</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="panel" id="vini" aria-label="Conheça o Vini Max">
          <Losango classe="l2" velocidade={0.35} />
          <div className="wrap vini">
            <FichaDoVini />
            <div>
              <p className="eyebrow">O assistente de IA do Brennimark</p>
              <Titulo className="title rise" partes={["Este é o Vini Max. ", { em: "Pode chamar de Vini." }]} />
              <p className="intro">O assistente que aparece no tour tem nome. Ele é um colega que entende de marca e está sempre por perto. Ele consulta o manual, os complementos aprovados e os materiais para ajudar você durante o trabalho. A decisão continua sendo sua.</p>
              <ul className="traits">
                <li><i>01</i><div><b>Responde com fundamento.</b><span>Cita o manual ou o complemento, com a página.</span></div></li>
                <li><i>02</i><div><b>Encontra o material.</b><span>Aponta o arquivo certo em Materiais da marca.</span></div></li>
                <li><i>03</i><div><b>Aponta divergências.</b><span>Quando duas orientações documentadas não batem, mostra as duas.</span></div></li>
                <li><i>04</i><div><b>Reconhece o limite.</b><span>Sem resposta segura, ele diz e sugere com quem confirmar.</span></div></li>
              </ul>
              <Link className="more" href="/vini">Conheça o Vini Max <span aria-hidden="true">→</span></Link>
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

        <section className="panel" id="ferramentas" aria-label="Ferramentas gratuitas">
          <Losango classe="l1" velocidade={-0.3} />
          <div className="wrap">
            <p className="eyebrow">Ferramentas</p>
            <Titulo className="title rise" partes={["Quatro ferramentas, ", { em: "três de graça" }, "."]} />
            <p className="intro">Para quem desdobra marcas todo dia. Kit, Cores e Grids são gratuitos: você usa à vontade e se cadastra só na hora de baixar. O Fonts abre para os 50 primeiros. Quando a marca do cliente estiver na plataforma, as ferramentas passam a trabalhar com ela.</p>
            <div className="ferr-grid">
              <article className="ferr ferr--destaque">
                <h3>Fonts</h3>
                <p className="ferr-what">O app que ativa as fontes de cada marca no seu computador, e desativa quando o trabalho acaba.</p>
                <dl className="ferr-tier">
                  <div><dt>50 primeiros</dt><dd>90 dias de graça, por convite. Vagas limitadas.</dd></div>
                  <div><dt className="sub">Assinante</dt><dd>Vem incluso na assinatura, com as fontes ligadas à marca.</dd></div>
                </dl>
                <Link className="btn" href="/fonts">Pedir convite <span className="arrow" aria-hidden="true">→</span></Link>
              </article>
              <article className="ferr">
                <h3>Kit</h3>
                <p className="ferr-what">Um logo entra. Saem todos os tamanhos de perfil, capa e favicon, nas medidas oficiais de cada rede.</p>
                <dl className="ferr-tier">
                  <div><dt>Grátis</dt><dd>Todos os tamanhos, a partir do seu arquivo.</dd></div>
                  <div><dt className="sub">Assinante</dt><dd>Usa o logo e as regras de proteção aprovados no manual da marca.</dd></div>
                </dl>
                <Link className="btn btn--ghost" href="/ferramentas/kit">Usar o Kit <span className="arrow" aria-hidden="true">→</span></Link>
              </article>
              <article className="ferr">
                <h3>Cores</h3>
                <p className="ferr-what">Que cor é essa? Conta-gotas ou print colado: nome em português, códigos e contraste.</p>
                <dl className="ferr-tier">
                  <div><dt>Grátis</dt><dd>Mede qualquer cor e mostra o contraste.</dd></div>
                  <div><dt className="sub">Assinante</dt><dd>Compara com a paleta aprovada e responde se é a cor da marca.</dd></div>
                </dl>
                <Link className="btn btn--ghost" href="/ferramentas/cores">Usar o Cores <span className="arrow" aria-hidden="true">→</span></Link>
              </article>
              <article className="ferr">
                <h3>Grids</h3>
                <p className="ferr-what">O grid pronto para o InDesign, em IDML, nos formatos que você mais usa.</p>
                <dl className="ferr-tier">
                  <div><dt>Grátis</dt><dd>13 formatos, com os quatro tipos de grid.</dd></div>
                  <div><dt className="sub">Assinante</dt><dd>Todos os formatos, com logo, cores e estilos da marca.</dd></div>
                </dl>
                <Link className="btn btn--ghost" href="/ferramentas/grids">Usar o Grids <span className="arrow" aria-hidden="true">→</span></Link>
              </article>
            </div>
            <p className="plans-note">As versões de assinante moram dentro da plataforma, ligadas ao manual de cada marca.</p>
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
              <span className="foot-empresa" data-empresa>© Brennimark · CNPJ {EMPRESA.cnpj} · Contato: <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a></span>
            </footer>
          </div>
        </section>
    </>
  );
}
