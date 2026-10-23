import Image from "next/image";
import Link from "next/link";
import vini from "../imagens/vini.webp";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import telaRevisao from "../imagens/telas/revisao.webp";

/** Vini Max — `/vini`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoVini() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap pg-hero">
      <div>
      <p className="crumb"><a href="#" data-open-menu="m-plat">Plataforma</a> · Vini Max</p>
      <Titulo como="h1" className="pg-h1" partes={["O Vini Max ajuda você a trabalhar com a marca."]} />
      <p className="pg-lead">Ele responde com fundamento, encontra o material certo, aponta quando duas orientações não batem e reconhece quando não há resposta segura. Consulta o manual, os complementos aprovados e os materiais da marca.</p>
      <div className="pg-actions"><button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button><Link className="btn btn--ghost" href="/#planos" data-go="planos">Ver os planos <span className="arrow" aria-hidden="true">→</span></Link></div>
      </div>
      <div className="vini-hero"><Image src={vini} alt="Vini Max, o assistente do Brennimark, de óculos redondos e gola alta preta, com um livro na mão" sizes="340px" /><div className="vh-tags"><span>Consultar</span><span>Analisar</span><span>Preparar</span></div></div>
      </div>
      </section>

      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>Responde com fundamento</b><span>A orientação com a fonte e a página. A citação abre o manual lá.</span></div><div><i>02</i><b>Encontra o material</b><span>Aponta o arquivo certo em Materiais da marca.</span></div><div><i>03</i><b>Aponta divergências</b><span>Quando duas orientações documentadas não batem, mostra as duas.</span></div><div><i>04</i><b>Reconhece o limite</b><span>Sem resposta segura, diz e sugere com quem confirmar.</span></div></div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Consultar</p>
      <Titulo className="h2" partes={["Pergunte como perguntaria a um colega que conhece a marca."]} />
      <p className="body">A orientação, com a página. Um clique na citação leva o manual até ela, sem fechar a conversa. O que é rascunho aparece identificado.</p>
      <ul className="ticks"><li>A orientação, não só &quot;veja a página&quot;</li><li>A citação abre o manual</li><li>Rascunho sempre identificado</li></ul>
      </div>
      <div className="chat">
      <div className="chat-win">
      <div className="chat-head"><Image src={vini} alt="" sizes="340px" /><div><b>Vini Max</b><br /><span>Manual do Brennimark</span></div></div>
      <div className="turn">
      <p className="q">Qual é a área de proteção do símbolo?</p>
      <p className="a">É x nos quatro lados. No símbolo sozinho, x equivale a um terço da altura dele. Nenhum texto ou imagem entra nesse espaço.</p>
      <span className="src">Fonte: Manual do Brennimark · Área de proteção · p. 10</span>
      </div>
      <div className="turn">
      <p className="q">Posso aplicar o símbolo sobre uma foto?</p>
      <p className="a">O manual não trata do símbolo sobre fotografia. Existe um complemento sobre isso, ainda em rascunho, então ele não vale como regra. Vale confirmar com quem gere a marca.</p>
      <span className="src">Procurado em: Marca, p. 5–13 · Linguagem fotográfica, p. 27–29 · Complementos</span>
      </div>
      </div>
      </div>
      </div>

      <div className="feat-row stack">
      <div>
      <p className="eyebrow">Analisar</p>
      <Titulo className="h2" partes={["Solte a peça. Ele faz uma segunda leitura."]} />
      <p className="body">Ele compara as cores com a paleta e marca na peça o que encontrou, com a página de cada orientação. O que ainda não consegue medir sozinho aparece como verificação manual, para você conferir.</p>
      <ul className="ticks"><li>Achados com a orientação e a página</li><li>Marcação sobre a peça</li><li>Sugestão de correção, para você decidir</li></ul>
      </div>
      <Captura src={telaRevisao} alt="A revisão de uma peça: o assistente marca o que está fora das regras do manual, com a página de cada regra" />
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">Preparar</p>
      <Titulo className="h2" partes={["A sua ideia, com a marca no prompt."]} />
      <p className="body">Você descreve o que quer criar. O Vini acrescenta cores, luz, enquadramento e o que evitar, com a página de cada linha. Você revisa e usa.</p>
      <ul className="ticks"><li>A ideia é sua; a marca vem junto</li><li>Rascunho fica fora do prompt, identificado</li><li>A fonte de cada linha</li></ul>
      </div>
      <div><div className="dna-prompt">
      <div className="dna-top"><span>PROMPT · SUA IDEIA + MANUAL DO BRENNIMARK</span><button type="button" className="copy" data-copy="#prompt-dna-2">Copiar</button></div>
      <p className="ask"><b>O seu pedido</b>“Uma foto para o post de lançamento: alguém revisando o manual impresso numa mesa de estúdio.”</p>
      <pre id="prompt-dna-2" className="prompt">{"Fotografia para o Brennimark, formato 4:5.\n"}<span className="k">{"Cena"}</span>{"  mesa de estúdio; mãos revisando as\n      pranchas impressas de um manual de marca.\n      Gente trabalhando, sem posar.     "}<span className="ref">{"p. 27"}</span>{"\n"}<span className="k">{"Quadro"}</span>{" de cima ou na altura da mesa, perto\n      do trabalho, espaço livre p/ título. "}<span className="ref">{"p. 28"}</span>{"\n"}<span className="k">{"Luz"}</span>{"   natural, lateral, de janela. Sombras\n      frias; calor só nas luzes.        "}<span className="ref">{"p. 27"}</span>{"\n"}<span className="k">{"Cor"}</span>{"   sombras em Noite Polar "}<span className="hex"><i style={{ background: "#001621" }}></i>{"#001621"}</span>{";\n      um único ponto de Brasa "}<span className="hex"><i style={{ background: "#ff4103" }}></i>{"#FF4103"}</span>{".  "}<span className="ref">{"p. 14"}</span>{"\n"}<span className="k">{"Evitar"}</span>{" filtro de cor, duotone, sombras\n      quentes, logo de marca real.      "}<span className="ref">{"p. 29"}</span></pre>
      <p className="draft"><b>Fora do prompt · rascunho</b> Grão de filme leve, proposto para Linguagem fotográfica. Ainda não aprovado, por isso não entra no prompt da marca. <u>Explorar numa versão à parte, marcada como exploração</u></p>
      <p className="dna-src">A ideia é sua; as orientações vêm do manual (edição de demonstração) · Cores, p. 14 · Linguagem fotográfica, p. 27–29</p>
      </div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">Onde ele vive</p>
      <Titulo className="h2" partes={["No canto de cada tela da marca."]} />
      <p className="body">Chama quando precisar, e ele sai da frente quando você volta ao trabalho. Três tamanhos, um para cada momento.</p>

      </div>
      <div className="states3"><div className="s3"><div className="s3-art s3-a"><Image src={vini} alt="" sizes="340px" /></div><b>Recolhido</b><span>Só ele, no canto. Não cobre o manual.</span></div><div className="s3"><div className="s3-art s3-b"><i></i><i></i><i></i></div><b>Conversa</b><span>Uma janela para perguntar e ler.</span></div><div className="s3"><div className="s3-art s3-c"><i></i><i></i></div><b>Análise</b><span>A peça e os achados, lado a lado.</span></div></div>
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">Privacidade</p>
      <Titulo className="h2" partes={["Ninguém lê a sua conversa."]} />
      <p className="body">A conversa com o Vini é de quem perguntou. Para melhorar o produto, usamos números agregados, sem identificar ninguém.</p>

      </div>
      <div className="font-card"><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg><span><b>Suas conversas são suas.</b> Ninguém lê a conversa de outra pessoa: nem o dono da conta, nem a equipe do Brennimark. Usamos só estatísticas, sem identificar quem perguntou.</span></p><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M4 1.5h5.5l3 3v10H4Z" /><path d="M9.5 1.5v3h3" /></svg><span><b>Cada pessoa apaga as suas</b> quando quiser. Fica só o registro de uso, sem o conteúdo.</span></p><p className="lock"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z" /></svg><span><b>Conteúdo só com o seu gesto:</b> &quot;enviar esta conversa ao suporte&quot;.</span></p></div>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <figure className="pg-wrap big-quote">
      <blockquote>Quando o cliente pergunta, eu abro a página do manual junto com ele. A conversa fica na ideia, não no arquivo.</blockquote>
      <figcaption><b>Depoimento fictício</b> · texto de marcação do layout</figcaption>
      </figure>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre o Vini."]} /></div>
      <div><details open><summary>O Vini inventa regra quando não sabe?</summary><p>Não. Quando o manual não trata do assunto, ele diz que não há diretriz documentada e mostra onde procurou.</p></details><details><summary>Ele aprova peças?</summary><p>Não. Ele aponta o que encontrou e a regra correspondente. A aprovação é da equipe.</p></details><details><summary>Quanto posso usar?</summary><p>Cada plano tem um limite de uso do Vini, e o excedente pode ser comprado à parte.</p></details><details><summary>A peça que eu envio fica com quem?</summary><p>Com a marca. Só quem tem acesso àquela marca vê a análise.</p></details></div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap">
      <p className="eyebrow">Veja também</p>
      <div className="related"><Link className="rel" href="/manual"><small>Plataforma</small><b>O manual em PDF</b><span>Fiel ao que o estúdio diagramou.</span><em>→</em></Link><Link className="rel" href="/manual#complementos"><small>Plataforma</small><b>Complementos e lacunas</b><span>O que o manual não diz, escrito e citado.</span><em>→</em></Link><Link className="rel" href="/seguranca"><small>Plataforma</small><b>Segurança e privacidade</b><span>Acesso por marca, conversas privadas, dados seus.</span><em>→</em></Link></div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Traga o Vini para perto da sua equipe."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
