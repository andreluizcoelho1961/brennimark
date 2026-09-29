import Link from "next/link";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** O manual em PDF — `/manual`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoManual() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-plat">Plataforma</a> · O manual em PDF</p>
      <Titulo como="h1" className="pg-h1" partes={["O manual que o estúdio desenhou, publicado para a equipe."]} />
      <p className="pg-lead">Suba o PDF e a equipe passa a consultar com índice, miniaturas e busca. As páginas aparecem como foram diagramadas: nada é redesenhado.</p>
      <div className="pg-actions"><button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button><Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link></div>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="O manual aberto: miniaturas à esquerda, a página ao centro e o índice aberto"><div className="mk-bar"><div className="seg"><span className="on">Manual</span><span>Materiais</span><span>Complementos</span></div><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>Índice ▾ · Buscar · Zoom ▾</span></div>
      <div className="viewer"><div className="thumbs"><i></i><i className="on"></i><i></i><i></i><i></i></div>
      <div className="vpage"><div className="pdf" style={{ maxWidth: "none" }}><div className="pdf-left"><small>BRENNIMARK · MANUAL DA MARCA</small><b>01</b><strong>Área de proteção</strong><i></i><i></i><i></i></div><div className="pdf-right"><div className="clear"><svg className="sym" viewBox="0 0 178 162"><use href="#bm-simbolo" /></svg></div></div></div>
      <div className="toc"><small>ÍNDICE</small><p>00 Fundamentos</p><p className="on">01 Marca</p><p>02 Cores</p><p>03 Tipografia</p><p>04 Elementos gráficos</p><p>05 Fotografia</p><p>06 Vini Max</p></div></div></div>
      <div className="app-folio"><span>23 / 64</span><span>Área de proteção</span><span>ajustado à largura</span></div></div></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>Publicação simples</b><span>Envie o PDF, confira o índice proposto e publique.</span></div><div><i>02</i><b>Fiel ao original</b><span>Nenhuma página é redesenhada ou reinterpretada.</span></div><div><i>03</i><b>Índice e busca</b><span>Encontre a regra pelo capítulo ou por uma palavra.</span></div><div><i>04</i><b>Os formatos de manual</b><span>Retrato, paisagem e 16:9, com ou sem sumário. Sem sumário, o Brennimark propõe um índice para você conferir.</span></div></div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Publicação</p>
      <Titulo className="h2" partes={["Do PDF à equipe, sem reconstruir o manual."]} />
      <p className="body">Nada de reconstruir o manual numa ferramenta nova. O Brennimark lê o arquivo que você já tem e ele fica pronto para consultar, para o Vini e para os materiais.</p>
      <ul className="ticks"><li>Sem reconstruir página por página</li><li>O Vini passa a consultar o manual publicado</li><li>Nova versão substitui a anterior com um envio</li></ul>
      </div>
      <div className="frame"><div className="kit" role="img" aria-label="Publicação do manual em quatro etapas concluídas">
      <h4>Publicando: Manual da marca Brennimark.pdf</h4>
      <div className="kit-row"><span className="ck">✓</span><b>PDF enviado</b><em>64 páginas</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>Texto das páginas lido</b><em>concluído</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>Índice conferido por você</b><em>9 capítulos</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>Publicado para a equipe</b><em>12 pessoas</em></div>
      <div className="prog"><i style={{ width: "100%" }}></i></div>
      <div className="kit-foot"><span>Pronto. O tempo de leitura varia com o tamanho do arquivo.</span><span className="mk-btn">Abrir o manual</span></div></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">Fidelidade</p>
      <Titulo className="h2" partes={["O que o estúdio diagramou é o que a equipe vê."]} />
      <p className="body">Tipografia, grid, cor e respiro chegam intactos. O manual é o trabalho de um estúdio, e o Brennimark não mexe nele.</p>

      </div>
      <div className="cmp"><figure><div className="mini"><div className="pdf" style={{ maxWidth: "none" }}><div className="pdf-left"><small>MANUAL</small><b>05</b><strong>Cores</strong><i></i><i></i><i></i></div><div className="pdf-right sw4"><i style={{ background: "#ff4103" }}></i><i style={{ background: "#001621" }}></i><i style={{ background: "#072631" }}></i><i style={{ background: "#f2f5f6" }}></i></div></div></div><figcaption>O PDF que o estúdio diagramou</figcaption></figure><span className="eq">=</span><figure><div className="mini"><div className="pdf" style={{ maxWidth: "none" }}><div className="pdf-left"><small>MANUAL</small><b>05</b><strong>Cores</strong><i></i><i></i><i></i></div><div className="pdf-right sw4"><i style={{ background: "#ff4103" }}></i><i style={{ background: "#001621" }}></i><i style={{ background: "#072631" }}></i><i style={{ background: "#f2f5f6" }}></i></div></div></div><figcaption>O mesmo PDF, no Brennimark</figcaption></figure></div>
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">Busca</p>
      <Titulo className="h2" partes={["Uma palavra e o manual inteiro responde."]} />
      <p className="body">A busca percorre o texto de todas as páginas e mostra o trecho com a palavra, para você ir direto ao ponto.</p>
      <ul className="ticks"><li>Busca no texto de todas as páginas</li><li>Trecho com a palavra marcada</li><li>Clique e o manual abre na página</li></ul>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="Busca por laranja com três resultados e as páginas"><div className="mk-bar"><span className="sbox">⌕ Brasa</span><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>3 resultados</span></div>
      <div className="mk-body res"><p><b>p. 29 · Paleta de cores primárias</b>…um laranja parecido não é o <mark>Brasa</mark>. #FF4103…</p><p><b>p. 29 · Paleta de cores primárias</b>O <mark>Brasa</mark> é muito saturado e provavelmente fica fora da gama CMYK…</p><p><b>p. 48 · Linguagem fotográfica</b>…a Noite Polar nas sombras, a <mark>Brasa</mark> num único ponto.</p></div></div></div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">Como funciona</p><Titulo className="h2" partes={["Três passos, e o manual está trabalhando."]} /></div>
      <div className="steps"><div className="stp"><b>Envie o PDF</b><p>O mesmo arquivo que o estúdio entregou ao cliente.</p><small>Studio</small></div><div className="stp"><b>Confira e publique</b><p>Veja o índice, ajuste um título se precisar e publique.</p><small>Studio</small></div><div className="stp"><b>A equipe consulta</b><p>No Book, com índice, busca, materiais e o Vini.</p><small>Book</small></div></div>
      </div>
      </section>

      <section className="pg-sec">
      <figure className="pg-wrap big-quote">
      <blockquote>O manual ficou igualzinho ao que a gente diagramou. Isso, para um estúdio, é inegociável.</blockquote>
      <figcaption><b>Depoimento fictício</b> · texto de marcação do layout</figcaption>
      </figure>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre o manual."]} /></div>
      <div><details open><summary>Preciso refazer o manual em outra ferramenta?</summary><p>Não. Você sobe o PDF que já existe, e ele é a superfície de leitura.</p></details><details><summary>E se o PDF não tiver sumário?</summary><p>O Brennimark monta um índice a partir dos títulos das páginas, e você pode ajustar no Studio.</p></details><details><summary>Posso publicar uma versão nova?</summary><p>Sim. A nova substitui a anterior para a equipe, e o histórico fica registrado.</p></details><details><summary>Os leitores podem baixar o PDF?</summary><p>Sim, se quem gere a marca permitir. O download fica registrado.</p></details></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">Veja também</p>
      <div className="related"><Link className="rel" href="/materiais"><small>Plataforma</small><b>Materiais da marca</b><span>O kit inteiro num clique, com a regra junto.</span><em>→</em></Link><Link className="rel" href="/vini"><small>Plataforma</small><b>Vini Max</b><span>Consulta, revisão de peça e prompts alinhados à marca.</span><em>→</em></Link><Link className="rel" href="/complementos"><small>Plataforma</small><b>Complementos e lacunas</b><span>O que o manual não diz, escrito e citado.</span><em>→</em></Link></div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Leve o seu manual para perto da equipe."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
