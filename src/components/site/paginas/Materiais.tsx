import Link from "next/link";
import { BlocosDeEntrega } from "./Entrega";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import telaItemLogotipo from "../imagens/telas/item-logotipo.webp";
import telaMateriais from "../imagens/telas/materiais.webp";
import telaBanco from "../imagens/telas/banco-de-imagens.webp";

/** Materiais da marca — `/materiais`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoMateriais() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-plat">Plataforma</a> · Materiais da marca</p>
      <Titulo como="h1" className="pg-h1" partes={["Tudo que a marca precisa, pronto para baixar."]} />
      <p className="pg-lead">Logo, símbolo, cores, fonte, ícones e fotografia num só lugar. Cada arquivo com a regra de uso junto, e o kit inteiro num clique.</p>
      <div className="pg-actions">
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      <Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link>
      </div>
      </div>
      <Captura src={telaMateriais} alt="Materiais da marca: a lista dos arquivos do Brennimark, cada um com a sua miniatura" />
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points">
      <div><i>01</i><b>O kit num clique</b><span>Tudo o que a marca tem, num pacote só, nos formatos certos.</span></div>
      <div><i>02</i><b>A regra vai junto</b><span>Cada arquivo leva a regra de uso e a página do manual.</span></div>
      <div><i>03</i><b>A fonte também</b><span>Para quem é da marca, com a licença em ordem.</span></div>
      <div><i>04</i><b>Nada de versão velha</b><span>O que saiu de uso fica marcado como descontinuado.</span></div>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">O kit</p>
      <Titulo className="h2" partes={["O kit inteiro, montado na hora."]} />
      <p className="body">Escolha o que precisa ou leve tudo. O pacote é montado no seu próprio navegador e chega organizado em pastas, pronto para passar a quem vai produzir.</p>
      <ul className="ticks"><li>Logo em SVG, PNG e PDF</li><li>Paleta em ASE, com HEX, RGB e CMYK</li><li>Fonte, ícones e fotografia</li><li>As regras de uso em PDF, dentro do pacote</li></ul>
      </div>
      <div className="frame">
      <div className="kit" role="img" aria-label="Painel de montagem do kit com seis grupos marcados e a barra de progresso">
      <h4>Kit da marca Brennimark</h4>
      <div className="kit-row"><span className="ck">✓</span><b>Logotipo</b><em>SVG · PNG · PDF</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>Símbolo</b><em>SVG · PNG</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>Cores</b><em>ASE · PDF</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>Tipografia</b><em>OTF</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>Ícones</b><em>SVG</em></div>
      <div className="kit-row"><span className="ck">✓</span><b>Regras de uso</b><em>PDF</em></div>
      <div className="prog"><i></i></div>
      <div className="kit-foot"><span>Montando o pacote no seu navegador… 68%</span><span className="mk-btn">Baixar .zip</span></div>
      </div>
      </div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">A regra junto</p>
      <Titulo className="h2" partes={["Quem baixa o logo leva junto como usar."]} />
      <p className="body">Cada item tem as suas versões e, ao lado, a regra que vale para ele, com a página do manual. O fornecedor não precisa adivinhar, e ninguém precisa explicar de novo.</p>
      <ul className="ticks"><li>Versões para fundo claro e escuro</li><li>O que pode e o que não pode, lado a lado</li><li>A citação abre o manual na página</li></ul>
      </div>
      <Captura src={telaItemLogotipo} alt="A página de um item: a prévia do arquivo, a regra de uso com as páginas do manual e o botão de baixar" />
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">A fonte</p>
      <Titulo className="h2" partes={["A fonte da marca vem junto."]} />
      <p className="body">Sem a fonte, o primeiro arquivo aberto já sai errado. No Brennimark ela fica com o resto da marca, para baixar, e só para quem faz parte dela.</p>
      <ul className="ticks"><li>Só para membros daquela marca</li><li>Nunca em endereço público</li><li>Licença aceita e registrada no envio</li></ul>
      </div>
      <div className="font-card">
      <div className="spec">Aa</div>
      <p className="alpha">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</p>
      <div className="weights"><span style={{ fontWeight: "400" }}>Inter Regular</span><span style={{ fontWeight: "500" }}>Inter Medium</span><span style={{ fontWeight: "600" }}>Inter Semibold</span></div>
      <p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg><span><b>Download para membros desta marca.</b> Licença aceita por Carolina Menezes em 12/03/2026, no envio dos arquivos.</span></p>
      </div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">Fotografia</p>
      <Titulo className="h2" partes={["O acervo de fotos, organizado."]} />
      <p className="body">Álbuns por assunto, com miniaturas e ampliação de cada imagem. Selecione uma, várias ou todas e baixe de uma vez.</p>
      <ul className="ticks"><li>Álbuns criados pela agência</li><li>Ampliação antes de baixar</li><li>Várias fotos num pacote</li></ul>
      </div>
      <Captura src={telaBanco} alt="Banco de imagens da marca: miniaturas de um álbum com três fotos selecionadas e o botão Baixar 3 fotos (ZIP)" />
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">Versões</p>
      <Titulo className="h2" partes={["O logo antigo não se confunde com o atual."]} />
      <p className="body">Quando um arquivo sai de uso, ele não some: fica marcado como descontinuado, com a data. Quem procura encontra o atual primeiro.</p>
      </div>
      <div className="frame">
      <div className="mk"><div className="mk-body">
      <div className="vs">
      <div className="tile"><span className="tag cur">ATUAL</span><div className="tile-art dark logo"><svg viewBox="0 0 750 170"><use href="#bm-logo" /></svg></div><p>Logotipo 2026 <span>SVG · PNG</span></p></div>
      <div className="tile old"><span className="tag dis">DESCONTINUADO</span><div className="tile-art dark logo" style={{ color: "#f2f5f6" }}><svg viewBox="0 0 750 170"><use href="#bm-logo" /></svg></div><p>Logotipo 2019 <span>desde 03/2026</span></p></div>
      </div>
      <p className="vs-note">O descontinuado continua disponível para consulta, com aviso, e não entra no kit.</p>
      </div></div>
      </div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <div className="sec-head"><p className="eyebrow">Como funciona</p><Titulo className="h2" partes={["A agência organiza uma vez. A equipe usa sempre."]} /></div>
      <div className="steps">
      <div className="stp"><b>A agência sobe os arquivos</b><p>No Studio, cada arquivo entra no seu grupo: logotipo, cores, fonte, ícones, fotos.</p><small>Studio</small></div>
      <div className="stp"><b>Liga cada um à regra</b><p>A regra de uso e a página do manual ficam presas ao arquivo.</p><small>Studio</small></div>
      <div className="stp"><b>A equipe baixa o que precisa</b><p>Um arquivo, um grupo ou o kit inteiro, sempre a versão atual.</p><small>Book</small></div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <figure className="pg-wrap big-quote">
      <blockquote>Antes, cada fornecedor novo era uma hora de e-mail explicando qual arquivo usar. Agora eu mando o convite e pronto.</blockquote>
      <figcaption><b>Depoimento fictício</b> · texto de marcação do layout</figcaption>
      </figure>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre os materiais."]} /></div>
      <div>
      <details open><summary>Quem pode baixar os arquivos?</summary><p>As pessoas convidadas para aquela marca. Uma agência com vinte marcas convida cada fornecedor só para a marca em que ele trabalha.</p></details>
      <details><summary>E quem não tem conta, como a gráfica?</summary><p>Você envia um link de entrega com prazo, com logo, cores, fotos e regras de uso. Ele expira sozinho. A fonte não vai por link: ela é só para membros da marca. <Link className="more" style={{ margin: "0", fontSize: "inherit" }} href="/materiais#entrega">Entrega e acesso →</Link></p></details>
      <details><summary>A fonte da marca fica pública?</summary><p>Não. Ela é servida só para download, a membros autenticados daquela marca, depois de a licença ser aceita no envio. Nunca vira endereço público.</p></details>
      <details><summary>Quais formatos posso subir?</summary><p>Os de uso comum em marca: SVG, PNG, JPG, PDF, EPS, AI, OTF, TTF, ASE e outros. O limite de tamanho por arquivo depende do plano.</p></details>
      <details><summary>O que acontece com o logo antigo?</summary><p>Fica marcado como descontinuado, com data. Continua consultável, mas não entra no kit e aparece depois do atual.</p></details>
      </div>
      </div>
      </section>

      <BlocosDeEntrega />

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">Veja também</p>
      <div className="related">
      <Link className="rel" href="/vini"><small>Plataforma</small><b>Vini Max</b><span>Consulta, revisão de peça e prompts alinhados à marca.</span><em>→</em></Link>
      <Link className="rel" href="/manual"><small>Plataforma</small><b>O manual em PDF</b><span>Fiel ao que o estúdio diagramou.</span><em>→</em></Link>
      </div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Entregue a marca pronta para usar."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
