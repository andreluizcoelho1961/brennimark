import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Studio: o que era a página `/studio`, agora um bloco de outra página (22/10/2026). Texto do protótipo de 29/09/2026 (autoria do André). */
export function BlocosDoStudio() {
  return (
    <>
      <section className="pg-sec" id="studio"><Losango classe="l2" velocidade={0.2} />
      <div className="pg-wrap sec-head">
      <p className="eyebrow">Studio</p>
      <Titulo className="h2" partes={["O Studio é onde a agência cuida de todas as marcas."]} />
      <p className="body" style={{ maxWidth: "640px" }}>Publique manuais, organize materiais, escreva complementos, convide pessoas e acompanhe tudo, marca por marca, num só lugar.</p>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Duas portas</p>
      <Titulo className="h2" partes={["O Studio para quem gere. O Book para quem consulta."]} />
      <p className="body">A mesma marca, duas experiências. Quem só precisa usar a marca não esbarra em ferramenta de edição.</p>

      </div>
      <div className="two-apps"><div><small>STUDIO</small><b>Para quem gere</b><p>Publica o manual, organiza os materiais, escreve complementos, convida pessoas e acompanha os registros.</p></div><div><small>BOOK</small><b>Para quem consulta</b><p>Lê o manual, baixa os materiais e pergunta ao Vini. Sem nenhum botão que não seja para ele.</p></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">Status claro</p>
      <Titulo className="h2" partes={["O que está aprovado, o que é rascunho e quem decide."]} />
      <p className="body">Cada item tem um status: rascunho, em revisão ou publicado. Acrescentar uma imagem ou um texto não muda o status; só a aprovação de quem gere a marca muda. A equipe e o Vini usam o que está publicado.</p>
      <ul className="ticks"><li>Status visível em cada item</li><li>Aprovação antes de publicar</li><li>O Vini só cita o publicado</li></ul>
      </div>
      <div className="flowst"><div><span className="st-chip dr">Rascunho</span><p>A agência monta, sobe e escreve.</p></div><em>→</em><div><span className="st-chip rev">Em revisão</span><p>Alguém confere antes de publicar.</p></div><em>→</em><div><span className="st-chip ok">Publicado</span><p>A equipe vê, e o Vini passa a citar.</p></div></div>
      </div>
      </div>
      </section>


      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre o Studio."]} /></div>
      <div><details open><summary>Quem entra no Studio?</summary><p>Quem assina e as pessoas a quem ele dá o papel de gerir uma marca.</p></details><details><summary>Várias pessoas podem administrar?</summary><p>Sim, cada uma com o seu próprio acesso. Nada de senha compartilhada.</p></details><details><summary>O cliente da agência vê o Studio?</summary><p>Só se a agência quiser que ele também administre a marca. Para consultar, ele usa o Book.</p></details></div>
      </div>
      </section>

    </>
  );
}
