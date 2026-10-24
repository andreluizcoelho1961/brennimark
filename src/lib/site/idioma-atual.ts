import { lang } from "next/root-params";
import { IDIOMA_PADRAO_DO_SITE, idiomaDoSiteValido, type IdiomaDoSite } from "./idiomas";

/**
 * O idioma da página do SITE em renderização, lido do endereço (`[lang]`).
 *
 * `next/root-params` é a forma de o Next entregar o parâmetro da raiz do
 * layout a QUALQUER componente de servidor, sem passar propriedade de mão em
 * mão. A página continua estática: o valor é conhecido na geração.
 *
 * Fora do site (a plataforma tem outra raiz, sem `[lang]`) devolve `null`, e
 * quem chama decide: `request.ts` cai no idioma da sessão.
 */
export async function idiomaDoEndereco(): Promise<IdiomaDoSite | null> {
  try {
    const valor = await lang();
    return typeof valor === "string" && idiomaDoSiteValido(valor) ? valor : null;
  } catch {
    return null;
  }
}

/** Para quem só pode ser chamado dentro do site. */
export async function idiomaDoSiteAtual(): Promise<IdiomaDoSite> {
  return (await idiomaDoEndereco()) ?? IDIOMA_PADRAO_DO_SITE;
}
