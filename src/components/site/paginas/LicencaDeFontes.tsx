import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Licença de fontes — `/licenca-de-fontes`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoLicencaDeFontes() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px", maxWidth: "900px" }}>
      <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · Licença de fontes</p>
      <Titulo como="h1" className="pg-h1" partes={["A fonte da marca e a licença dela."]} />
      <p className="pg-lead">Documento em elaboração. Ele vai descrever o termo que o assinante aceita antes de hospedar a fonte da marca.</p>
      </div>
      </section>
      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Em resumo</p><Titulo className="h2" partes={["O que este documento cobre."]} /></div>
      <div><details open><summary>Quem responde pela licença</summary><p>O assinante, que declara ter a licença da fonte para as pessoas daquela marca.</p></details><details><summary>Como a fonte é servida</summary><p>Só para download, a membros autenticados daquela marca. Nunca como endereço público, webfont ou link de entrega.</p></details><details><summary>Registro do aceite</summary><p>Cada envio de fonte registra quem aceitou e quando.</p></details><details><summary>Retirada</summary><p>Se uma fundição pedir, a fonte é retirada, e o assinante é avisado.</p></details></div>
      </div>
      </section>
    </>
  );
}
