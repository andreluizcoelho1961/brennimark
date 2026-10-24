import { getTranslations } from "next-intl/server";
import { TERMOS_DE_USO } from "@/lib/site/documentos-legais";
import { TERMS_OF_USE } from "@/lib/site/documentos-legais-en";
import { idiomaDoSiteAtual } from "@/lib/site/idioma-atual";
import { DocumentoLegal } from "../DocumentoLegal";

/** Termos de uso — `/termos` e `/en/terms`. Rascunho de 03/10/2026, para revisão jurídica (ver `documentos-legais.ts`; o inglês, em `documentos-legais-en.ts`). */
export async function ConteudoTermos() {
  const idioma = await idiomaDoSiteAtual();
  const t = await getTranslations("site.legal");
  const paginas = await getTranslations("site.paginas");
  return <DocumentoLegal titulo={t("termosTitulo")} migalha={paginas("termos.titulo")} documento={idioma === "en" ? TERMS_OF_USE : TERMOS_DE_USO} />;
}
