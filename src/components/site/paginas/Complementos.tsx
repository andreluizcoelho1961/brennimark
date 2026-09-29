import Image from "next/image";
import Link from "next/link";
import vini from "../imagens/vini.webp";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Complementos e lacunas — `/complementos`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoComplementos() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-plat">Plataforma</a> · Complementos e lacunas</p>
      <Titulo como="h1" className="pg-h1" partes={["O que o manual não diz, a agência escreve. E o Vini passa a citar."]} />
      <p className="pg-lead">Todo manual tem lacunas. O Brennimark mostra quais são, pelas perguntas da equipe, e deixa a agência responder com um complemento, sem refazer o PDF.</p>
      <div className="pg-actions"><button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button><Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link></div>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="Relatório de perguntas sem resposta no manual, com o número de vezes e o atalho para escrever complemento"><div className="mk-bar"><b>As perguntas que o seu manual não responde</b><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>últimos 30 dias</span></div><div className="mk-body gaps">
      <div><b>Posso usar o símbolo sobre foto?</b><span>perguntado 14 vezes</span><em>Escrever complemento</em></div>
      <div><b>Qual o tamanho mínimo do logo em digital?</b><span>perguntado 9 vezes</span><em>Escrever complemento</em></div>
      <div><b>Existe versão monocromática para bordado?</b><span>perguntado 6 vezes</span><em>Escrever complemento</em></div>
      <div><b>Quais emojis combinam com o tom de voz?</b><span>perguntado 4 vezes</span><em>Escrever complemento</em></div></div></div></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>As lacunas aparecem</b><span>As perguntas sem resposta viram relatório.</span></div><div><i>02</i><b>Complemento sem refazer PDF</b><span>Texto curto, publicado ao lado do manual.</span></div><div><i>03</i><b>Com aprovação</b><span>Rascunho só vale depois de aprovado.</span></div><div><i>04</i><b>O Vini cita</b><span>A resposta passa a apontar o complemento.</span></div></div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Complementos</p>
      <Titulo className="h2" partes={["Texto simples, publicado ao lado do manual."]} />
      <p className="body">A agência escreve o complemento em texto simples, com títulos e listas. Ele passa por aprovação e aparece na aba Complementos, ao lado do PDF.</p>
      <ul className="ticks"><li>Editor com prévia</li><li>Rascunho, revisão e publicado</li><li>Histórico de cada versão</li></ul>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="Editor de complemento: texto à esquerda e a prévia à direita, com status rascunho"><div className="mk-bar"><div className="seg"><span>Manual</span><span>Materiais</span><span className="on">Complementos</span></div><span className="mk-btn a-direita">Publicar</span></div>
      <div className="md"><pre className="md-src">{"# Símbolo sobre fotografia\n\nUse o símbolo sobre foto só em\náreas **escuras e sem textura**.\n\n- versão branca, sem gradiente\n- área de proteção dobrada\n- nunca sobre rosto"}</pre><div className="md-out"><h5>Símbolo sobre fotografia</h5><p>Use o símbolo sobre foto só em áreas <b>escuras e sem textura</b>.</p><ul><li>versão branca, sem gradiente</li><li>área de proteção dobrada</li><li>nunca sobre rosto</li></ul><span className="st-chip">Rascunho · aguardando aprovação</span></div></div></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">O Vini cita</p>
      <Titulo className="h2" partes={["A lacuna fechada vira resposta."]} />
      <p className="body">Depois de aprovado, o complemento entra no que o Vini sabe. A mesma pergunta passa a ter resposta, com a fonte.</p>

      </div>
      <div className="chat"><div className="chat-win"><div className="chat-head"><Image src={vini} alt="" sizes="34px" /><div><b>Vini Max</b><br /><span>Manual do Brennimark</span></div></div><div className="turn was"><p className="tag-when">Antes da aprovação</p><p className="q">Posso usar o símbolo sobre foto?</p><p className="a">O manual não trata disso. Existe um complemento em rascunho, que ainda não vale como regra. Vale confirmar com quem gere a marca.</p></div><div className="turn"><p className="tag-when">Depois da aprovação, em 20/09</p><p className="q">Posso usar o símbolo sobre foto?</p><p className="a">Sim, em áreas escuras e sem textura, na versão branca e com a área de proteção dobrada. Nunca sobre rosto.</p><span className="src">Fonte: Complemento &quot;Símbolo sobre fotografia&quot; · aprovado em 20/09</span></div></div></div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">O ciclo</p><Titulo className="h2" partes={["A marca fica mais completa a cada mês."]} /></div>
      <div className="steps"><div className="stp"><b>A equipe pergunta</b><p>O Vini responde, ou diz que não há diretriz.</p><small>Book</small></div><div className="stp"><b>A agência vê a lacuna</b><p>O relatório mostra o que mais se pergunta sem resposta.</p><small>Studio</small></div><div className="stp"><b>Escreve e aprova</b><p>O complemento é publicado e o Vini passa a citar.</p><small>Studio</small></div></div>
      </div>
      </section>

      <section className="pg-sec">
      <figure className="pg-wrap big-quote">
      <blockquote>O relatório de lacunas virou pauta da nossa reunião mensal com o cliente. É serviço novo para a agência.</blockquote>
      <figcaption><b>Depoimento fictício</b> · texto de marcação do layout</figcaption>
      </figure>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre complementos."]} /></div>
      <div><details open><summary>O complemento muda o PDF?</summary><p>Não. O PDF continua como o estúdio entregou; o complemento fica ao lado, identificado.</p></details><details><summary>Quem pode escrever?</summary><p>Quem gere a marca. A publicação passa por aprovação.</p></details><details><summary>O relatório mostra quem perguntou?</summary><p>Não. Só o assunto e quantas vezes, e só quando há gente suficiente perguntando para ninguém ser identificado.</p></details></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">Veja também</p>
      <div className="related"><Link className="rel" href="/vini"><small>Plataforma</small><b>Vini Max</b><span>Consulta, revisão de peça e prompts alinhados à marca.</span><em>→</em></Link><Link className="rel" href="/manual"><small>Plataforma</small><b>O manual em PDF</b><span>Fiel ao que o estúdio diagramou.</span><em>→</em></Link><Link className="rel" href="/studio"><small>Plataforma</small><b>Studio</b><span>Onde a agência publica e cuida da marca.</span><em>→</em></Link></div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Feche as lacunas do seu manual."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
