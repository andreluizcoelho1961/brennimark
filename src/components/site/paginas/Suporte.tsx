import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Suporte — `/suporte`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoSuporte() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px", maxWidth: "900px" }}>
      <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · Suporte</p>
      <Titulo como="h1" className="pg-h1" partes={["Algo não funcionou? A gente ajuda."]} />
      <p className="pg-lead">Conte o que aconteceu, em que marca e o que você esperava ver. Quem responde é a equipe que faz o Brennimark.</p>
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
    </>
  );
}
