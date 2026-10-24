import { getRequestConfig } from "next-intl/server";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";

/**
 * De onde o next-intl sabe o idioma de CADA pedido, e qual catálogo carregar.
 *
 * Sem roteamento por endereço, de propósito: este arquivo serve a plataforma,
 * onde a pessoa está logada e a escolha acompanha a pessoa. O site público
 * ganha o idioma pelo endereço (`/en/...`), na fatia 5, e não passa por aqui.
 *
 * A regra é a MESMA do resto da interface (`idiomaDaSessao`: cookie, perfil,
 * navegador): se esta função decidisse sozinha, o texto traduzido e o resto da
 * tela poderiam sair em idiomas diferentes.
 *
 * Esta fatia NÃO liga o layout raiz a este arquivo: ler cookie no layout raiz
 * tornaria dinâmico o site público inteiro, que hoje é servido pronto.
 */
export default getRequestConfig(async () => {
  const locale = await idiomaDaSessao();
  return {
    locale,
    messages: (await import(`./mensagens/${locale}.json`)).default,
  };
});
