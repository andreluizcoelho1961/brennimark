import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Manifesto — `/manifesto`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoManifesto() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap mani">
      <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · Manifesto</p>
      <Titulo como="h1" className="pg-h1" partes={["Uma marca é forjada com cuidado. E precisa continuar viva em cada trabalho."]} />
      <p className="mani-lead"><em>Brennimark</em>, em islandês, é a marca de fogo: o sinal gravado a ferro que dizia de quem era aquilo. A palavra inglesa <em>brand</em> vem da mesma ideia de queimar.</p>
      <div className="mani-body">
      <p>Foram mais de quarenta anos de design e direção de arte. Em quase todos, a mesma dificuldade voltava: o prazo correndo, o manual num PDF extenso, os arquivos espalhados em pastas e a resposta que demorava a chegar.</p>
      <Titulo como="p" className="mani-pull" partes={["A Brennimark é a ajuda que eu sempre quis ter."]} />
      <p>Uma marca nasce do trabalho cuidadoso de quem a cria: o desenho do símbolo, o peso de cada letra, a cor exata, o espaço ao redor. Depois, ela segue para muitas mãos: a agência, o fornecedor, a gráfica, quem acabou de chegar à equipe. Cada uma leva a ideia adiante.</p>
      <p>A Brennimark reúne o manual como o estúdio o desenhou, os materiais atualizados e as orientações que a marca ganha com o tempo. O Vini ajuda a encontrar a resposta, com a fonte, para que o tempo volte para o que importa: pensar, pesquisar e criar.</p>
      <p>Uma marca viva não é uma marca rígida. Ela evolui, ganha orientações novas e às vezes se reinventa, e todos precisam acompanhar a versão atual.</p>
      <p>Respeitamos a autoria de quem criou e a decisão de quem aplica. Não inventamos regra, e dizemos com clareza quando não há uma resposta segura.</p>
      <Titulo como="p" className="mani-pull" partes={["Forjada com cuidado. Viva em cada trabalho."]} />
      </div>
      </div>
      </section>

      <div className="marquee" aria-hidden="true"><div className="mq-track"><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span><span>Forjada com cuidado <i>✦</i> Viva em cada trabalho <i>✦</i> </span></div></div>
      <section className="pg-sec"><Losango classe="l4" velocidade={0.25} />
      <div className="pg-wrap cta-band">
      <Titulo partes={["Mantenha a sua marca viva."]} />
      <button className="btn" type="button" data-open="dlg-demo">Agendar uma demonstração <span className="arrow" aria-hidden="true">↗</span></button>
      </div>
      </section>
    </>
  );
}
