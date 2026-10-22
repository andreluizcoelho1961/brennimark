import Image from "next/image";
import Link from "next/link";
import { LinksDasFerramentas } from "./LinksDasFerramentas";
import { EMPRESA } from "@/lib/site/empresa";
import equipeNaMesa from "./imagens/equipe-na-mesa.jpg";
import { IconeDoRecurso } from "./IconeDoRecurso";
import { Losango } from "./Losango";
import { FichaDoVini, TelaAnalise, TelaComplementos, TelaConsulta, TelaEntrega, TelaManual, TelaMateriais, TelaPrompt } from "./TelasDaHome";
import { Titulo } from "./Titulo";
import { TourDaPlataforma } from "./TourDaPlataforma";

/**
 * A home em rolagem vertical (22/10/2026), refeita no mesmo dia para vender
 * na primeira tela: a abertura já lista o que tem dentro, e logo abaixo o tour
 * mostra a tela de cada recurso. Depois: antes × depois, o Vini, para quem é,
 * as ferramentas grátis, planos e chamada final.
 *
 * Substitui os 14 capítulos do trilho horizontal. O texto e os estudos de tela
 * são os mesmos de antes (autoria do André); mudou a ordem e o corte. Os
 * depoimentos fictícios saíram: numa home que quer vender, texto de marcação
 * derruba a credibilidade. Voltam quando houver cliente real para citar.
 */
/** Os recursos que a abertura lista e o tour mostra, na mesma ordem. */
const RECURSOS = [
  { id: "manual", rotulo: "Manual da marca", curto: "O PDF do estúdio, com índice e busca", titulo: "O manual, exatamente como o estúdio diagramou.", texto: "Você sobe o PDF do manual e a equipe toda consulta a mesma versão no navegador, com índice, busca e zoom. Nada é remontado.", href: "/manual", link: "O manual em PDF", tela: <TelaManual /> },
  { id: "consulta", rotulo: "Assistente de IA", curto: "Tira dúvidas citando a página do manual", titulo: "Pergunte, e o manual responde.", texto: "Um assistente de inteligência artificial lê o manual da marca e responde às dúvidas da equipe com a orientação e a página de onde ela veio. Quando o manual não trata do assunto, ele diz isso em vez de inventar.", href: "/vini", link: "Conheça o assistente", tela: <TelaConsulta /> },
  { id: "analise", rotulo: "Revisão de peças", curto: "Confere a peça com as regras da marca", titulo: "Uma segunda leitura antes de enviar.", texto: "Envie a imagem de uma peça. O assistente compara com as cores e as regras do manual, marca o que encontrou e mostra a página de cada ponto. Quem aprova continua sendo a equipe.", href: "/vini", link: "Como a revisão funciona", tela: <TelaAnalise /> },
  { id: "prompt", rotulo: "Prompts para IA de imagem", curto: "Sua ideia, com as regras da marca", titulo: "A sua ideia, já com as regras da marca.", texto: "Vai criar uma imagem com IA? Descreva a ideia, e o assistente monta o pedido (o prompt) com as cores, a luz e o que evitar segundo o manual, citando a página de cada linha.", href: "/vini", link: "Prompts alinhados à marca", tela: <TelaPrompt /> },
  { id: "materiais", rotulo: "Logo, cores e fontes", curto: "Todos os arquivos da marca, num clique", titulo: "Todos os arquivos da marca, com a regra de cada um.", texto: "Logotipo, cores, fonte, ícones e fotografia num só lugar. A equipe baixa o kit inteiro num clique, e cada arquivo vem com a regra de uso.", href: "/materiais", link: "Materiais da marca", tela: <TelaMateriais /> },
  { id: "entrega", rotulo: "Envio a fornecedores", curto: "Link com prazo, sem criar conta", titulo: "A gráfica recebe sempre a versão certa.", texto: "Mande os arquivos a gráficas e fornecedores por um link que expira, com limite de downloads, sem que eles precisem criar conta. Cada envio fica registrado.", href: "/materiais#entrega", link: "Envio e acesso", tela: <TelaEntrega /> },
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
              <span className="foot-empresa" data-empresa>© Brennimark · CNPJ {EMPRESA.cnpj} · Contato: <a href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a></span>
            </footer>
          </div>
        </section>
    </>
  );
}
