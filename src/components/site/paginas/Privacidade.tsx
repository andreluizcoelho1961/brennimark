import { getTranslations } from "next-intl/server";
import { POLITICA_DE_PRIVACIDADE } from "@/lib/site/documentos-legais";
import { PRIVACY_POLICY } from "@/lib/site/documentos-legais-en";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";
import { DocumentoLegal } from "../DocumentoLegal";

/** Privacidade — `/privacidade` e `/en/privacy`. Rascunho de 03/10/2026, para revisão jurídica (ver `documentos-legais.ts`; o inglês, em `documentos-legais-en.ts`). */
export async function ConteudoPrivacidade() {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.legal");
  const paginas = await getTranslations("site.paginas");
  return <DocumentoLegal titulo={t("privacidadeTitulo")} migalha={paginas("privacidade.titulo")} documento={idioma === "en" ? PRIVACY_POLICY : POLITICA_DE_PRIVACIDADE} />;
}
