import { getLocale } from "next-intl/server";
import { artigoDaFerramenta, type FerramentaComAjuda } from "@/lib/ajuda/artigos";
import { renderizarArtigo } from "@/lib/ajuda/markdown";
import { caminhoDoSite, idiomaDoSiteValido, IDIOMA_PADRAO_DO_SITE } from "@/lib/site/idiomas";
import { PainelComoUsar } from "./PainelComoUsar";

/**
 * O botão "Como usar" de Cores, Grids e Kit. Componente de servidor: lê o
 * artigo do repositório e entrega o HTML pronto ao painel.
 *
 * `audiencia` é quem está usando a ferramenta — "site" é o gratuito, sem login;
 * "marca" é o do assinante, dentro de uma marca. Muda os trechos que o artigo
 * marca como de um lado só.
 *
 * O idioma é o da tela (`getLocale`): o do endereço no site, o da pessoa na plataforma.
 */
export async function AjudaDaFerramenta({ ferramenta, audiencia }: { ferramenta: FerramentaComAjuda; audiencia: "site" | "marca" }) {
  const locale = await getLocale();
  const idioma = idiomaDoSiteValido(locale) ? locale : IDIOMA_PADRAO_DO_SITE;
  const artigo = artigoDaFerramenta(ferramenta, idioma);
  return <PainelComoUsar titulo={artigo.titulo} html={renderizarArtigo(artigo.corpo, audiencia, idioma)} hrefDoArtigo={caminhoDoSite(idioma, `/ajuda/${artigo.slug}`)} />;
}
