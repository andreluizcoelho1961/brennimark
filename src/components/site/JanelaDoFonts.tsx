import { getTranslations } from "next-intl/server";
import { AbasDoFonts } from "./AbasDoFonts";
import biblioteca from "./imagens/telas-fonts/biblioteca.webp";
import familiaAtivada from "./imagens/telas-fonts/familia-ativada.webp";
import kitAtivado from "./imagens/telas-fonts/kit-ativado.webp";
import kitConflito from "./imagens/telas-fonts/kit-conflito.webp";

/**
 * A janela do Brennimark Fonts (06/11/2026): capturas REAIS do aplicativo,
 * tiradas na edição de demonstração (catálogo com a marca de exemplo ACME e a
 * marca Brennimark), tema escuro. Substitui o desenho em código de 23/10.
 * Usada na página /fonts e no capítulo do Fonts da home.
 *
 * As capturas mostram a interface em português; o aplicativo ainda não tem
 * versão em inglês, então a página em inglês usa as mesmas imagens, com o texto
 * alternativo e as legendas traduzidos. Quando o app tiver inglês, as imagens
 * em inglês entram aqui. Os textos moram em `site.janelaDoFonts`.
 */
export async function JanelaDoFonts() {
  const t = await getTranslations("site.janelaDoFonts");
  const abas = [
    { id: "biblioteca", rotulo: t("abaBiblioteca"), legenda: t("legBiblioteca"), alt: t("altBiblioteca"), imagem: biblioteca },
    { id: "familia", rotulo: t("abaFamilia"), legenda: t("legFamilia"), alt: t("altFamilia"), imagem: familiaAtivada },
    { id: "kit", rotulo: t("abaKit"), legenda: t("legKit"), alt: t("altKit"), imagem: kitAtivado },
    { id: "conflito", rotulo: t("abaConflito"), legenda: t("legConflito"), alt: t("altConflito"), imagem: kitConflito },
  ];
  return <AbasDoFonts abas={abas} aria={t("aria")} />;
}
