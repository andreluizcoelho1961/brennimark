import { TERMOS_DE_USO } from "@/lib/site/documentos-legais";
import { DocumentoLegal } from "../DocumentoLegal";

/** Termos de uso — `/termos`. Rascunho de 03/10/2026, para revisão jurídica (ver `documentos-legais.ts`). */
export function ConteudoTermos() {
  return <DocumentoLegal titulo="Termos de uso." migalha="Termos de uso" documento={TERMOS_DE_USO} />;
}
