import Link from "next/link";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Central de ajuda — `/ajuda`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoAjuda() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px" }}>
      <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · Central de ajuda</p>
      <Titulo como="h1" className="pg-h1" partes={["Como podemos ajudar?"]} />
      <div className="hsearch"><span>⌕</span><input type="search" placeholder="Busque por um assunto: link de entrega, fonte, Vini…" aria-label="Buscar na central de ajuda" /></div>
      <div className="related" style={{ marginTop: "48px" }}>
      <Link className="rel" href="/ajuda"><small>8 artigos</small><b>Primeiros passos</b><span>Criar a primeira marca e publicar o manual.</span><em>→</em></Link>
      <Link className="rel" href="/ajuda"><small>11 artigos</small><b>O manual em PDF</b><span>Envio, índice, versões e download.</span><em>→</em></Link>
      <Link className="rel" href="/ajuda"><small>14 artigos</small><b>Materiais da marca</b><span>Grupos, formatos, regras de uso e o kit.</span><em>→</em></Link>
      <Link className="rel" href="/ajuda"><small>12 artigos</small><b>Vini Max</b><span>Perguntas, análise de peça, prompts e limites.</span><em>→</em></Link>
      <Link className="rel" href="/ajuda"><small>9 artigos</small><b>Pessoas e acesso</b><span>Convites, papéis e acesso por marca.</span><em>→</em></Link>
      <Link className="rel" href="/ajuda"><small>7 artigos</small><b>Assinatura</b><span>Planos, cobrança, exportação e encerramento.</span><em>→</em></Link>
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Mais lidos</p><Titulo className="h2" partes={["Perguntas frequentes."]} /></div>
      <div><details open><summary>Como publico o primeiro manual?</summary><p>No Studio, crie a marca, envie o PDF, confira o índice e publique. Em poucos minutos a equipe já consulta.</p></details><details><summary>Como convido um fornecedor só para uma marca?</summary><p>Em Pessoas, convide pelo e-mail e escolha a marca e o papel. Ele não verá as outras.</p></details><details><summary>Como crio um link de entrega?</summary><p>Em Entregas, escolha os materiais, o prazo e o limite de downloads, e copie o link.</p></details><details><summary>O que acontece quando atinjo o limite do Vini?</summary><p>Você pode comprar uso adicional, sem trocar de plano.</p></details></div>
      </div>
      </section>

      <section className="pg-sec" id="suporte"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ maxWidth: "900px" }}>
      <p className="eyebrow">Suporte</p>
      <Titulo className="h2" partes={["Algo não funcionou? A gente ajuda."]} />
      <p className="body">Conte o que aconteceu, em que marca e o que você esperava ver. Quem responde é a equipe que faz o Brennimark.</p>
      </div>
      </section>
      <section className="pg-sec" style={{ paddingTop: "0", borderTop: "0" }}>
      <div className="pg-wrap points"><div><i>01</i><b>Dentro da plataforma</b><span>Em Ajuda, &quot;Falar com o suporte&quot;. A mensagem já leva a marca e a tela em que você está.</span></div><div><i>02</i><b>Por e-mail</b><span className="mono">‹suporte@ a definir›</span></div><div><i>03</i><b>Uma conversa com o Vini</b><span>Se a dúvida surgiu numa conversa, use &quot;enviar esta conversa ao suporte&quot;. Só assim a equipe a vê.</span></div><div><i>04</i><b>Quando respondemos</b><span>Em dias úteis. O prazo de resposta de cada plano será publicado aqui.</span></div></div>
      </section>
      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Antes de escrever</p><Titulo className="h2" partes={["Talvez a resposta já esteja aqui."]} /></div>
      <div><details open><summary>Não consigo ver uma marca.</summary><p>O acesso é por marca. Peça a quem gere a marca que convide você para ela.</p></details><details><summary>O link de entrega não abre.</summary><p>Ele pode ter expirado, atingido o limite de downloads ou sido cancelado. Peça um novo a quem enviou.</p></details><details><summary>A fonte não aparece para baixar.</summary><p>A fonte é só para membros da marca, depois de a licença ser aceita no envio. Por link de entrega, ela não vai.</p></details></div>
      </div>
      </section>

      <section className="pg-sec" id="novidades">
      <div className="pg-wrap" style={{ maxWidth: "900px" }}>
      <p className="eyebrow">Novidades</p>
      <Titulo className="h2" partes={["O que entrou no Brennimark."]} />
      <p className="body">O produto anda toda semana. Aqui fica o registro, com data.</p>
      <div className="changelog">
      <div className="log-e"><time>27/09/2026</time><div><span className="st-chip ok">Novo</span><b>O Vini lê o manual inteiro</b><p>Em manuais de tamanho comum, o Vini passa a considerar o documento completo antes de responder, e cita com mais precisão.</p></div></div>
      <div className="log-e"><time>20/09/2026</time><div><span className="st-chip ok">Novo</span><b>Complementos</b><p>A agência escreve o que o manual não diz, e o Vini passa a citar depois de aprovado.</p></div></div>
      <div className="log-e"><time>13/09/2026</time><div><span className="st-chip ok">Novo</span><b>Acesso por marca</b><p>Cada pessoa é convidada para as marcas em que trabalha, com papel de quem gere ou de quem consulta.</p></div></div>
      <div className="log-e"><time>10/09/2026</time><div><span className="st-chip rev">Melhoria</span><b>Manuais grandes abrem mais rápido</b><p>O visualizador carrega as páginas sob demanda: as primeiras aparecem antes de o arquivo terminar de chegar.</p></div></div>
      <div className="log-e"><time>05/09/2026</time><div><span className="st-chip ok">Novo</span><b>Materiais da marca</b><p>Logotipo, cores, fonte, ícones e fotografia num só lugar, com o kit num clique.</p></div></div>
      <div className="log-e"><time>28/08/2026</time><div><span className="st-chip ok">Novo</span><b>Importação de manual em PDF</b><p>Suba o PDF que o estúdio entregou e publique para a equipe.</p></div></div>
      </div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Não achou? Fale com o suporte."]} />
      <Link className="btn" href="#suporte">Falar com o suporte <span className="arrow" aria-hidden="true">→</span></Link>
      </div>
      </section>
    </>
  );
}
