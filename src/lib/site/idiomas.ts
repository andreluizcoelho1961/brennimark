/**
 * Os idiomas do site público — fatia 5 (24/10/2026).
 *
 * O primeiro é o padrão e NÃO leva prefixo no endereço: `/vini` é português,
 * como sempre foi. Os demais levam o código: `/en/vini`. O `proxy` reescreve o
 * endereço sem prefixo para `/pt-BR/...` por dentro (a pessoa nunca vê isso).
 *
 * Um idioma novo entra aqui e nos catálogos; não precisa de pasta nova.
 *
 * Sem importação com `@/`: a suíte de unidade compila com `tsconfig.tests.json`.
 */
export const IDIOMAS_DO_SITE = ["pt-BR"] as const;

export type IdiomaDoSite = (typeof IDIOMAS_DO_SITE)[number];

export const IDIOMA_PADRAO_DO_SITE: IdiomaDoSite = "pt-BR";

/** O que vai no endereço para quem NÃO é o padrão. */
export const PREFIXOS_DE_IDIOMA = ["en"] as const;

export function idiomaDoSiteValido(valor: string): valor is IdiomaDoSite {
  return (IDIOMAS_DO_SITE as readonly string[]).includes(valor);
}
