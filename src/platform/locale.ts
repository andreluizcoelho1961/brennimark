/**
 * O idioma da INTERFACE.
 *
 * A distinção que este módulo existe para manter: o Brennimark tem um idioma,
 * e cada manual tem o seu. Eram a mesma coisa — 33 pontos decidiam a microcópia
 * da plataforma por `brennimarkInstance.metadata.language`, então importar um
 * manual em inglês passava login, navegação, administração e mensagens de erro
 * para o inglês. A pessoa não pediu isso; a marca do cliente dela pediu.
 *
 * O que SEGUE sendo do manual, de propósito:
 * - as respostas do assistente, que citam o manual e devem falar a língua dele;
 * - o vocabulário editorial do selo de status, que a marca pode redefinir.
 *
 * Tudo o mais é instrumento do produto e fala a língua de quem usa.
 */
export const PRODUCT_LOCALES = ["pt-BR", "en"] as const;

export type ProductLocale = (typeof PRODUCT_LOCALES)[number];

/**
 * O padrão do produto enquanto ninguém escolheu.
 *
 * Quem escolhe por pessoa é `escolherIdioma` (cookie, depois `profiles.locale`,
 * depois o navegador), entregue à interface por `resolveWorkspaceContext` e por
 * `IdiomaDaSessao`. Módulos que ainda leem esta constante direto — rotas de
 * API, DocPage, mensagens de erro de IA — seguem em português até a fatia que
 * os migrar: uma constante de módulo não varia por pessoa.
 */
export const PRODUCT_LOCALE: ProductLocale = "pt-BR";

export function isProductLocale(valor: unknown): valor is ProductLocale {
  return typeof valor === "string" && (PRODUCT_LOCALES as readonly string[]).includes(valor);
}

/**
 * O idioma da interface para esta pessoa.
 *
 * Recebe a preferência do usuário quando ela existir. NÃO recebe o idioma do
 * manual, e essa ausência é o ponto: se o parâmetro existisse, alguém acabaria
 * passando `brand.metadata.language` para cá.
 */
export function resolveInterfaceLocale(preferenciaDoUsuario?: unknown): ProductLocale {
  return isProductLocale(preferenciaDoUsuario) ? preferenciaDoUsuario : PRODUCT_LOCALE;
}

/** Açúcar para a microcópia existente, que é bilíngue por ternário. */
export function inEnglish(locale: ProductLocale): boolean {
  return locale === "en";
}

/**
 * Onde a escolha de idioma fica guardada no navegador. A preferência por
 * pessoa (coluna em `profiles`) chega na fatia da plataforma; o cookie é o que
 * vale para quem ainda não entrou e o que o servidor lê em cada pedido.
 */
export const COOKIE_DE_IDIOMA = "BRENNIMARK_IDIOMA";

/**
 * O idioma que o navegador pede (`Accept-Language`), reduzido aos que o produto
 * tem. Vale só enquanto a pessoa não escolheu: escolha explícita ganha sempre.
 * "pt", "pt-PT" e "pt-BR" viram `pt-BR`; "en", "en-US" e "en-GB" viram `en`.
 */
export function localeDoNavegador(acceptLanguage: string | null | undefined): ProductLocale {
  if (!acceptLanguage) return PRODUCT_LOCALE;
  const pedidos = acceptLanguage
    .split(",")
    .map((parte) => {
      const [tag, ...params] = parte.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const peso = q ? Number(q.slice(2)) : 1;
      return { lingua: tag.trim().toLowerCase().split("-")[0], peso: Number.isNaN(peso) ? 0 : peso };
    })
    .filter((p) => p.peso > 0)
    .sort((a, b) => b.peso - a.peso);
  for (const { lingua } of pedidos) {
    if (lingua === "pt") return "pt-BR";
    if (lingua === "en") return "en";
  }
  return PRODUCT_LOCALE;
}

/**
 * Quem manda no idioma, em ordem: a escolha neste navegador (cookie), a
 * preferência guardada na pessoa (`profiles.locale`), o que o navegador pede.
 *
 * O cookie vem primeiro porque o botão grava os dois, e quem acabou de clicar
 * não pode ver a tela voltar atrás por causa de outro aparelho. A preferência
 * guardada cobre o aparelho novo, que ainda não tem cookie.
 */
export function escolherIdioma(fontes: {
  cookie?: unknown;
  perfil?: unknown;
  acceptLanguage?: string | null;
}): ProductLocale {
  if (isProductLocale(fontes.cookie)) return fontes.cookie;
  if (isProductLocale(fontes.perfil)) return fontes.perfil;
  return localeDoNavegador(fontes.acceptLanguage);
}

/**
 * O idioma de FORMATAÇÃO de datas e números para a interface.
 *
 * Um ponto só decide, porque as telas escolhiam sozinhas e discordavam: umas
 * usavam "en-GB" (dia antes do mês) e outras "en-US" (mês antes do dia) para o
 * mesmo inglês. O produto vende em dólar para quem usa inglês, então o inglês
 * é o americano.
 */
export function localeDeFormato(ingles: boolean): "pt-BR" | "en-US" {
  return ingles ? "en-US" : "pt-BR";
}
