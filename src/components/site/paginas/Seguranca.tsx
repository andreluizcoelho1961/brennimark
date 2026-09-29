import Link from "next/link";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Segurança e privacidade — `/seguranca`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoSeguranca() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-plat">Plataforma</a> · Segurança e privacidade</p>
      <Titulo como="h1" className="pg-h1" partes={["A marca do seu cliente é confidencial. O Brennimark trata assim."]} />
      <p className="pg-lead">Campanha antes do ar, fonte licenciada, arquivos originais. Cada decisão do produto parte de uma pergunta: quem pode ver isto?</p>
      <div className="pg-actions"><button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button><Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link></div>
      </div>
      <div className="shield"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">Como protegemos</p><Titulo className="h2" partes={["Seis princípios de proteção, desde o desenho do produto."]} /></div>
      <div className="sgrid"><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="6" cy="5.5" r="2.5" /><path d="M1.5 14c.6-2.6 2.3-4 4.5-4s3.9 1.4 4.5 4" /></svg><b>Acesso por marca</b><p>A fronteira é a marca, não a conta. Quem trabalha numa marca não enxerga as outras, e isso é garantido no banco de dados, não só na tela.</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" /><circle cx="8" cy="8" r="2" /></svg><b>Conversas privadas</b><p>Ninguém lê a conversa de outra pessoa com o Vini: nem o dono da conta, nem a nossa equipe.</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg><b>Fonte nunca pública</b><p>A fonte da marca é servida só para download, a membros autenticados, com a licença aceita. Nada de endereço público.</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="5" cy="10" r="3" /><path d="M7.2 7.8 13 2M11 4l2 2" /></svg><b>Chaves cifradas</b><p>As chaves de IA ficam cifradas e nunca saem numa resposta do servidor.</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3l2 1.5" /></svg><b>Registro de tudo</b><p>Publicações, convites e downloads ficam registrados, com autor e data.</p></div><div className="sc"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2 5l6-3 6 3v6l-6 3-6-3Z" /><path d="M2 5l6 3 6-3M8 8v6" /></svg><b>Seus dados saem com você</b><p>Ao encerrar a assinatura, a conta fica congelada por um período e você exporta tudo antes.</p></div></div>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Autorização</p>
      <Titulo className="h2" partes={["A interface mostra. O banco decide."]} />
      <p className="body">O que aparece na tela depende do papel da pessoa; o que ela pode ler é decidido no banco de dados, regra por regra. Uma tela esquecida não abre porta nenhuma.</p>
      <ul className="ticks"><li>Regras de acesso em cada tabela</li><li>Testes que provam que A não lê B</li><li>Revisão a cada mudança</li></ul>
      </div>
      <div className="frame"><div className="mk" role="img" data-dup="1" aria-label="Tabela de acesso: cada pessoa com o seu papel em cada marca"><div className="mk-bar"><b>Pessoas</b><span className="mk-btn a-direita">Convidar</span></div><div className="mk-body"><table className="tbl mtx"><thead><tr><th>Pessoa</th><th>Brennimark</th><th>Café Aurora</th><th>Vinícola Serra</th></tr></thead><tbody>
      <tr><td>Carolina M.</td><td><b className="g">Gere</b></td><td><b className="g">Gere</b></td><td><b className="g">Gere</b></td></tr>
      <tr><td>Rafael B.</td><td><b className="c">Consulta</b></td><td><b className="c">Consulta</b></td><td>—</td></tr>
      <tr><td>Gráfica Pontal</td><td>—</td><td><b className="c">Consulta</b></td><td>—</td></tr>
      <tr><td>Estúdio Foto Sul</td><td>—</td><td>—</td><td><b className="c">Consulta</b></td></tr></tbody></table></div></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">Privacidade</p>
      <Titulo className="h2" partes={["Estatística, sem nome."]} />
      <p className="body">Para melhorar o produto usamos números agregados: assuntos mais perguntados, lacunas mais comuns. Nenhuma conversa específica é lida.</p>

      </div>
      <div className="font-card"><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg><span><b>Suas conversas são suas.</b> Ninguém lê a conversa de outra pessoa: nem o dono da conta, nem a equipe do Brennimark. Usamos só estatísticas, sem identificar quem perguntou.</span></p><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 1.5h5.5l3 3v10H4Z" /><path d="M9.5 1.5v3h3" /></svg><span><b>Cada pessoa apaga as suas</b> quando quiser. Fica só o registro de uso, sem o conteúdo.</span></p><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z" /></svg><span><b>Conteúdo só com o seu gesto:</b> &quot;enviar esta conversa ao suporte&quot;.</span></p></div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre segurança."]} /></div>
      <div><details open><summary>Onde ficam os arquivos?</summary><p>Em armazenamento privado, separado por marca. Nenhum arquivo tem endereço público permanente.</p></details><details><summary>A equipe do Brennimark acessa minha conta?</summary><p>Para suporte, acessa registros e configurações. Conversas, nunca: só se você enviar uma ao suporte.</p></details><details><summary>Posso apagar minhas conversas?</summary><p>Sim, de verdade. Fica só o registro de uso, sem conteúdo.</p></details><details><summary>E se eu cancelar?</summary><p>A conta fica congelada por um período, você exporta tudo, e depois os dados são apagados.</p></details></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">Veja também</p>
      <div className="related"><Link className="rel" href="/entrega"><small>Plataforma</small><b>Entrega e acesso</b><span>Link com prazo e acesso por marca.</span><em>→</em></Link><Link className="rel" href="/vini"><small>Plataforma</small><b>Vini Max</b><span>Consulta, revisão de peça e prompts alinhados à marca.</span><em>→</em></Link><Link className="rel" href="/empresas"><small>Para quem</small><b>Empresas</b><span>Fornecedores e equipes com a mesma referência.</span><em>→</em></Link></div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Converse com a gente sobre segurança."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
