import { getRequestConfig } from "next-intl/server";
import { idiomaDaSessao } from "@/lib/idioma-da-sessao";
import { idiomaDoEndereco } from "@/lib/site/idioma-atual";

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
  // No site o idioma é o do ENDEREÇO (`/en/...`) e a página segue estática; fora dele,
  // o da sessão. Ler cookie dentro do site tornaria dinâmica cada página.
  const locale = (await idiomaDoEndereco()) ?? (await idiomaDaSessao());
  return {
    locale,
    messages: (await import(`./mensagens/${locale}.json`)).default,
  };
});
