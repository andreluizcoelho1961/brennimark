import Link from "next/link";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Studio — `/studio`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoStudio() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-plat">Plataforma</a> · Studio</p>
      <Titulo como="h1" className="pg-h1" partes={["O Studio é onde a agência cuida de todas as marcas."]} />
      <p className="pg-lead">Publique manuais, organize materiais, escreva complementos, convide pessoas e acompanhe tudo, marca por marca, num só lugar.</p>
      <div className="pg-actions"><button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button><Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link></div>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="O Studio: coluna com as seções à esquerda e a lista de marcas da agência com o status de cada uma"><div className="stu"><div className="stu-rail"><p className="stu-k">STUDIO</p><span className="on"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="2" y="2" width="5" height="5" /><rect x="9" y="2" width="5" height="5" /><rect x="2" y="9" width="5" height="5" /><rect x="9" y="9" width="5" height="5" /></svg>Marcas</span><span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 1.5h5.5l3 3v10H4Z" /><path d="M9.5 1.5v3h3" /></svg>Manual</span><span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 5l6-3 6 3v6l-6 3-6-3Z" /><path d="M2 5l6 3 6-3M8 8v6" /></svg>Materiais</span><span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 4h10M3 8h10M3 12h7" /></svg>Complementos</span><span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 14c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4" /></svg>Pessoas</span><span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M7 9a3 3 0 0 0 4.2 0l2-2a3 3 0 0 0-4.2-4.2l-.8.8M9 7a3 3 0 0 0-4.2 0l-2 2a3 3 0 0 0 4.2 4.2l.8-.8" /></svg>Entregas</span><span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></svg>Registros</span><span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2" /></svg>Configurações</span></div>
      <div className="stu-main"><div className="mk-bar"><b>Marcas</b><span className="mk-btn a-direita">Nova marca</span></div><div className="mk-body brands">
      <div><i style={{ background: "#001621" }}><svg viewBox="0 0 178 162" style={{ width: "22px", height: "20px" }}><use href="#bm-simbolo" /></svg></i><b>Brennimark</b><span className="st-chip ok">Publicado</span><em>33 págs · 12 pessoas</em></div>
      <div><i style={{ background: "#6b3b22" }}>CA</i><b>Café Aurora</b><span className="st-chip ok">Publicado</span><em>32 págs · 8 pessoas</em></div>
      <div><i style={{ background: "#3f5b3a" }}>VS</i><b>Vinícola Serra</b><span className="st-chip rev">Em revisão</span><em>60 págs · 5 pessoas</em></div>
      <div><i style={{ background: "#1f3f78" }}>OM</i><b>Ótica Mirante</b><span className="st-chip dr">Rascunho</span><em>24 págs · 2 pessoas</em></div></div></div></div></div></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>Todas as marcas</b><span>A carteira inteira numa lista, com o status de cada uma.</span></div><div><i>02</i><b>Revisão antes de publicar</b><span>Nada chega à equipe sem passar por aprovação.</span></div><div><i>03</i><b>Pessoas e papéis</b><span>Quem gere e quem consulta, por marca.</span></div><div><i>04</i><b>Tudo registrado</b><span>Envios, publicações e downloads.</span></div></div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Duas portas</p>
      <Titulo className="h2" partes={["O Studio para quem gere. O Book para quem consulta."]} />
      <p className="body">A mesma marca, duas experiências. Quem só precisa usar a marca não esbarra em ferramenta de edição.</p>

      </div>
      <div className="two-apps"><div><small>STUDIO</small><b>Para quem gere</b><p>Publica o manual, organiza os materiais, escreve complementos, convida pessoas e acompanha os registros.</p></div><div><small>BOOK</small><b>Para quem consulta</b><p>Lê o manual, baixa os materiais e pergunta ao Vini. Sem nenhum botão que não seja para ele.</p></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">Status claro</p>
      <Titulo className="h2" partes={["O que está aprovado, o que é rascunho e quem decide."]} />
      <p className="body">Cada item tem um status: rascunho, em revisão ou publicado. Acrescentar uma imagem ou um texto não muda o status; só a aprovação de quem gere a marca muda. A equipe e o Vini usam o que está publicado.</p>
      <ul className="ticks"><li>Status visível em cada item</li><li>Aprovação antes de publicar</li><li>O Vini só cita o publicado</li></ul>
      </div>
      <div className="flowst"><div><span className="st-chip dr">Rascunho</span><p>A agência monta, sobe e escreve.</p></div><em>→</em><div><span className="st-chip rev">Em revisão</span><p>Alguém confere antes de publicar.</p></div><em>→</em><div><span className="st-chip ok">Publicado</span><p>A equipe vê, e o Vini passa a citar.</p></div></div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <figure className="pg-wrap big-quote">
      <blockquote>Temos 22 marcas no Studio. Pela primeira vez eu sei, numa tela, o que está publicado e o que está esperando revisão.</blockquote>
      <figcaption><b>Depoimento fictício</b> · texto de marcação do layout</figcaption>
      </figure>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre o Studio."]} /></div>
      <div><details open><summary>Quem entra no Studio?</summary><p>Quem assina e as pessoas a quem ele dá o papel de gerir uma marca.</p></details><details><summary>Várias pessoas podem administrar?</summary><p>Sim, cada uma com o seu próprio acesso. Nada de senha compartilhada.</p></details><details><summary>O cliente da agência vê o Studio?</summary><p>Só se a agência quiser que ele também administre a marca. Para consultar, ele usa o Book.</p></details></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">Veja também</p>
      <div className="related"><Link className="rel" href="/manual"><small>Plataforma</small><b>O manual em PDF</b><span>Fiel ao que o estúdio diagramou.</span><em>→</em></Link><Link className="rel" href="/entrega"><small>Plataforma</small><b>Entrega e acesso</b><span>Link com prazo e acesso por marca.</span><em>→</em></Link><Link className="rel" href="/agencias"><small>Para quem</small><b>Agências e estúdios</b><span>A marca entregue pronta para usar.</span><em>→</em></Link></div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Traga a sua carteira de marcas para o Studio."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
