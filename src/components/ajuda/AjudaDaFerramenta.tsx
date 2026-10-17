import { artigoDaFerramenta, type FerramentaComAjuda } from "@/lib/ajuda/artigos";
import { renderizarArtigo } from "@/lib/ajuda/markdown";
import { PainelComoUsar } from "./PainelComoUsar";

/**
 * O botão "Como usar" de Cores, Grids e Kit. Componente de servidor: lê o
 * artigo do repositório e entrega o HTML pronto ao painel.
 *
 * `audiencia` é quem está usando a ferramenta — "site" é o gratuito, sem login;
 * "marca" é o do assinante, dentro de uma marca. Muda os trechos que o artigo
 * marca como de um lado só.
 */
export function AjudaDaFerramenta({ ferramenta, audiencia }: { ferramenta: FerramentaComAjuda; audiencia: "site" | "marca" }) {
  const artigo = artigoDaFerramenta(ferramenta);
  return <PainelComoUsar titulo={artigo.titulo} html={renderizarArtigo(artigo.corpo, audiencia)} hrefDoArtigo={`/ajuda/${artigo.slug}`} />;
}
