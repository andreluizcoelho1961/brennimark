import { getTranslations } from "next-intl/server";
import type { IdiomaDoEmail } from "./idioma-do-email";

export { idiomaDoEmailPelaMoeda, type IdiomaDoEmail } from "./idioma-do-email";

/** O tradutor do trecho `email` do catálogo, no idioma pedido (servidor). */
export function tradutorDoEmail(idioma: IdiomaDoEmail) {
  return getTranslations({ locale: idioma, namespace: "email" });
}
