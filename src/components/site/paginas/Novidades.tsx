import { Losango } from "../Losango";
import { Titulo } from "../Titulo";

/** Novidades — `/novidades`. Texto do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoNovidades() {
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px", maxWidth: "900px" }}>
      <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · Novidades</p>
      <Titulo como="h1" className="pg-h1" partes={["O que entrou no Brennimark."]} />
      <p className="pg-lead">O produto anda toda semana. Aqui fica o registro, com data.</p>
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
    </>
  );
}
