import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Termos de uso — `/termos`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoTermos() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px", maxWidth: "900px" }}>
      <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · Termos de uso</p>
      <Titulo como="h1" className="pg-h1" partes={["Termos de uso."]} />
      <p className="pg-lead">Documento em elaboração com a assessoria jurídica. Esta página mostra a estrutura que ele vai ter.</p>
      </div>
      </section>
      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Em resumo</p><Titulo className="h2" partes={["O que este documento cobre."]} /></div>
      <div><details open><summary>Quem é quem</summary><p>Assinante, pessoas convidadas, quem gere e quem consulta cada marca.</p></details><details><summary>O que o Brennimark faz e o que não faz</summary><p>Organiza e dá acesso ao que a marca documenta. O Vini orienta, mas não aprova peças nem substitui a revisão da equipe.</p></details><details><summary>Conteúdo da marca</summary><p>Manuais, materiais e complementos continuam de quem os criou ou contratou.</p></details><details><summary>Assinatura, encerramento e exportação</summary><p>Como funciona o período de conta congelada e a exportação dos dados.</p></details></div>
      </div>
      </section>
    </>
  );
}
