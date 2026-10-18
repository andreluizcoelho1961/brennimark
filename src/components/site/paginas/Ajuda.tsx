import Link from "next/link";
import { Losango } from "../Losango";
import { Titulo } from "../Titulo";
import { BuscaDaAjuda } from "../ajuda/BuscaDaAjuda";
import { CATEGORIAS, artigosDaCategoria, listarArtigos } from "@/lib/ajuda/artigos";

/** Central de ajuda — `/ajuda`. Os cartões e a busca são reais desde 17/10/2026; o resto do texto é do protótipo de 29/09/2026, sem edição (autoria do André). */
export function ConteudoAjuda() {
  const indice = listarArtigos().map(({ slug, titulo, resumo, texto }) => ({ slug, titulo, resumo, texto }));
  return (
    <>
      <section className="pg-sec"><Losango classe="l1" velocidade={-0.22} />
      <div className="pg-wrap" style={{ paddingTop: "72px" }}>
      <p className="crumb"><a href="#" data-open-menu="m-rec">Recursos</a> · Central de ajuda</p>
      <Titulo como="h1" className="pg-h1" partes={["Como podemos ajudar?"]} />
      <BuscaDaAjuda indice={indice} />
      <div className="related" style={{ marginTop: "48px" }}>
      {CATEGORIAS.map((c) => {
        const artigos = artigosDaCategoria(c.slug);
        if (artigos.length === 0) {
          return (
            <div key={c.slug} className="rel rel-em-breve" aria-disabled="true"><small>Em breve</small><b>{c.titulo}</b><span>{c.descricao}</span></div>
          );
        }
        const href = artigos.length === 1 ? `/ajuda/${artigos[0].slug}` : `/ajuda/categoria/${c.slug}`;
        return (
          <Link key={c.slug} className="rel" href={href}><small>{artigos.length} {artigos.length === 1 ? "artigo" : "artigos"}</small><b>{c.titulo}</b><span>{c.descricao}</span><em>→</em></Link>
        );
      })}
      </div>
      </div>
      </section>

      <section className="pg-sec">
      <div className="pg-wrap faq">
      <div><p className="eyebrow">Mais lidos</p><Titulo className="h2" partes={["Perguntas frequentes."]} /></div>
      <div><details open><summary>Como publico o primeiro manual?</summary><p>Em <b>Importar manual</b>, escolha o PDF, confira a prévia e clique em <b>Criar a marca</b>. Depois, revise o que a IA leu e aprove. <Link href="/ajuda/primeiros-passos">Primeiros passos →</Link></p></details><details><summary>Como convido um fornecedor só para uma marca?</summary><p>Em <b>Pessoas</b>, escolha <b>Consulta</b> e marque só aquela marca. Ele não verá as outras. <Link href="/ajuda/pessoas-e-acesso">Pessoas e acesso →</Link></p></details><details><summary>Como crio um link de entrega?</summary><p>Em <b>Links de entrega</b>, escolha os materiais e o prazo, e copie o endereço, que aparece uma única vez. <Link href="/ajuda/links-de-entrega">Links de entrega →</Link></p></details><details><summary>O que acontece quando atinjo o limite do Vini?</summary><p>O Vini recusa novos pedidos até o limite renovar (0h UTC, 21h em Brasília). O resto da plataforma continua. <Link href="/ajuda/assinatura">Assinatura →</Link></p></details></div>
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
