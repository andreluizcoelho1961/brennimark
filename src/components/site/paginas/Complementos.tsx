import Image from "next/image";
import vini from "../imagens/vini.webp";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Complementos e lacunas: o que era a página `/complementos`, agora um bloco de outra página (22/10/2026). Texto do protótipo de 29/09/2026 (autoria do André). */
export function BlocosDeComplementos() {
  return (
    <>
      <section className="pg-sec" id="complementos"><Losango classe="l2" velocidade={0.2} />
      <div className="pg-wrap sec-head">
      <p className="eyebrow">Complementos e lacunas</p>
      <Titulo className="h2" partes={["O que o manual não diz, a agência escreve. E o Vini passa a citar."]} />
      <p className="body" style={{ maxWidth: "640px" }}>Todo manual tem lacunas. O Brennimark mostra quais são, pelas perguntas da equipe, e deixa a agência responder com um complemento, sem refazer o PDF.</p>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Complementos</p>
      <Titulo className="h2" partes={["Texto simples, publicado ao lado do manual."]} />
      <p className="body">A agência escreve o complemento em texto simples, com títulos e listas. Ele passa por aprovação e aparece na aba Complementos, ao lado do PDF.</p>
      <ul className="ticks"><li>Editor com prévia</li><li>Rascunho, revisão e publicado</li><li>Histórico de cada versão</li></ul>
      </div>
      <div className="frame"><div className="mk" role="img" aria-label="Editor de complemento: texto à esquerda e a prévia à direita, com status rascunho"><div className="mk-bar"><div className="seg"><span>Manual</span><span>Materiais</span><span className="on">Complementos</span></div><span className="mk-btn a-direita">Publicar</span></div>
      <div className="md"><pre className="md-src">{"# Símbolo sobre fotografia\n\nUse o símbolo sobre foto só em\náreas **escuras e sem textura**.\n\n- versão branca, sem gradiente\n- área de proteção dobrada\n- nunca sobre rosto"}</pre><div className="md-out"><h5>Símbolo sobre fotografia</h5><p>Use o símbolo sobre foto só em áreas <b>escuras e sem textura</b>.</p><ul><li>versão branca, sem gradiente</li><li>área de proteção dobrada</li><li>nunca sobre rosto</li></ul><span className="st-chip">Rascunho · aguardando aprovação</span></div></div></div></div>
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">O Vini cita</p>
      <Titulo className="h2" partes={["A lacuna fechada vira resposta."]} />
      <p className="body">Depois de aprovado, o complemento entra no que o Vini sabe. A mesma pergunta passa a ter resposta, com a fonte.</p>

      </div>
      <div className="chat"><div className="chat-win"><div className="chat-head"><Image src={vini} alt="" sizes="34px" /><div><b>Vini Max</b><br /><span>Manual do Brennimark</span></div></div><div className="turn was"><p className="tag-when">Antes da aprovação</p><p className="q">Posso usar o símbolo sobre foto?</p><p className="a">O manual não trata disso. Existe um complemento em rascunho, que ainda não vale como regra. Vale confirmar com quem gere a marca.</p></div><div className="turn"><p className="tag-when">Depois da aprovação, em 20/09</p><p className="q">Posso usar o símbolo sobre foto?</p><p className="a">Sim, em áreas escuras e sem textura, na versão branca e com a área de proteção dobrada. Nunca sobre rosto.</p><span className="src">Fonte: Complemento &quot;Símbolo sobre fotografia&quot; · aprovado em 20/09</span></div></div></div>
      </div>
      </div>
      </section>


      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre complementos."]} /></div>
      <div><details open><summary>O complemento muda o PDF?</summary><p>Não. O PDF continua como o estúdio entregou; o complemento fica ao lado, identificado.</p></details><details><summary>Quem pode escrever?</summary><p>Quem gere a marca. A publicação passa por aprovação.</p></details><details><summary>O relatório mostra quem perguntou?</summary><p>Não. Só o assunto e quantas vezes, e só quando há gente suficiente perguntando para ninguém ser identificado.</p></details></div>
      </div>
      </section>

    </>
  );
}
