import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { Captura } from "../Captura";
import telaPessoas from "../imagens/telas/pessoas.webp";
import telaReceber from "../imagens/telas/receber.webp";
import telaRegistros from "../imagens/telas/registros.webp";

/** Entrega e acesso: o que era a página `/entrega`, agora um bloco de outra página (22/10/2026). Texto do protótipo de 29/09/2026 (autoria do André). */
export function BlocosDeEntrega() {
  return (
    <>
      <section className="pg-sec" id="entrega"><Losango classe="l2" velocidade={0.2} />
      <div className="pg-wrap sec-head">
      <p className="eyebrow">Entrega e acesso</p>
      <Titulo className="h2" partes={["Cada fornecedor com a versão atual da marca."]} />
      <p className="body" style={{ maxWidth: "640px" }}>Envie materiais a quem não tem conta com um link que expira, convide cada pessoa para as marcas em que trabalha e mantenha todos com a mesma referência.</p>
      </div>
      </section>

      <section className="pg-sec"><Losango classe="l3" velocidade={-0.18} />
      <div className="pg-wrap">
      <div className="feat-row">
      <div>
      <p className="eyebrow">Link de entrega</p>
      <Titulo className="h2" partes={["Para quem não tem conta, um link que expira."]} />
      <p className="body">Escolha os materiais e o prazo. O link para de funcionar sozinho, e cada uso fica registrado.</p>
      <ul className="ticks"><li>Prazo de validade</li><li>Sem criar conta para o fornecedor</li><li>A fonte fica de fora: só membros da marca baixam</li></ul>
      </div>
      <Captura src={telaReceber} alt="A página que a gráfica recebe, sem criar conta: o nome de quem baixa, os arquivos escolhidos e a regra do manual com as páginas" />
      </div>

      <div className="feat-row rev">
      <div>
      <p className="eyebrow">Registros</p>
      <Titulo className="h2" partes={["Qual versão cada um recebeu."]} />
      <p className="body">Envios e downloads ficam no mesmo histórico. Quando alguém pergunta &quot;a gráfica recebeu o logo novo?&quot;, a resposta está ali. O registro mostra acesso e download; não mostra como a marca foi aplicada numa peça.</p>
      <ul className="ticks"><li>Downloads e envios num só lugar</li><li>Filtro por marca, pessoa e período</li><li>Exportável</li></ul>
      </div>
      <Captura src={telaRegistros} alt="Os registros: quem baixou qual material, quando e em qual marca" />
      </div>

      <div className="feat-row">
      <div>
      <p className="eyebrow">Acesso por marca</p>
      <Titulo className="h2" partes={["Cada pessoa vê só a marca em que trabalha."]} />
      <p className="body">Uma agência com vinte marcas convida o fotógrafo só para a marca do ensaio. Dois papéis simples: quem gere e quem consulta.</p>
      <ul className="ticks"><li>Quem gere publica e aprova</li><li>Quem consulta lê, baixa e pergunta</li><li>Mude o papel quando quiser</li></ul>
      </div>
      <Captura src={telaPessoas} alt="Pessoas e acesso: cada pessoa com o seu nível e as marcas que alcança" />
      </div>
      </div>
      </section>


      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Perguntas</p><Titulo className="h2" partes={["Sobre entrega e acesso."]} /></div>
      <div><details open><summary>O fornecedor precisa criar conta?</summary><p>Não, se você usar o link de entrega. Para quem trabalha na marca todo dia, vale o convite.</p></details><details><summary>Posso cancelar um link antes do prazo?</summary><p>Sim, a qualquer momento. Ele para de funcionar na hora.</p></details><details><summary>Quantas pessoas posso convidar?</summary><p>Ilimitadas, em todos os planos.</p></details><details><summary>Quem vê os registros?</summary><p>Quem gere a marca.</p></details></div>
      </div>
      </section>

    </>
  );
}
