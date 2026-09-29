import Link from "next/link";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Empresas — `/empresas`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoEmpresas() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-para">Para quem</a> · Empresas</p>
      <Titulo como="h1" className="pg-h1" partes={["Agências, fornecedores e equipes com a mesma referência."]} />
      <p className="pg-lead">Materiais atualizados, orientação acessível e menos dúvidas repetidas. O acesso por marca e o link com prazo sustentam isso sem burocracia.</p>
      <div className="pg-actions"><button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button><Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link></div>
      </div>
      <div className="frame"><div className="mk" role="img" data-dup="1" aria-label="Tabela de registros: quem baixou qual material e quando"><div className="mk-bar"><b>Registros</b><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>Brennimark · setembro</span></div><div className="mk-body"><table className="tbl"><thead><tr><th>Quem</th><th>O quê</th><th>Quando</th></tr></thead><tbody>
      <tr><td>Gráfica Pontal <em>link</em></td><td>Kit da marca</td><td>27/09 · 16:42</td></tr>
      <tr><td>Rafael B.</td><td>Logotipo · SVG</td><td>27/09 · 11:05</td></tr>
      <tr><td>Carolina M.</td><td>Fonte · Inter</td><td>26/09 · 18:20</td></tr>
      <tr><td>Fornecedor Via <em>link</em></td><td>Fotografia · pasta</td><td>25/09 · 09:13</td></tr>
      <tr><td>Juliana L.</td><td>Manual · PDF</td><td>24/09 · 14:57</td></tr></tbody></table></div></div></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">Antes e depois</p><Titulo className="h2" partes={["A marca deixa de depender de quem lembra onde está o arquivo."]} /></div>
      <div className="pains"><div><s>Cada agência com uma versão do logo</s><b>Uma versão atual, e as antigas marcadas</b></div><div><s>Fornecedor que saiu com acesso a tudo</s><b>Acesso por marca, revogado num clique</b></div><div><s>Cada fornecedor com um arquivo diferente</s><b>Todos baixam a versão atual</b></div><div><s>Manual guardado com a agência antiga</s><b>A marca fica com a empresa</b></div><div><s>Treinar cada pessoa nova</s><b>O Vini responde com a página</b></div></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">O que a empresa ganha</p><Titulo className="h2" partes={["Consistência sem burocracia."]} /></div>
      <div className="related"><Link className="rel" href="/entrega"><small>Plataforma</small><b>Entrega e acesso</b><span>Link com prazo e acesso por marca.</span><em>→</em></Link><Link className="rel" href="/seguranca"><small>Plataforma</small><b>Segurança e privacidade</b><span>Acesso por marca, conversas privadas, dados seus.</span><em>→</em></Link><Link className="rel" href="/materiais"><small>Plataforma</small><b>Materiais da marca</b><span>O kit inteiro num clique, com a regra junto.</span><em>→</em></Link><Link className="rel" href="/vini"><small>Plataforma</small><b>Vini Max</b><span>Consulta, revisão de peça e prompts alinhados à marca.</span><em>→</em></Link><Link className="rel" href="/manual"><small>Plataforma</small><b>O manual em PDF</b><span>Fiel ao que o estúdio diagramou.</span><em>→</em></Link><Link className="rel" href="/complementos"><small>Plataforma</small><b>Complementos e lacunas</b><span>O que o manual não diz, escrito e citado.</span><em>→</em></Link></div>
      </div>
      </section>

      <section className="pg-sec">
      <figure className="pg-wrap big-quote">
      <blockquote>Mandar o kit para a gráfica com link que expira mudou nosso fim de tarde. E ela sempre recebe a versão atual.</blockquote>
      <figcaption><b>Depoimento fictício</b> · texto de marcação do layout</figcaption>
      </figure>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Para empresas."]} /></div>
      <div><details open><summary>Nossa agência já usa o Brennimark. Como funciona?</summary><p>A agência gere a marca no Studio e convida a sua equipe para consultar. Se preferirem, a assinatura pode ser da empresa.</p></details><details><summary>Temos várias marcas e unidades.</summary><p>O plano Corporativo é feito para isso, com proposta sob medida.</p></details><details><summary>Podemos trocar de agência?</summary><p>Sim. A marca continua com vocês, e o acesso da agência anterior é revogado.</p></details></div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Converse com a equipe sobre o plano Corporativo."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
