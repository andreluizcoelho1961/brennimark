import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Entrega e acesso: o que era a página `/entrega`, agora um bloco de outra página (22/10/2026). Texto do protótipo de 29/09/2026 (autoria do André). */
export function BlocosDeEntrega() {
  return (
    <>
      <section className="pg-sec" id="entrega"><Losango classe="l2" velocidade={0.2} />
      <div className="pg-wrap sec-head">
      <p className="eyebrow">Entrega e acesso</p>
      <Titulo className="h2" partes={["Cada fornecedor com a versão atual da marca."]} />
      <p className="body" style={{ maxWidth: "640px" }}>Envie materiais a quem não tem conta com um link que expira, convide cada pessoa para as marcas em que trabalha e mantenha todos com a mesma referência.</p>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Link de entrega</p>
      <Titulo className="h2" partes={["Para quem não tem conta, um link que expira."]} />
      <p className="body">Escolha os materiais e o prazo. O link para de funcionar sozinho, e cada uso fica registrado.</p>
      <ul className="ticks"><li>Prazo de validade</li><li>Sem criar conta para o fornecedor</li><li>A fonte fica de fora: só membros da marca baixam</li></ul>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="O que o fornecedor recebe: a página do link com os materiais, e o prazo"><div className="recv"><div className="recv-top"><svg viewBox="0 0 750 170"><use href="#bm-logo" /></svg></div><div className="mk-body"><p className="recv-k">MATERIAIS DA MARCA BRENNIMARK</p><p className="recv-by">Enviados por Carolina Menezes · Estúdio Alvéolo</p>
      <div className="kit-row"><span className="ck">↓</span><b>Logotipo</b><em>SVG · PNG · PDF</em></div><div className="kit-row"><span className="ck">↓</span><b>Cores</b><em>ASE · PDF</em></div><div className="kit-row"><span className="ck">↓</span><b>Regras de uso</b><em>PDF</em></div>
      <div className="kit-foot"><span>Válido até 04/10/2026</span><span className="mk-btn">Baixar tudo</span></div></div></div></div></div>
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
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre entrega e acesso."]} /></div>
      <div><details open><summary>O fornecedor precisa criar conta?</summary><p>Não, se você usar o link de entrega. Para quem trabalha na marca todo dia, vale o convite.</p></details><details><summary>Posso cancelar um link antes do prazo?</summary><p>Sim, a qualquer momento. Ele para de funcionar na hora.</p></details><details><summary>Quantas pessoas posso convidar?</summary><p>Ilimitadas, em todos os planos.</p></details><details><summary>Quem vê os registros?</summary><p>Quem gere a marca.</p></details></div>
      </div>
      </section>

    </>
  );
}
