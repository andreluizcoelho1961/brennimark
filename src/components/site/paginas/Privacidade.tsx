import { POLITICA_DE_PRIVACIDADE } from "@/lib/site/documentos-legais";
import { DocumentoLegal } from "../DocumentoLegal";

/** Privacidade — `/privacidade`. Rascunho de 03/10/2026, para revisão jurídica (ver `documentos-legais.ts`). */
export function ConteudoPrivacidade() {
  return <DocumentoLegal titulo="Política de privacidade." migalha="Privacidade" documento={POLITICA_DE_PRIVACIDADE} />;
}
