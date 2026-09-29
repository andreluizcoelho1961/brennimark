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

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Não achou? Fale com o suporte."]} />
      <Link className="btn" href="/suporte">Falar com o suporte <span className="arrow" aria-hidden="true">→</span></Link>
      </div>
      </section>
    </>
  );
}
