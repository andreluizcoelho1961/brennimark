import Image from "next/image";
import Link from "next/link";
import maosComPranchas from "../imagens/maos-com-pranchas.webp";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Agências e estúdios — `/agencias`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoAgencias() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-para">Para quem</a> · Agências e estúdios</p>
      <Titulo como="h1" className="pg-h1" partes={["As marcas da sua carteira, prontas para o dia a dia da equipe."]} />
      <p className="pg-lead">Vale para a marca que o estúdio acabou de criar e para a que chegou pronta de outro lugar. O manual continua como foi desenhado, e passa a ajudar quem trabalha com ele todos os dias.</p>
      <div className="pg-actions"><button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button><Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link></div>
      </div>
      <div className="ph-hero"><Image src={maosComPranchas} alt="Mãos folheando pranchas de um manual de marca sobre a mesa" sizes="(max-width: 767px) 100vw, 50vw" /></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>Organizar várias marcas</b><span>A carteira inteira num lugar, cada marca com o seu manual e os seus materiais.</span></div><div><i>02</i><b>Integrar quem chega</b><span>Freelancers e colaboradores novos encontram a orientação sem depender de quem lembra.</span></div><div><i>03</i><b>Orientar fornecedores</b><span>Gráfica, produtora e fotógrafo recebem a versão atual e a regra junto.</span></div><div><i>04</i><b>Manter a marca como serviço</b><span>As lacunas que a equipe encontra viram pauta de trabalho com o cliente.</span></div></div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">Antes e depois</p><Titulo className="h2" partes={["O fim do \"qual é o laranja certo?\"."]} /></div>
      <div className="pains"><div><s>O PDF vai por e-mail e some</s><b>O manual fica no ar, com link próprio</b></div><div><s>Cada fornecedor novo, uma hora explicando</s><b>O convite explica sozinho</b></div><div><s>&quot;Me manda o logo em alta?&quot;</s><b>O kit inteiro num clique</b></div><div><s>A fonte que ninguém tem</s><b>A fonte vem junto, com a licença</b></div><div><s>A dúvida aparece na véspera da entrega</s><b>O Vini ajuda a revisar antes</b></div></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">O que a agência ganha</p><Titulo className="h2" partes={["O que a sua equipe passa a ter."]} /></div>
      <div className="related"><Link className="rel" href="/manual"><small>Plataforma</small><b>O manual em PDF</b><span>Fiel ao que o estúdio diagramou.</span><em>→</em></Link><Link className="rel" href="/materiais"><small>Plataforma</small><b>Materiais da marca</b><span>O kit inteiro num clique, com a regra junto.</span><em>→</em></Link><Link className="rel" href="/vini"><small>Plataforma</small><b>Vini Max</b><span>Consulta, revisão de peça e prompts alinhados à marca.</span><em>→</em></Link><Link className="rel" href="/entrega"><small>Plataforma</small><b>Entrega e acesso</b><span>Link com prazo e acesso por marca.</span><em>→</em></Link><Link className="rel" href="/complementos"><small>Plataforma</small><b>Complementos e lacunas</b><span>O que o manual não diz, escrito e citado.</span><em>→</em></Link><Link className="rel" href="/studio"><small>Plataforma</small><b>Studio</b><span>Onde a agência publica e cuida da marca.</span><em>→</em></Link></div>
      </div>
      </section>

      <section className="pg-sec">
      <figure className="pg-wrap big-quote">
      <blockquote>Entregamos a marca e ela continua trabalhando. O manual deixou de ser um arquivo que ninguém abre.</blockquote>
      <figcaption><b>Depoimento fictício</b> · texto de marcação do layout</figcaption>
      </figure>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Para agências."]} /></div>
      <div><details open><summary>Quantas marcas cabem?</summary><p>Depende do plano: de 5 a cerca de 30, e sob consulta acima disso. Pessoas, ilimitadas.</p></details><details><summary>Posso cobrar do cliente?</summary><p>A assinatura é da agência. Como você inclui isso no seu serviço é decisão sua.</p></details><details><summary>Tem ajuda para começar?</summary><p>Sim. Nos planos maiores, a implantação é assistida pela nossa equipe.</p></details></div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Mostre ao seu próximo cliente a marca funcionando."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
