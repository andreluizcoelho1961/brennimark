import Link from "next/link";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Entrega e acesso — `/entrega`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoEntrega() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-plat">Plataforma</a> · Entrega e acesso</p>
      <Titulo como="h1" className="pg-h1" partes={["Cada fornecedor com a versão atual da marca."]} />
      <p className="pg-lead">Envie materiais a quem não tem conta com um link que expira, convide cada pessoa para as marcas em que trabalha e mantenha todos com a mesma referência.</p>
      <div className="pg-actions"><button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button><Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link></div>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="Formulário de link de entrega: destinatário, materiais, validade e limite de downloads"><div className="mk-bar"><b>Novo link de entrega</b></div><div className="mk-body form">
      <label>Para<span className="inp">grafica@exemplo.com.br</span></label>
      <label>Materiais<span className="inp chips"><em>Logotipo</em><em>Cores</em><em>Regras de uso</em></span></label>
      <label>Válido por<span className="inp">7 dias · expira em 04/10/2026</span></label>
      <label>Downloads<span className="inp">até 3</span></label>
      <div className="form-foot"><span className="mono" style={{ fontSize: "9.5px", color: "var(--app-muted)" }}>brennimark.com/e/7Qk2…</span><span className="mk-btn">Criar e copiar o link</span></div></div></div></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>Link com prazo</b><span>Para gráfica e fornecedor, sem criar conta.</span></div><div><i>02</i><b>Acesso por marca</b><span>Quem trabalha numa marca não vê as outras.</span></div><div><i>03</i><b>Histórico de envios</b><span>Qual versão cada pessoa ou link recebeu, e quando.</span></div><div><i>04</i><b>Pessoas ilimitadas</b><span>Convide a equipe inteira sem pagar por cabeça.</span></div></div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Link de entrega</p>
      <Titulo className="h2" partes={["Para quem não tem conta, um link que expira."]} />
      <p className="body">Escolha os materiais, o prazo e o número de downloads. O link para de funcionar sozinho, e cada uso fica registrado.</p>
      <ul className="ticks"><li>Prazo e limite de downloads</li><li>Sem criar conta para o fornecedor</li><li>A fonte fica de fora: só membros da marca baixam</li></ul>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="O que o fornecedor recebe: a página do link com os materiais, o prazo e os downloads restantes"><div className="recv"><div className="recv-top"><svg viewBox="0 0 750 170"><use href="#bm-logo" /></svg></div><div className="mk-body"><p className="recv-k">MATERIAIS DA MARCA BRENNIMARK</p><p className="recv-by">Enviados por Carolina Menezes · Estúdio Alvéolo</p>
      <div className="kit-row"><span className="ck">↓</span><b>Logotipo</b><em>SVG · PNG · PDF</em></div><div className="kit-row"><span className="ck">↓</span><b>Cores</b><em>ASE · PDF</em></div><div className="kit-row"><span className="ck">↓</span><b>Regras de uso</b><em>PDF</em></div>
      <div className="kit-foot"><span>Válido até 04/10/2026 · 2 de 3 downloads restantes</span><span className="mk-btn">Baixar tudo</span></div></div></div></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">Registros</p>
      <Titulo className="h2" partes={["Qual versão cada um recebeu."]} />
      <p className="body">Envios e downloads ficam no mesmo histórico. Quando alguém pergunta &quot;a gráfica recebeu o logo novo?&quot;, a resposta está ali. O registro mostra acesso e download; não mostra como a marca foi aplicada numa peça.</p>
      <ul className="ticks"><li>Downloads e envios num só lugar</li><li>Filtro por marca, pessoa e período</li><li>Exportável</li></ul>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="Tabela de registros: quem baixou qual material e quando"><div className="mk-bar"><b>Registros</b><span className="a-direita mono" style={{ fontSize: "10px", color: "var(--app-muted)" }}>Brennimark · setembro</span></div><div className="mk-body"><table className="tbl"><thead><tr><th>Quem</th><th>O quê</th><th>Quando</th></tr></thead><tbody>
      <tr><td>Gráfica Pontal <em>link</em></td><td>Kit da marca</td><td>27/09 · 16:42</td></tr>
      <tr><td>Rafael B.</td><td>Logotipo · SVG</td><td>27/09 · 11:05</td></tr>
      <tr><td>Carolina M.</td><td>Fonte · Inter</td><td>26/09 · 18:20</td></tr>
      <tr><td>Fornecedor Via <em>link</em></td><td>Fotografia · pasta</td><td>25/09 · 09:13</td></tr>
      <tr><td>Juliana L.</td><td>Manual · PDF</td><td>24/09 · 14:57</td></tr></tbody></table></div></div></div>
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">Acesso por marca</p>
      <Titulo className="h2" partes={["Cada pessoa vê só a marca em que trabalha."]} />
      <p className="body">Uma agência com vinte marcas convida o fotógrafo só para a marca do ensaio. Dois papéis simples: quem gere e quem consulta.</p>
      <ul className="ticks"><li>Quem gere publica e aprova</li><li>Quem consulta lê, baixa e pergunta</li><li>Mude o papel quando quiser</li></ul>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="Tabela de acesso: cada pessoa com o seu papel em cada marca"><div className="mk-bar"><b>Pessoas</b><span className="mk-btn a-direita">Convidar</span></div><div className="mk-body"><table className="tbl mtx"><thead><tr><th>Pessoa</th><th>Brennimark</th><th>Café Aurora</th><th>Vinícola Serra</th></tr></thead><tbody>
      <tr><td>Carolina M.</td><td><b className="g">Gere</b></td><td><b className="g">Gere</b></td><td><b className="g">Gere</b></td></tr>
      <tr><td>Rafael B.</td><td><b className="c">Consulta</b></td><td><b className="c">Consulta</b></td><td>—</td></tr>
      <tr><td>Gráfica Pontal</td><td>—</td><td><b className="c">Consulta</b></td><td>—</td></tr>
      <tr><td>Estúdio Foto Sul</td><td>—</td><td>—</td><td><b className="c">Consulta</b></td></tr></tbody></table></div></div></div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">Como funciona</p><Titulo className="h2" partes={["Da agência ao fornecedor, sem perder o fio."]} /></div>
      <div className="steps"><div className="stp"><b>Convide por marca</b><p>A equipe e os parceiros entram só nas marcas em que trabalham.</p><small>Studio</small></div><div className="stp"><b>Envie com prazo</b><p>Quem não tem conta recebe um link que expira.</p><small>Studio</small></div><div className="stp"><b>Mantenha atualizado</b><p>Quando a marca muda, todos passam a baixar a versão nova.</p><small>Studio</small></div></div>
      </div>
      </section>

      <section className="pg-sec">
      <figure className="pg-wrap big-quote">
      <blockquote>Na troca de fornecedor, eu revogo o acesso dele numa marca e não mexo em mais nada.</blockquote>
      <figcaption><b>Depoimento fictício</b> · texto de marcação do layout</figcaption>
      </figure>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre entrega e acesso."]} /></div>
      <div><details open><summary>O fornecedor precisa criar conta?</summary><p>Não, se você usar o link de entrega. Para quem trabalha na marca todo dia, vale o convite.</p></details><details><summary>Posso cancelar um link antes do prazo?</summary><p>Sim, a qualquer momento. Ele para de funcionar na hora.</p></details><details><summary>Quantas pessoas posso convidar?</summary><p>Ilimitadas, em todos os planos.</p></details><details><summary>Quem vê os registros?</summary><p>Quem gere a marca.</p></details></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">Veja também</p>
      <div className="related"><Link className="rel" href="/materiais"><small>Plataforma</small><b>Materiais da marca</b><span>O kit inteiro num clique, com a regra junto.</span><em>→</em></Link><Link className="rel" href="/seguranca"><small>Plataforma</small><b>Segurança e privacidade</b><span>Acesso por marca, conversas privadas, dados seus.</span><em>→</em></Link><Link className="rel" href="/empresas"><small>Para quem</small><b>Empresas</b><span>Fornecedores e equipes com a mesma referência.</span><em>→</em></Link></div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Entregue a marca com a referência certa."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
