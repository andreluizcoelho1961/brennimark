import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Privacidade — `/privacidade`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoPrivacidade() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px", maxWidth: "900px" }}>
      <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · Privacidade</p>
      <Titulo como="h1" className="pg-h1" partes={["Política de privacidade."]} />
      <p className="pg-lead">Documento em elaboração, de acordo com a LGPD. Esta página mostra a estrutura que ele vai ter.</p>
      </div>
      </section>
      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Em resumo</p><Titulo className="h2" partes={["O que este documento cobre."]} /></div>
      <div><details open><summary>Que dados guardamos</summary><p>Conta, marcas, arquivos enviados, registros de acesso e download, e conversas com o Vini.</p></details><details><summary>Conversas com o Vini</summary><p>São de quem perguntou. A equipe do Brennimark só vê uma conversa se a pessoa a enviar ao suporte.</p></details><details><summary>Estatística sem nome</summary><p>Para melhorar o produto usamos números agregados, sem identificar quem perguntou.</p></details><details><summary>Seus direitos</summary><p>Acesso, correção, exclusão e portabilidade, e o canal para pedir.</p></details></div>
      </div>
      </section>
    </>
  );
}
