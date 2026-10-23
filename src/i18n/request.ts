import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { COOKIE_DE_IDIOMA, resolveInterfaceLocale } from "@/platform/locale";

/**
 * De onde o next-intl sabe o idioma de CADA pedido, e qual catálogo carregar.
 *
 * Sem roteamento por endereço, de propósito: este arquivo serve a plataforma,
 * onde a pessoa está logada e a escolha acompanha a pessoa. O site público
 * ganha o idioma pelo endereço (`/en/...`), na fatia 5, e não passa por aqui.
 *
 * Esta fatia NÃO liga o layout raiz a este arquivo: ler cookie no layout raiz
 * tornaria dinâmico o site público inteiro, que hoje é servido pronto.
 */
export default getRequestConfig(async () => {
  const guardado = (await cookies()).get(COOKIE_DE_IDIOMA)?.value;
  const locale = resolveInterfaceLocale(guardado);
  return {
    locale,
    messages: (await import(`./mensagens/${locale}.json`)).default,
  };
});
